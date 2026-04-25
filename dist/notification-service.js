"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedactionNotification = createRedactionNotification;
exports.createBlockNotification = createBlockNotification;
/**
 * Creates a redaction notification with per-type counts from the redaction actions list.
 * Returns null when the redactions list is empty (no PII detected).
 * Validates: Requirements 4.1, 4.3, 4.4
 */
function createRedactionNotification(redactions) {
    if (redactions.length === 0) {
        return null;
    }
    const details = buildZeroCounts();
    for (const action of redactions) {
        details[action.entityType]++;
    }
    const typeSummaries = Object.entries(details)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
    return {
        type: 'redaction',
        message: `PII detected and redacted: ${typeSummaries}.`,
        details,
    };
}
/**
 * Creates a block notification listing the blocked PII types and reason.
 * Validates: Requirements 4.2, 4.3
 */
function createBlockNotification(blockedTypes, reason) {
    const details = buildZeroCounts();
    for (const piiType of blockedTypes) {
        details[piiType]++;
    }
    return {
        type: 'block',
        message: `Message blocked: ${reason}. Blocked PII types: ${blockedTypes.join(', ')}.`,
        details,
    };
}
/**
 * Builds a Record<PIIType, number> initialized to zero for all supported types.
 */
function buildZeroCounts() {
    return {
        EMAIL: 0,
        PHONE: 0,
        SSN: 0,
        CREDIT_CARD: 0,
        ADDRESS: 0,
        FILE_PATH: 0,
    };
}
//# sourceMappingURL=notification-service.js.map