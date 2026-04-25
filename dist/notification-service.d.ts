import { PIINotification, PIIType, RedactionAction } from './types';
/**
 * Creates a redaction notification with per-type counts from the redaction actions list.
 * Returns null when the redactions list is empty (no PII detected).
 * Validates: Requirements 4.1, 4.3, 4.4
 */
export declare function createRedactionNotification(redactions: RedactionAction[]): PIINotification | null;
/**
 * Creates a block notification listing the blocked PII types and reason.
 * Validates: Requirements 4.2, 4.3
 */
export declare function createBlockNotification(blockedTypes: PIIType[], reason: string): PIINotification;
//# sourceMappingURL=notification-service.d.ts.map