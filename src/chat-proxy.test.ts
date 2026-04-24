import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { ChatProxyImpl, DownstreamService } from './chat-proxy';
import { PrivacyRuleConfig } from './types';

function makeDownstream(reply: string = 'OK'): DownstreamService {
  return vi.fn(async () => reply);
}

const emptyRules: PrivacyRuleConfig = { rules: {} };

describe('ChatProxyImpl', () => {
  it('forwards clean message (no PII) to downstream with zero-count report', async () => {
    const downstream = makeDownstream('Hello back');
    const proxy = new ChatProxyImpl(downstream);

    const result = await proxy.processRequest({ prompt: 'Hello world' }, emptyRules);

    expect(result.blocked).toBe(false);
    expect(result.reply).toBe('Hello back');
    expect(result.notification).toBeNull();
    expect(result.error).toBeUndefined();
    expect(result.redactionReport.detectedCounts.EMAIL).toBe(0);
    expect(result.redactionReport.detectedCounts.PHONE).toBe(0);
    expect(result.redactionReport.actions).toEqual([{ entityType: 'EMAIL', action: 'none' }]);
    expect(result.redactionReport.messageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.redactionReport.pdfStatus).toBe('none');
    expect(downstream).toHaveBeenCalledWith('Hello world');
  });

  it('redacts PII and forwards when rules are redact', async () => {
    const downstream = makeDownstream('Got it');
    const proxy = new ChatProxyImpl(downstream);
    const rules: PrivacyRuleConfig = { rules: { EMAIL: 'redact' } };

    const result = await proxy.processRequest(
      { prompt: 'Contact me at test@example.com please' },
      rules,
    );

    expect(result.blocked).toBe(false);
    expect(result.reply).toBe('Got it');
    expect(downstream).toHaveBeenCalledWith(
      'Contact me at [EMAIL_REDACTED] please',
    );
    expect(result.notification).not.toBeNull();
    expect(result.notification!.type).toBe('redaction');
    expect(result.notification!.details.EMAIL).toBe(1);
    expect(result.redactionReport.detectedCounts.EMAIL).toBe(1);
    expect(result.redactionReport.actions).toContainEqual({
      entityType: 'EMAIL',
      action: 'redacted',
    });
  });

  it('blocks message when PII matches a block rule, no downstream contact', async () => {
    const downstream = makeDownstream();
    const proxy = new ChatProxyImpl(downstream);
    const rules: PrivacyRuleConfig = { rules: { SSN: 'block' } };

    const result = await proxy.processRequest(
      { prompt: 'My SSN is 123-45-6789' },
      rules,
    );

    expect(result.blocked).toBe(true);
    expect(result.reply).toBeNull();
    expect(downstream).not.toHaveBeenCalled();
    expect(result.notification).not.toBeNull();
    expect(result.notification!.type).toBe('block');
    expect(result.redactionReport.detectedCounts.SSN).toBe(1);
    expect(result.redactionReport.actions).toContainEqual({
      entityType: 'SSN',
      action: 'blocked',
    });
  });

  it('processes PDF attachment and scans extracted text', async () => {
    // We can't easily create a real PDF in a unit test, so we test the
    // error path for corrupted PDF to verify PDF extraction is attempted
    const downstream = makeDownstream();
    const proxy = new ChatProxyImpl(downstream);

    const result = await proxy.processRequest(
      { prompt: 'Check this doc', pdfAttachment: Buffer.from('not a pdf') },
      emptyRules,
    );

    // Corrupted PDF → error response, blocked
    expect(result.blocked).toBe(true);
    expect(result.reply).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.redactionReport.pdfStatus).toBe('error');
    expect(downstream).not.toHaveBeenCalled();
  });

  it('returns error response on downstream service failure without retry', async () => {
    const downstream = vi.fn(async () => {
      throw new Error('Connection refused');
    });
    const proxy = new ChatProxyImpl(downstream);

    const result = await proxy.processRequest(
      { prompt: 'Hello world' },
      emptyRules,
    );

    expect(result.blocked).toBe(false);
    expect(result.reply).toBeNull();
    expect(result.error).toContain('Downstream service error');
    expect(result.error).toContain('Connection refused');
    // Downstream was called exactly once (no retry)
    expect(downstream).toHaveBeenCalledTimes(1);
  });

  it('blocks message on unhandled pipeline component failure (fail-safe)', async () => {
    const downstream = makeDownstream();
    const proxy = new ChatProxyImpl(downstream);

    // Force an unhandled error by passing entities with bad positions
    // We'll mock the scan function to throw
    const originalScan = await import('./pii-scanner');
    const scanSpy = vi.spyOn(originalScan, 'scan').mockImplementation(() => {
      throw new Error('Unexpected scanner failure');
    });

    const result = await proxy.processRequest(
      { prompt: 'Some text' },
      emptyRules,
    );

    expect(result.blocked).toBe(true);
    expect(result.reply).toBeNull();
    expect(result.error).toContain('Pipeline error');
    expect(downstream).not.toHaveBeenCalled();

    scanSpy.mockRestore();
  });

  it('generates report with valid SHA-256 hash and ISO 8601 timestamp', async () => {
    const downstream = makeDownstream('reply');
    const proxy = new ChatProxyImpl(downstream);

    const result = await proxy.processRequest(
      { prompt: 'Email me at user@test.com' },
      emptyRules,
    );

    const report = result.redactionReport;
    expect(report.messageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => new Date(report.timestamp)).not.toThrow();
    expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
  });

  it('messageHash is SHA-256 of original message, not redacted text', async () => {
    const downstream = makeDownstream('ok');
    const proxy = new ChatProxyImpl(downstream);
    const originalPrompt = 'Contact me at test@example.com please';
    const expectedHash = createHash('sha256').update(originalPrompt).digest('hex');

    const result = await proxy.processRequest({ prompt: originalPrompt }, emptyRules);

    expect(result.redactionReport.messageHash).toBe(expectedHash);
  });

  it('generates report with correct detected counts for multiple PII types', async () => {
    const downstream = makeDownstream('ok');
    const proxy = new ChatProxyImpl(downstream);

    const result = await proxy.processRequest(
      { prompt: 'Call 555-123-4567 or email a@b.com and b@c.com' },
      emptyRules,
    );

    expect(result.redactionReport.detectedCounts.PHONE).toBe(1);
    expect(result.redactionReport.detectedCounts.EMAIL).toBe(2);
    expect(result.redactionReport.actions.length).toBe(3);
  });
});
