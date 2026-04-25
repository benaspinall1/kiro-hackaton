"use strict";
/**
 * PII Highlighter — segments message text into plain and highlighted spans
 * based on detected PII entity positions.
 *
 * Validates: Requirements 3.1, 3.3, 3.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.segmentText = segmentText;
/**
 * Segments message text into alternating plain and highlighted spans
 * based on sorted, non-overlapping PII entity positions.
 *
 * - Entities are sorted by startIndex before processing.
 * - Each highlighted segment carries its entity reference for color mapping.
 * - Returns a single unhighlighted segment when the entity array is empty.
 *
 * @param text - The original message text
 * @param entities - Detected PII entities with positions within the text
 * @returns Array of TextSegments covering the full text
 */
function segmentText(text, entities) {
    if (entities.length === 0) {
        return [{ text, isHighlighted: false }];
    }
    const sorted = [...entities].sort((a, b) => a.startIndex - b.startIndex);
    const segments = [];
    let cursor = 0;
    for (const entity of sorted) {
        // Plain text before this entity
        if (entity.startIndex > cursor) {
            segments.push({
                text: text.slice(cursor, entity.startIndex),
                isHighlighted: false,
            });
        }
        // Highlighted segment for the entity
        segments.push({
            text: text.slice(entity.startIndex, entity.endIndex),
            entity,
            isHighlighted: true,
        });
        cursor = entity.endIndex;
    }
    // Remaining plain text after the last entity
    if (cursor < text.length) {
        segments.push({
            text: text.slice(cursor),
            isHighlighted: false,
        });
    }
    return segments;
}
//# sourceMappingURL=pii-highlighter.js.map