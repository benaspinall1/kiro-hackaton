import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createRedactionNotification, createBlockNotification } from './notification-service';
import { PIIType, RedactionAction } from './types';

/**
 * Feature: pii-redaction-filter, Property 8: Redaction Notification Correctness
 *
 * For any non-empty list of redaction actions, the Notification_Service SHALL
 * produce a notification of type 'redaction' where the `details` record contains
 * the correct count for each redacted PII type.
 *
 * Validates: Requirements 4.1
 */

const ALL_PII_TYPES: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a single RedactionAction with a given PII type */
const redactionActionOfType = (type: PIIType, index: number): fc.Arbitrary<RedactionAction> =>
  fc.record({
    entityType: fc.constant(type),
    originalText: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `${type}-${s}`),
    placeholder: fc.constant(`[${type}_REDACTED]`),
    startIndex: fc.constant(index * 40),
    endIndex: fc.constant(index * 40 + 20),
  });

/**
 * Generate a non-empty list of RedactionAction objects with various PIIType values.
 *
 * Strategy:
 * 1. Pick 1-20 actions.
 * 2. For each action, pick a random PII type.
 * 3. Build a RedactionAction with that type.
 */
const nonEmptyRedactionActionsArb: fc.Arbitrary<RedactionAction[]> = fc
  .array(fc.constantFrom(...ALL_PII_TYPES), { minLength: 1, maxLength: 20 })
  .chain((types) =>
    fc.tuple(...types.map((type, i) => redactionActionOfType(type, i)))
  );

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe('Feature: pii-redaction-filter, Property 8: Redaction Notification Correctness', () => {
  it('produces a redaction notification with correct type and per-type counts', () => {
    fc.assert(
      fc.property(nonEmptyRedactionActionsArb, (redactions) => {
        const result = createRedactionNotification(redactions);

        // Result must not be null for non-empty input
        expect(result).not.toBeNull();

        // Type must be 'redaction'
        expect(result!.type).toBe('redaction');

        // Compute expected counts from input
        const expectedCounts: Record<PIIType, number> = {
          EMAIL: 0,
          PHONE: 0,
          SSN: 0,
          CREDIT_CARD: 0,
          ADDRESS: 0,
          FILE_PATH: 0,
        };
        for (const action of redactions) {
          expectedCounts[action.entityType]++;
        }

        // Verify details match expected counts for every PII type
        for (const piiType of ALL_PII_TYPES) {
          expect(result!.details[piiType]).toBe(expectedCounts[piiType]);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9 – Generators
// ---------------------------------------------------------------------------

/**
 * Generate a non-empty subset of PIIType values (the blocked types).
 *
 * Strategy:
 * 1. Shuffle ALL_PII_TYPES.
 * 2. Pick a random length between 1 and ALL_PII_TYPES.length.
 * 3. Slice to that length to get a unique, non-empty subset.
 */
const nonEmptyPIITypeSubsetArb: fc.Arbitrary<PIIType[]> = fc
  .shuffledSubarray(ALL_PII_TYPES, { minLength: 1, maxLength: ALL_PII_TYPES.length });

/** Generate a non-empty reason string */
const reasonArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 });

// ---------------------------------------------------------------------------
// Property 9 – Test
// ---------------------------------------------------------------------------

/**
 * Feature: pii-redaction-filter, Property 9: Block Notification Correctness
 *
 * For any gate result where `allowed` is false, the Notification_Service SHALL
 * produce a notification of type 'block' that lists exactly the PII types
 * present in `blockedTypes`.
 *
 * Validates: Requirements 4.2
 */
describe('Feature: pii-redaction-filter, Property 9: Block Notification Correctness', () => {
  it('produces a block notification with correct type and exactly the blocked PII types', () => {
    fc.assert(
      fc.property(nonEmptyPIITypeSubsetArb, reasonArb, (blockedTypes, reason) => {
        const result = createBlockNotification(blockedTypes, reason);

        // Type must be 'block'
        expect(result.type).toBe('block');

        // Each blocked type should have count 1 in details
        for (const piiType of blockedTypes) {
          expect(result.details[piiType]).toBe(1);
        }

        // Each non-blocked type should have count 0 in details
        const blockedSet = new Set(blockedTypes);
        for (const piiType of ALL_PII_TYPES) {
          if (!blockedSet.has(piiType)) {
            expect(result.details[piiType]).toBe(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
