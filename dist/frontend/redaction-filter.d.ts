/**
 * Selective redaction filtering logic for the PrivacyLens panel.
 *
 * Provides functions to filter PII items based on user toggle state
 * and to enable all redaction toggles at once.
 */
import type { PIIEntity } from '../types';
import type { PIIItemState } from './types';
/**
 * Returns only the entities where redaction is enabled, preserving original order.
 *
 * Validates: Requirements 6.1, 6.2
 *
 * @param items - Array of PII item states with toggle values
 * @returns Array of PIIEntity references for items with `redactionEnabled === true`
 */
export declare function filterEnabledEntities(items: PIIItemState[]): PIIEntity[];
/**
 * Returns a new array with all redaction toggles set to true.
 * Entity object references are preserved (not cloned).
 *
 * Validates: Requirement 6.3
 *
 * @param items - Array of PII item states with arbitrary toggle values
 * @returns New array where every item has `redactionEnabled: true`
 */
export declare function autoRedactAll(items: PIIItemState[]): PIIItemState[];
//# sourceMappingURL=redaction-filter.d.ts.map