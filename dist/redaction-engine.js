"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redact = redact;
const types_1 = require("./types");
const errors_1 = require("./errors");
/**
 * Replaces detected PII entities in text with type-specific placeholders.
 * Processes entities in reverse startIndex order to preserve character positions.
 */
function redact(text, entities) {
    // Validate all entity positions before making any replacements
    for (const entity of entities) {
        if (entity.startIndex < 0 ||
            entity.endIndex > text.length ||
            entity.startIndex > entity.endIndex) {
            throw new errors_1.InvalidEntityError(`Entity positions out of bounds: startIndex=${entity.startIndex}, endIndex=${entity.endIndex}, textLength=${text.length}`);
        }
    }
    // Sort entities in reverse order of startIndex to preserve positions during replacement
    const sorted = [...entities].sort((a, b) => b.startIndex - a.startIndex);
    const redactions = [];
    let redactedText = text;
    for (const entity of sorted) {
        const placeholder = types_1.PLACEHOLDER_MAP[entity.type];
        const originalText = redactedText.substring(entity.startIndex, entity.endIndex);
        redactedText =
            redactedText.substring(0, entity.startIndex) +
                placeholder +
                redactedText.substring(entity.endIndex);
        redactions.push({
            entityType: entity.type,
            originalText,
            placeholder,
            startIndex: entity.startIndex,
            endIndex: entity.endIndex,
        });
    }
    // Return redactions in original (forward) order for consistency
    redactions.reverse();
    return { redactedText, redactions };
}
//# sourceMappingURL=redaction-engine.js.map