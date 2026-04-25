import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { scan } from './pii-scanner';
import { redact } from './redaction-engine';
import { PIIType, PLACEHOLDER_MAP } from './types';

/**
 * Feature: pii-redaction-filter, Property 3: Correct Redaction with Type-Specific Placeholders
 *
 * For any text containing one or more detected PII entities (including multiple
 * entities of the same type), the Redaction_Engine SHALL replace each entity with
 * its type-specific placeholder, and the redacted text SHALL contain exactly as
 * many placeholders of each type as there were detected entities of that type.
 *
 * Validates: Requirements 2.1, 2.2, 2.4
 */

const ALL_TYPES: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];

// ---------------------------------------------------------------------------
// Helper: count occurrences of a substring in a string
// ---------------------------------------------------------------------------

function countOccurrences(text: string, sub: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(sub, idx)) !== -1) {
    count++;
    idx += sub.length;
  }
  return count;
}

// ---------------------------------------------------------------------------
// PII Generators — each produces a value that only matches its intended type.
//
// CRITICAL: Values are embedded between non-alphanumeric padding ("=====")
// to prevent cross-type pattern formation. The padding contains no letters
// or digits, so it cannot form part of any PII pattern (addresses, emails,
// phones, SSNs, credit cards, or file paths).
// ---------------------------------------------------------------------------

const PAD = '=====';

const lowerAlpha = 'abcdefghijklmnopqrstuvwxyz';

const emailValue = fc
  .tuple(
    fc.string({ minLength: 2, maxLength: 6, unit: fc.constantFrom(...lowerAlpha.split('')) }),
    fc.string({ minLength: 2, maxLength: 6, unit: fc.constantFrom(...lowerAlpha.split('')) }),
    fc.constantFrom('com', 'org', 'net', 'io'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

const phoneValue = fc
  .tuple(
    fc.integer({ min: 200, max: 999 }),
    fc.integer({ min: 200, max: 999 }),
    fc.integer({ min: 1000, max: 9999 }),
  )
  .map(([a, m, l]) => `(${a}) ${m}-${l}`);

const ssnValue = fc
  .tuple(
    fc.integer({ min: 100, max: 999 }),
    fc.integer({ min: 10, max: 99 }),
    fc.integer({ min: 1000, max: 9999 }),
  )
  .map(([a, b, c]) => `${a}-${b}-${c}`);

const creditCardValue = fc
  .tuple(
    fc.integer({ min: 1000, max: 9999 }),
    fc.integer({ min: 1000, max: 9999 }),
    fc.integer({ min: 1000, max: 9999 }),
    fc.integer({ min: 1000, max: 9999 }),
  )
  .map(([a, b, c, d]) => `${a} ${b} ${c} ${d}`);

const addressValue = fc
  .tuple(
    fc.integer({ min: 1, max: 99999 }),
    fc.constantFrom('Main', 'Oak', 'Elm', 'Pine', 'Maple'),
    fc.constantFrom('Street', 'Avenue', 'Drive', 'Road', 'Lane'),
  )
  .map(([num, name, suffix]) => `${num} ${name} ${suffix}`);

const filePathValue = fc
  .array(
    fc.string({ minLength: 2, maxLength: 6, unit: fc.constantFrom(...lowerAlpha.split('')) }),
    { minLength: 1, maxLength: 3 },
  )
  .map((comps) => '/' + comps.join('/'));

const singlePiiValue = fc.oneof(
  emailValue,
  phoneValue,
  ssnValue,
  creditCardValue,
  addressValue,
  filePathValue,
);

/**
 * Build text from PII values with non-alphanumeric padding between them.
 * Each PII value is on its own line surrounded by "=====" which contains
 * no letters or digits, preventing any cross-type pattern formation.
 */
function buildText(piiItems: string[]): string {
  return piiItems
    .map((pii) => `${PAD} ${pii} ${PAD}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Property 3
// ---------------------------------------------------------------------------

describe('Feature: pii-redaction-filter, Property 3: Correct Redaction with Type-Specific Placeholders', () => {
  it('placeholder counts in redacted text match entity counts per type', () => {
    fc.assert(
      fc.property(
        fc.array(singlePiiValue, { minLength: 1, maxLength: 5 }),
        (piiItems) => {
          const text = buildText(piiItems);
          const entities = scan(text);
          const { redactedText } = redact(text, entities);

          // Count entities per type from scan results
          const entityCounts: Partial<Record<PIIType, number>> = {};
          for (const entity of entities) {
            entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;
          }

          // Verify placeholder counts match
          for (const piiType of ALL_TYPES) {
            const placeholder = PLACEHOLDER_MAP[piiType];
            const placeholderCount = countOccurrences(redactedText, placeholder);
            const expectedCount = entityCounts[piiType] || 0;
            expect(placeholderCount).toBe(expectedCount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Property 4: Non-PII Text Preservation
// ---------------------------------------------------------------------------

/**
 * Feature: pii-redaction-filter, Property 4: Non-PII Text Preservation
 *
 * For any text and set of detected PII entities, after redaction, all characters
 * in the original text that were not part of any PII entity span SHALL remain
 * unchanged in the redacted output at their corresponding positions.
 *
 * Validates: Requirements 2.3
 */
describe('Feature: pii-redaction-filter, Property 4: Non-PII Text Preservation', () => {
  it('all non-PII segments remain unchanged after redaction', () => {
    fc.assert(
      fc.property(
        fc.array(singlePiiValue, { minLength: 1, maxLength: 5 }),
        (piiItems) => {
          const text = buildText(piiItems);
          const entities = scan(text);
          const { redactedText } = redact(text, entities);

          // Build sorted entity spans
          const spans = entities
            .map((e) => ({ start: e.startIndex, end: e.endIndex }))
            .sort((a, b) => a.start - b.start);

          // Strip all placeholders from redacted text
          let stripped = redactedText;
          for (const piiType of ALL_TYPES) {
            const placeholder = PLACEHOLDER_MAP[piiType];
            while (stripped.includes(placeholder)) {
              stripped = stripped.replace(placeholder, '');
            }
          }

          // Remove PII spans from original (reverse order to preserve indices)
          let originalNonPii = text;
          const reversedSpans = [...spans].sort((a, b) => b.start - a.start);
          for (const span of reversedSpans) {
            originalNonPii =
              originalNonPii.substring(0, span.start) +
              originalNonPii.substring(span.end);
          }

          expect(stripped).toBe(originalNonPii);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Property 5: Redaction Round-Trip
// ---------------------------------------------------------------------------

/**
 * Feature: pii-redaction-filter, Property 5: Redaction Round-Trip
 *
 * For any valid input text, scanning for PII, redacting all detected entities,
 * and then scanning the redacted output again SHALL yield zero PII entities.
 *
 * Validates: Requirements 2.5, 8.5
 */
describe('Feature: pii-redaction-filter, Property 5: Redaction Round-Trip', () => {
  it('scan → redact → scan again yields zero PII entities', () => {
    fc.assert(
      fc.property(
        fc.array(singlePiiValue, { minLength: 1, maxLength: 5 }),
        (piiItems) => {
          const text = buildText(piiItems);
          const entities = scan(text);
          const { redactedText } = redact(text, entities);
          const secondScanEntities = scan(redactedText);

          expect(secondScanEntities).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
