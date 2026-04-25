"use strict";
/**
 * Selective redaction filtering logic for the PrivacyLens panel.
 *
 * Provides functions to filter PII items based on user toggle state
 * and to enable all redaction toggles at once.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterEnabledEntities = filterEnabledEntities;
exports.autoRedactAll = autoRedactAll;
/**
 * Returns only the entities where redaction is enabled, preserving original order.
 *
 * Validates: Requirements 6.1, 6.2
 *
 * @param items - Array of PII item states with toggle values
 * @returns Array of PIIEntity references for items with `redactionEnabled === true`
 */
function filterEnabledEntities(items) {
    return items
        .filter((item) => item.redactionEnabled)
        .map((item) => item.entity);
}
/**
 * Returns a new array with all redaction toggles set to true.
 * Entity object references are preserved (not cloned).
 *
 * Validates: Requirement 6.3
 *
 * @param items - Array of PII item states with arbitrary toggle values
 * @returns New array where every item has `redactionEnabled: true`
 */
function autoRedactAll(items) {
    return items.map((item) => ({
        entity: item.entity,
        redactionEnabled: true,
    }));
}
//# sourceMappingURL=redaction-filter.js.map