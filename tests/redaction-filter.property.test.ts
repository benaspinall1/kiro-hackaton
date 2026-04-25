import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterEnabledEntities } from '../src/frontend/redaction-filter';
import type { PIIEntity, PIIType } from '../src/types';
import type { PIIItemState } from '../src/frontend/types';

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

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const piiTypes: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];

const piiTypeArb = fc.constantFrom(...piiTypes);

const piiEntityArb: fc.Arbitrary<PIIEntity> = fc
  .tuple(
    piiTypeArb,
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.nat({ max: 1000 })
  )
  .map(([type, matchedText, startIndex]) => ({
    type,
    matchedText,
    startIndex,
    endIndex: startIndex + matchedText.length,
  }));

const piiItemStateArb: fc.Arbitrary<PIIItemState> = fc
  .tuple(piiEntityArb, fc.boolean())
  .map(([entity, redactionEnabled]) => ({ entity, redactionEnabled }));

const piiItemStatesArb = fc.array(piiItemStateArb, { minLength: 1, maxLength: 20 });

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe('Feature: chat-frontend-pii-panel, Property 2: Selective Redaction Filtering', () => {
  it('filtered output contains exactly the entities where redactionEnabled === true, preserving order, and count matches', () => {
    fc.assert(
      fc.property(piiItemStatesArb, (items) => {
        const result = filterEnabledEntities(items);

        // Expected: only entities from items where redactionEnabled is true, in order
        const expected = items
          .filter((item) => item.redactionEnabled)
          .map((item) => item.entity);

        // Count matches
        expect(result.length).toBe(expected.length);

        // Entities match in order (same references)
        for (let i = 0; i < result.length; i++) {
          expect(result[i]).toBe(expected[i]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('returns empty array when all toggles are disabled', () => {
    fc.assert(
      fc.property(
        fc.array(piiEntityArb, { minLength: 1, maxLength: 20 }),
        (entities) => {
          const items: PIIItemState[] = entities.map((entity) => ({
            entity,
            redactionEnabled: false,
          }));

          const result = filterEnabledEntities(items);
          expect(result).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns all entities when all toggles are enabled', () => {
    fc.assert(
      fc.property(
        fc.array(piiEntityArb, { minLength: 1, maxLength: 20 }),
        (entities) => {
          const items: PIIItemState[] = entities.map((entity) => ({
            entity,
            redactionEnabled: true,
          }));

          const result = filterEnabledEntities(items);
          expect(result.length).toBe(entities.length);

          for (let i = 0; i < result.length; i++) {
            expect(result[i]).toBe(entities[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
