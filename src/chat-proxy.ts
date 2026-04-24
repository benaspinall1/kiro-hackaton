import { createHash } from 'node:crypto';
import {
  ChatRequest,
  ChatResponse,
  RedactionReport,
  ReportAction,
  PIIEntity,
  PIIType,
  PrivacyRuleConfig,
  RedactionResult,
  GateResult,
  PIINotification,
} from './types';
import { scan } from './pii-scanner';
import { redact } from './redaction-engine';
import { evaluate } from './ethics-logic-gate';
import { createRedactionNotification, createBlockNotification } from './notification-service';
import { PDFTextExtractorImpl } from './pdf-text-extractor';
import {
  PDFCorruptedError,
  PDFPasswordProtectedError,
  PDFPageLimitError,
  PDFTimeoutError,
} from './errors';

/**
 * Downstream chat service function type.
 */
export type DownstreamService = (message: string) => Promise<string>;

/**
 * Builds a zero-count record for all PII types.
 */
function zeroCounts(): Record<PIIType, number> {
  return {
    EMAIL: 0,
    PHONE: 0,
    SSN: 0,
    CREDIT_CARD: 0,
    ADDRESS: 0,
    FILE_PATH: 0,
  };
}

/**
 * Generates a SHA-256 hex hash of the given text.
 */
function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Builds a RedactionReport from pipeline results.
 */
function buildReport(
  originalMessage: string,
  entities: PIIEntity[],
  gateResult: GateResult,
  pdfStatus: 'processed' | 'unprocessable' | 'error' | 'none',
): RedactionReport {
  const detectedCounts = zeroCounts();
  for (const entity of entities) {
    detectedCounts[entity.type]++;
  }

  let actions: ReportAction[];
  if (entities.length === 0) {
    actions = [{ entityType: 'EMAIL', action: 'none' }];
  } else if (!gateResult.allowed) {
    actions = entities.map((e) => ({
      entityType: e.type,
      action: (gateResult.blockedTypes.includes(e.type) ? 'blocked' : 'redacted') as 'blocked' | 'redacted',
    }));
  } else {
    actions = entities.map((e) => ({
      entityType: e.type,
      action: 'redacted' as const,
    }));
  }

  return {
    messageHash: sha256(originalMessage),
    detectedCounts,
    actions,
    timestamp: new Date().toISOString(),
    pdfStatus,
  };
}

/**
 * Chat_Proxy orchestrates the PII redaction pipeline.
 *
 * Pipeline: PDF extraction (if attached) → PII scan → redaction → Ethics_Logic_Gate → forward or block.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 9.3, 9.8
 */
export class ChatProxyImpl {
  private downstream: DownstreamService;
  private pdfExtractor: PDFTextExtractorImpl;

  constructor(downstream: DownstreamService) {
    this.downstream = downstream;
    this.pdfExtractor = new PDFTextExtractorImpl();
  }

  async processRequest(request: ChatRequest, rules: PrivacyRuleConfig): Promise<ChatResponse> {
    try {
      return await this.executePipeline(request, rules);
    } catch (error) {
      // Fail-safe: block the message on any unhandled error
      const report = buildReport(
        request.prompt,
        [],
        { allowed: false, blockedTypes: [], reason: 'Unhandled error' },
        request.pdfAttachment ? 'error' : 'none',
      );
      return {
        reply: null,
        redactionReport: report,
        notification: null,
        blocked: true,
        error: `Pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async executePipeline(request: ChatRequest, rules: PrivacyRuleConfig): Promise<ChatResponse> {
    const originalMessage = request.prompt;
    let pdfText = '';
    let pdfStatus: 'processed' | 'unprocessable' | 'error' | 'none' = 'none';

    // Step 1: PDF extraction (if attached)
    if (request.pdfAttachment) {
      try {
        const pdfResult = await this.pdfExtractor.extract(request.pdfAttachment);
        if (pdfResult.extractable) {
          pdfText = pdfResult.text;
          pdfStatus = 'processed';
        } else {
          pdfStatus = 'unprocessable';
        }
      } catch (error) {
        if (
          error instanceof PDFCorruptedError ||
          error instanceof PDFPasswordProtectedError ||
          error instanceof PDFPageLimitError ||
          error instanceof PDFTimeoutError
        ) {
          const report = buildReport(originalMessage, [], { allowed: false, blockedTypes: [], reason: null }, 'error');
          return {
            reply: null,
            redactionReport: report,
            notification: null,
            blocked: true,
            error: error.message,
          };
        }
        throw error;
      }
    }

    // Combine prompt and PDF text for scanning
    const fullText = pdfText ? `${originalMessage}\n${pdfText}` : originalMessage;

    // Step 2: PII scan
    const entities = scan(fullText);

    // Step 3: Redaction
    let redactionResult: RedactionResult;
    redactionResult = redact(fullText, entities);

    // Step 4: Ethics Logic Gate
    const gateResult = evaluate(entities, rules);

    // Build the report
    const report = buildReport(originalMessage, entities, gateResult, pdfStatus);

    // Step 5: Block or forward
    if (!gateResult.allowed) {
      const notification = createBlockNotification(
        gateResult.blockedTypes,
        gateResult.reason ?? 'Message blocked by privacy rules',
      );
      return {
        reply: null,
        redactionReport: report,
        notification,
        blocked: true,
      };
    }

    // Create redaction notification (null if no PII)
    const notification = createRedactionNotification(redactionResult.redactions);

    // Step 6: Forward to downstream
    let reply: string;
    try {
      reply = await this.downstream(redactionResult.redactedText);
    } catch (error) {
      return {
        reply: null,
        redactionReport: report,
        notification,
        blocked: false,
        error: `Downstream service error: ${error instanceof Error ? error.message : 'Service unavailable'}`,
      };
    }

    return {
      reply,
      redactionReport: report,
      notification,
      blocked: false,
    };
  }
}
