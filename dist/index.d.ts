export type { PIIType, PIIEntity, RedactionAction, RedactionResult, GateResult, PrivacyAction, PrivacyRuleConfig, PIINotification, PDFExtractionResult, ChatRequest, ChatResponse, ReportAction, RedactionReport, } from './types';
export { PLACEHOLDER_MAP } from './types';
export { InvalidEntityError, PDFCorruptedError, PDFPasswordProtectedError, PDFPageLimitError, PDFTimeoutError, } from './errors';
export { scan } from './pii-scanner';
export { redact } from './redaction-engine';
export { evaluate, validateConfig } from './ethics-logic-gate';
export { createRedactionNotification, createBlockNotification } from './notification-service';
export { PDFTextExtractorImpl } from './pdf-text-extractor';
export { ChatProxyImpl } from './chat-proxy';
export type { DownstreamService } from './chat-proxy';
/**
 * Convenience factory that wires all pipeline components together
 * and returns a ready-to-use ChatProxyImpl instance.
 */
export declare function createChatProxy(downstream: (message: string) => Promise<string>): ChatProxyImpl;
//# sourceMappingURL=index.d.ts.map