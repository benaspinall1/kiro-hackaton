import { PIINotification, PIIType, RedactionAction } from './types';

/**
 * Creates a redaction notification with per-type counts from the redaction actions list.
 * Returns null when the redactions list is empty (no PII detected).
 * Validates: Requirements 4.1, 4.3, 4.4
 */
export function createRedactionNotification(redactions: RedactionAction[]): PIINotification | null {
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
export function createBlockNotification(blockedTypes: PIIType[], reason: string): PIINotification {
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
function buildZeroCounts(): Record<PIIType, number> {
  return {
    EMAIL: 0,
    PHONE: 0,
    SSN: 0,
    CREDIT_CARD: 0,
    ADDRESS: 0,
    FILE_PATH: 0,
  };
}
