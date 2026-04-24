/**
 * Supported PII entity types.
 */
export type PIIType = 'EMAIL' | 'PHONE' | 'SSN' | 'CREDIT_CARD' | 'ADDRESS' | 'FILE_PATH';

/**
 * A detected PII entity with its type, matched text, and position in the source string.
 */
export interface PIIEntity {
  type: PIIType;
  matchedText: string;
  startIndex: number;
  endIndex: number;
}

/**
 * A single redaction action recording what was replaced.
 */
export interface RedactionAction {
  entityType: PIIType;
  originalText: string;
  placeholder: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Result of redacting PII from text.
 */
export interface RedactionResult {
  redactedText: string;
  redactions: RedactionAction[];
}

/**
 * Result of the Ethics Logic Gate evaluation.
 */
export interface GateResult {
  allowed: boolean;
  blockedTypes: PIIType[];
  reason: string | null;
}

/**
 * Privacy action for a PII type: block the message or redact the entity.
 */
export type PrivacyAction = 'block' | 'redact';

/**
 * Configuration mapping PII types to privacy actions.
 * Missing types default to 'redact'.
 */
export interface PrivacyRuleConfig {
  rules: Partial<Record<PIIType, PrivacyAction>>;
}

/**
 * Notification sent to the user about PII actions taken.
 */
export interface PIINotification {
  type: 'redaction' | 'block';
  message: string;
  details: Record<PIIType, number>;
}

/**
 * Result of extracting text from a PDF document.
 */
export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  extractable: boolean;
  error?: string;
}

/**
 * Incoming chat request with optional PDF attachment.
 */
export interface ChatRequest {
  prompt: string;
  pdfAttachment?: Buffer;
}

/**
 * Action recorded in a redaction report for a single entity.
 */
export interface ReportAction {
  entityType: PIIType;
  action: 'redacted' | 'blocked' | 'none';
}

/**
 * Structured audit report of PII detections and actions for a message.
 */
export interface RedactionReport {
  messageHash: string;
  detectedCounts: Record<PIIType, number>;
  actions: ReportAction[];
  timestamp: string;
  pdfStatus?: 'processed' | 'unprocessable' | 'error' | 'none';
}

/**
 * Response returned from the Chat Proxy to the caller.
 */
export interface ChatResponse {
  reply: string | null;
  redactionReport: RedactionReport;
  notification: PIINotification | null;
  blocked: boolean;
  error?: string;
}

/**
 * Type-specific placeholder map for redaction.
 * Validates: Requirements 2.2, 10.7
 */
export const PLACEHOLDER_MAP: Record<PIIType, string> = {
  EMAIL: '[EMAIL_REDACTED]',
  PHONE: '[PHONE_REDACTED]',
  SSN: '[SSN_REDACTED]',
  CREDIT_CARD: '[CREDIT_CARD_REDACTED]',
  ADDRESS: '[ADDRESS_REDACTED]',
  FILE_PATH: '[FILE_PATH_REDACTED]',
};
