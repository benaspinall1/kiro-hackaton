import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterEnabledEntities, autoRedactAll } from '../src/frontend/redaction-filter';
import type { PIIItemState } from '../src/frontend/types';
import type { PIIEntity, PIIType } from '../src/types';

/**
 * Feature: chat-frontend-pii-panel, Property 2: Selective Redaction Filtering
 *
 * For any array of PIIItemState objects with arbitrary redactionEnabled boolean
 * values, filtering to only enabled items SHALL produce a result containing
 * exactly the entities where redactionEnabled === true, preserving their order,
 * and the count of filtered entities SHALL equal the number of items with
 * redactionEnabled === true in the input.
 *
 * Validates: Requirements 6.1, 6.2, 7.1
 */

const piiTypes: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];

const piiEntityArb: fc.Arbitrary<PIIEntity> = fc.record({
  type: fc.constantFrom(...piiTypes),
  matchedText: fc.string({ minLength: 1, maxLength: 50 }),
  startIndex: fc.nat({ max: 1000 }),
  endIndex: fc.nat({ max: 1000 }),
});

const piiItemStateArb: fc.Arbitrary<PIIItemState> = fc.record({
  entity: piiEntityArb,
  redactionEnabled: fc.boolean(),
});

const piiItemStateArrayArb = fc.array(piiItemStateArb, { minLength: 1, maxLength: 20 });

describe('Feature: chat-frontend-pii-panel, Property 2: Selective Redaction Filtering', () => {
  it('filtered output contains exactly the entities where redactionEnabled === true, preserving order and count', () => {
    fc.assert(
      fc.property(piiItemStateArrayArb, (items) => {
        const result = filterEnabledEntities(items);

        // Expected: only entities from items where redactionEnabled is true, in order
        const expected = items
          .filter((item) => item.redactionEnabled)
          .map((item) => item.entity);

        // Count matches
        expect(result.length).toBe(expected.length);

        // Order and identity preserved (same entity references)
        for (let i = 0; i < result.length; i++) {
          expect(result[i]).toBe(expected[i]);
        }
      }),
      { numRuns: 100 }
    );
  });
});
