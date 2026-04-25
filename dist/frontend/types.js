"use strict";
/**
 * Frontend-specific types and constants for the Chat Frontend PII Panel.
 *
 * Re-exports shared backend types and defines frontend-only interfaces,
 * color mappings, and risk level classifications.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RISK_LEVEL_MAP = exports.PII_COLOR_MAP = void 0;
exports.getRiskLevel = getRiskLevel;
exports.getPIIIcon = getPIIIcon;
/**
 * Background color map for inline PII highlighting.
 * Each PIIType maps to a CSS background color string.
 * Validates: Requirement 3.2
 */
exports.PII_COLOR_MAP = {
    EMAIL: '#DBEAFE', // blue
    PHONE: '#FFEDD5', // orange
    SSN: '#FEE2E2', // red
    CREDIT_CARD: '#F3E8FF', // purple
    ADDRESS: '#DCFCE7', // green
    FILE_PATH: '#F3F4F6', // gray
};
/**
 * Risk level classification for each PII type.
 * Validates: Requirement 5.3
 */
exports.RISK_LEVEL_MAP = {
    SSN: 'High Risk',
    CREDIT_CARD: 'High Risk',
    EMAIL: 'Medium Risk',
    PHONE: 'Medium Risk',
    ADDRESS: 'Low Risk',
    FILE_PATH: 'Low Risk',
};
/**
 * Icon identifier map for each PII type.
 */
const PII_ICON_MAP = {
    EMAIL: '📧',
    PHONE: '📱',
    SSN: '🔒',
    CREDIT_CARD: '💳',
    ADDRESS: '🏠',
    FILE_PATH: '📁',
};
/**
 * Returns the risk level classification for a given PII type.
 * Validates: Requirement 5.3
 */
function getRiskLevel(type) {
    return exports.RISK_LEVEL_MAP[type];
}
/**
 * Returns a type-appropriate icon identifier for a given PII type.
 * Validates: Requirement 5.1
 */
function getPIIIcon(type) {
    return PII_ICON_MAP[type];
}
//# sourceMappingURL=types.js.map