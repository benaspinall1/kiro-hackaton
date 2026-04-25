import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatProxyImpl, DownstreamService } from '../src/chat-proxy';
import { PrivacyRuleConfig } from '../src/types';

// Mock pdf-parse module (same pattern as pdf-text-extractor.test.ts)
const mockGetText = vi.fn();
const mockDestroy = vi.fn().mockResolvedValue(undefined);

vi.mock('pdf-parse', () => {
  class MockPDFParse {
    constructor(_options: unknown) {}
    getText = mockGetText;
    destroy = mockDestroy;
  }

  class InvalidPDFException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'InvalidPDFException';
    }
  }

  class PasswordException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'PasswordException';
    }
  }

  return {
    PDFParse: MockPDFParse,
    InvalidPDFException,
    PasswordException,
  };
});

// Import spyable modules
import * as piiScanner from '../src/pii-scanner';
import * as redactionEngine from '../src/redaction-engine';
import * as ethicsLogicGate from '../src/ethics-logic-gate';

const redactAllRules: PrivacyRuleConfig = { rules: {} };

describe('Integration: Pipeline ordering and end-to-end', () => {
  let downstream: DownstreamService;
  let proxy: ChatProxyImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    downstream = vi.fn(async () => 'reply');
    proxy = new ChatProxyImpl(downstream);
  });

  describe('Pipeline ordering: Scanner → Redaction_Engine → Ethics_Logic_Gate', () => {
    it('calls scan, then redact, then evaluate in order', async () => {
      const callOrder: string[] = [];

      const scanSpy = vi.spyOn(piiScanner, 'scan').mockImplementation((text) => {
        callOrder.push('scan');
        // Call the real implementation
        scanSpy.mockRestore();
        const result = piiScanner.scan(text);
        // Re-spy for assertion
        vi.spyOn(piiScanner, 'scan');
        return result;
      });

      const redactSpy = vi.spyOn(redactionEngine, 'redact').mockImplementation((text, entities) => {
        callOrder.push('redact');
        redactSpy.mockRestore();
        const result = redactionEngine.redact(text, entities);
        vi.spyOn(redactionEngine, 'redact');
        return result;
      });

      const evaluateSpy = vi.spyOn(ethicsLogicGate, 'evaluate').mockImplementation((entities, rules) => {
        callOrder.push('evaluate');
        evaluateSpy.mockRestore();
        const result = ethicsLogicGate.evaluate(entities, rules);
        vi.spyOn(ethicsLogicGate, 'evaluate');
        return result;
      });

      await proxy.processRequest(
        { prompt: 'Contact me at test@example.com' },
        redactAllRules,
      );

      expect(callOrder).toEqual(['scan', 'redact', 'evaluate']);
    });
  });

  describe('PDF extraction runs before scanning when PDF is attached', () => {
    it('extracts PDF text before scanning the combined text', async () => {
      const pdfText = 'PDF contains user@pdf.com';
      mockGetText.mockResolvedValue({
        text: pdfText,
        total: 1,
        pages: [],
      });

      const scanSpy = vi.spyOn(piiScanner, 'scan');

      const result = await proxy.processRequest(
        { prompt: 'Hello', pdfAttachment: Buffer.from('fake-pdf') },
        redactAllRules,
      );

      // PDF extraction should have been called (mockGetText was invoked)
      expect(mockGetText).toHaveBeenCalled();

      // Scanner should have received the combined text (prompt + PDF text)
      expect(scanSpy).toHaveBeenCalledWith('Hello\n' + pdfText);

      // The PDF email should have been detected and redacted
      expect(result.redactionReport.detectedCounts.EMAIL).toBe(1);
      expect(result.redactionReport.pdfStatus).toBe('processed');
    });
  });

  describe('Blocked message does not contact downstream service', () => {
    it('does not call downstream when message is blocked by SSN block rule', async () => {
      const blockRules: PrivacyRuleConfig = { rules: { SSN: 'block' } };

      const result = await proxy.processRequest(
        { prompt: 'My SSN is 123-45-6789' },
        blockRules,
      );

      expect(result.blocked).toBe(true);
      expect(result.reply).toBeNull();
      expect(downstream).not.toHaveBeenCalled();
      expect(result.notification).not.toBeNull();
      expect(result.notification!.type).toBe('block');
    });
  });

  describe('Allowed message forwards redacted text and returns response + report', () => {
    it('forwards redacted text to downstream and returns reply with report', async () => {
      const result = await proxy.processRequest(
        { prompt: 'Email me at alice@example.com please' },
        redactAllRules,
      );

      expect(result.blocked).toBe(false);
      expect(result.reply).toBe('reply');
      expect(downstream).toHaveBeenCalledWith(
        'Email me at [EMAIL_REDACTED] please',
      );

      // Report should reflect the detection
      expect(result.redactionReport.detectedCounts.EMAIL).toBe(1);
      expect(result.redactionReport.messageHash).toMatch(/^[a-f0-9]{64}$/);
      expect(() => new Date(result.redactionReport.timestamp)).not.toThrow();

      // Notification should describe the redaction
      expect(result.notification).not.toBeNull();
      expect(result.notification!.type).toBe('redaction');
      expect(result.notification!.details.EMAIL).toBe(1);
    });
  });

  describe('Combined text + PDF scanning produces single merged report', () => {
    it('merges PII from prompt and PDF into one report', async () => {
      mockGetText.mockResolvedValue({
        text: 'PDF has 123-45-6789 inside',
        total: 2,
        pages: [],
      });

      const result = await proxy.processRequest(
        {
          prompt: 'Contact alice@example.com',
          pdfAttachment: Buffer.from('fake-pdf'),
        },
        redactAllRules,
      );

      expect(result.blocked).toBe(false);
      expect(result.reply).toBe('reply');

      // Both email (from prompt) and SSN (from PDF) should be in the single report
      expect(result.redactionReport.detectedCounts.EMAIL).toBe(1);
      expect(result.redactionReport.detectedCounts.SSN).toBe(1);
      expect(result.redactionReport.pdfStatus).toBe('processed');

      // Notification should cover both types
      expect(result.notification).not.toBeNull();
      expect(result.notification!.details.EMAIL).toBe(1);
      expect(result.notification!.details.SSN).toBe(1);
    });
  });

  describe('Performance', () => {
    it('Scanner processes 10,000 chars in < 500ms', () => {
      // Build a 10,000 char string with some PII embedded
      const filler = 'Lorem ipsum dolor sit amet. ';
      let text = '';
      while (text.length < 9000) {
        text += filler;
      }
      // Embed some PII
      text += ' Contact user@example.com or call 555-123-4567. SSN: 123-45-6789. ';
      while (text.length < 10000) {
        text += 'x';
      }
      text = text.substring(0, 10000);

      const start = performance.now();
      const entities = piiScanner.scan(text);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
      // Verify it actually found PII (sanity check)
      expect(entities.length).toBeGreaterThan(0);
    });

    it('PDF extractor processes 50 pages in < 3 seconds (mocked)', async () => {
      // Generate text simulating 50 pages
      const pageText = 'Page content with some text. '.repeat(50);
      const fullText = Array.from({ length: 50 }, (_, i) => `Page ${i + 1}: ${pageText}`).join('\n');

      mockGetText.mockResolvedValue({
        text: fullText,
        total: 50,
        pages: [],
      });

      const extractor = new (await import('../src/pdf-text-extractor')).PDFTextExtractorImpl();

      const start = performance.now();
      const result = await extractor.extract(Buffer.from('fake-50-page-pdf'));
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(3000);
      expect(result.pageCount).toBe(50);
      expect(result.extractable).toBe(true);
    });
  });
});
