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

// ---------------------------------------------------------------------------
// Helpers: safe surrounding text (no accidental PII patterns)
// ---------------------------------------------------------------------------

/**
 * Fixed list of safe words that:
 * - contain only lowercase letters
 * - do NOT match any street type suffix (street, st, avenue, ave, boulevard,
 *   blvd, drive, dr, lane, ln, road, rd, court, ct, way, place, pl, circle,
 *   cir, terrace, ter, trail, trl, parkway, pkwy, highway, hwy) even as a
 *   substring when combined with adjacent text
 * - cannot form PII patterns (no digits, no @, no special chars)
 */
const SAFE_WORDS = [
  'lorem', 'ipsum', 'quick', 'brown', 'fox', 'jumps',
  'lazy', 'hello', 'gamma', 'kappa', 'zulu', 'nexus',
  'pixel', 'quaff', 'joker', 'vivid', 'waltz', 'xenon',
];

const safeWord = fc.constantFrom(...SAFE_WORDS);

/** Safe separator built from known-safe words — cannot accidentally form PII patterns */
const safeSeparator = fc
  .array(safeWord, { minLength: 1, maxLength: 3 })
  .map((words) => words.join(' '));

// ---------------------------------------------------------------------------
// PII Generators (one per type)
// ---------------------------------------------------------------------------

const digit = fc.constantFrom(...'0123456789'.split(''));
const digitString = (len: number) =>
  fc.tuple(...Array.from({ length: len }, () => digit)).map((ds) => ds.join(''));

const lowerAlpha = 'abcdefghijklmnopqrstuvwxyz';

const emailGen = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 8, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')) }),
    fc.string({ minLength: 1, maxLength: 8, unit: fc.constantFrom(...lowerAlpha.split('')) }),
    fc.constantFrom('com', 'org', 'net', 'io')
  )
  .map(([local, domain, tld]) => ({
    type: 'EMAIL' as PIIType,
    value: `${local}@${domain}.${tld}`,
  }));

const phoneGen = fc
  .tuple(digitString(3), digitString(3), digitString(4))
  .map(([area, mid, last]) => ({
    type: 'PHONE' as PIIType,
    value: `${area}-${mid}-${last}`,
  }));

const ssnGen = fc
  .tuple(digitString(3), digitString(2), digitString(4))
  .map(([a, b, c]) => ({
    type: 'SSN' as PIIType,
    value: `${a}-${b}-${c}`,
  }));

const creditCardGen = digitString(16).map((digits) => ({
  type: 'CREDIT_CARD' as PIIType,
  value: digits,
}));

const addressGen = fc
  .tuple(
    fc.integer({ min: 1, max: 99999 }),
    fc.constantFrom('Main', 'Oak', 'Elm', 'Pine', 'Maple'),
    fc.constantFrom('Street', 'Avenue', 'Drive', 'Road', 'Lane')
  )
  .map(([num, name, suffix]) => ({
    type: 'ADDRESS' as PIIType,
    value: `${num} ${name} ${suffix}`,
  }));

const pathChars = 'abcdefghijklmnopqrstuvwxyz0123456789._-';
const pathComponent = fc
  .tuple(
    fc.constantFrom(...pathChars.split('')),
    fc.string({ minLength: 1, maxLength: 6, unit: fc.constantFrom(...pathChars.split('')) })
  )
  .map(([first, rest]) => first + rest);

const filePathGen = fc
  .array(pathComponent, { minLength: 1, maxLength: 3 })
  .map((comps) => ({
    type: 'FILE_PATH' as PIIType,
    value: '/' + comps.join('/'),
  }));

const piiGen = fc.oneof(
  emailGen,
  phoneGen,
  ssnGen,
  creditCardGen,
  addressGen,
  filePathGen
);

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
// Property test
// ---------------------------------------------------------------------------

describe('Feature: pii-redaction-filter, Property 3: Correct Redaction with Type-Specific Placeholders', () => {
  it('placeholder counts in redacted text match entity counts per type', () => {
    fc.assert(
      fc.property(
        // Generate 1-5 PII values with safe separators between them
        fc.array(piiGen, { minLength: 1, maxLength: 5 }),
        fc.array(safeSeparator, { minLength: 6, maxLength: 10 }),
        (piiItems, separators) => {
          // Build text with PII items separated by safe text on separate lines
          // Using newlines ensures file path regex cannot bleed across PII boundaries
          const parts: string[] = [];
          for (let i = 0; i < piiItems.length; i++) {
            const sep = separators[i] || 'lorem';
            parts.push(sep + ' ' + piiItems[i].value);
          }
          parts.push(separators[piiItems.length] || 'ipsum');
          const text = parts.join('\n');

          // Scan for PII entities
          const entities = scan(text);

          // Redact
          const { redactedText } = redact(text, entities);

          // Count entities per type from scan results
          const entityCountsByType: Partial<Record<PIIType, number>> = {};
          for (const entity of entities) {
            entityCountsByType[entity.type] = (entityCountsByType[entity.type] || 0) + 1;
          }

          // Count placeholders per type in redacted text
          const allTypes: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];
          for (const piiType of allTypes) {
            const placeholder = PLACEHOLDER_MAP[piiType];
            const placeholderCount = countOccurrences(redactedText, placeholder);
            const expectedCount = entityCountsByType[piiType] || 0;

            expect(placeholderCount).toBe(expectedCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
