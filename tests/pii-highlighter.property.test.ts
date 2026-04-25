import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { segmentText } from '../src/frontend/pii-highlighter';
import type { PIIEntity } from '../src/types';
import type { PIIType } from '../src/types';

/**
 * Feature: chat-frontend-pii-panel, Property 1: Text Segmentation Preserves Original Text
 *
 * For any message text and any valid sorted array of non-overlapping PIIEntity
 * positions within that text, the segmentText function SHALL produce an array
 * of TextSegments where:
 *   (a) concatenating all segment .text values reproduces the original message text exactly,
 *   (b) each segment marked isHighlighted: true has .text equal to the corresponding
 *       entity's matchedText,
 *   (c) when the entity array is empty, the result is a single unhighlighted segment
 *       containing the full text.
 *
 * Validates: Requirements 3.1, 3.3, 3.4
 */

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const piiTypes: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];

const piiTypeArb = fc.constantFrom(...piiTypes);

/**
 * Generate a random string of length 1–500 and a sorted, non-overlapping
 * array of PIIEntity spans within that string.
 */
const textWithEntitiesArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .chain((text) => {
    const len = text.length;

    // Generate sorted non-overlapping spans as [startIndex, endIndex] pairs
    const spansArb = fc
      .array(
        fc.tuple(
          fc.integer({ min: 0, max: len - 1 }),
          fc.integer({ min: 1, max: len })
        ),
        { minLength: 0, maxLength: 10 }
      )
      .map((rawPairs) => {
        // Convert to valid spans and filter to non-overlapping
        const candidates = rawPairs
          .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number])
          .filter(([s, e]) => s < e && e <= len)
          .sort((a, b) => a[0] - b[0]);

        const nonOverlapping: [number, number][] = [];
        for (const span of candidates) {
          const last = nonOverlapping[nonOverlapping.length - 1];
          if (!last || span[0] >= last[1]) {
            nonOverlapping.push(span);
          }
        }
        return nonOverlapping;
      });

    return fc.tuple(
      fc.constant(text),
      spansArb,
      fc.array(piiTypeArb, { minLength: 10, maxLength: 10 })
    );
  })
  .map(([text, spans, types]) => {
    const entities: PIIEntity[] = spans.map((span, i) => ({
      type: types[i % types.length],
      matchedText: text.slice(span[0], span[1]),
      startIndex: span[0],
      endIndex: span[1],
    }));
    return { text, entities };
  });

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe('Feature: chat-frontend-pii-panel, Property 1: Text Segmentation Preserves Original Text', () => {
  it('(a) concatenating all segment texts reproduces the original text, (b) highlighted segments match entity matchedText', () => {
    fc.assert(
      fc.property(textWithEntitiesArb, ({ text, entities }) => {
        const segments = segmentText(text, entities);

        // (a) Concatenation preserves original text
        const reconstructed = segments.map((s) => s.text).join('');
        expect(reconstructed).toBe(text);

        // (b) Highlighted segments match entity matchedText
        const highlighted = segments.filter((s) => s.isHighlighted);
        expect(highlighted.length).toBe(entities.length);
        for (const seg of highlighted) {
          expect(seg.entity).toBeDefined();
          expect(seg.text).toBe(seg.entity!.matchedText);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('(c) empty entity array produces a single unhighlighted segment containing the full text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (text) => {
          const segments = segmentText(text, []);
          expect(segments).toHaveLength(1);
          expect(segments[0].text).toBe(text);
          expect(segments[0].isHighlighted).toBe(false);
          expect(segments[0].entity).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
