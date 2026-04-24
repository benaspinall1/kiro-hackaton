import { PIIEntity, RedactionAction, RedactionResult, PLACEHOLDER_MAP } from './types';
import { InvalidEntityError } from './errors';

/**
 * Replaces detected PII entities in text with type-specific placeholders.
 * Processes entities in reverse startIndex order to preserve character positions.
 */
export function redact(text: string, entities: PIIEntity[]): RedactionResult {
  // Validate all entity positions before making any replacements
  for (const entity of entities) {
    if (
      entity.startIndex < 0 ||
      entity.endIndex > text.length ||
      entity.startIndex > entity.endIndex
    ) {
      throw new InvalidEntityError(
        `Entity positions out of bounds: startIndex=${entity.startIndex}, endIndex=${entity.endIndex}, textLength=${text.length}`
      );
    }
  }

  // Sort entities in reverse order of startIndex to preserve positions during replacement
  const sorted = [...entities].sort((a, b) => b.startIndex - a.startIndex);

  const redactions: RedactionAction[] = [];
  let redactedText = text;

  for (const entity of sorted) {
    const placeholder = PLACEHOLDER_MAP[entity.type];
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
