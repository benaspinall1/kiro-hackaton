import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { evaluate } from './ethics-logic-gate';
import { PIIType, PIIEntity, PrivacyRuleConfig } from './types';

/**
 * Feature: pii-redaction-filter, Property 6: Block Rule Enforcement
 *
 * For any set of detected PII entities and any Privacy_Rule configuration where
 * at least one detected entity's type is mapped to "block", the Ethics_Logic_Gate
 * SHALL return `allowed: false`, and the `blockedTypes` array SHALL contain exactly
 * the PII types that matched "block" rules, and `reason` SHALL be non-null.
 *
 * Validates: Requirements 3.2, 3.3
 */

const ALL_PII_TYPES: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generate a random PIIEntity of a given type */
const piiEntityOfType = (type: PIIType): fc.Arbitrary<PIIEntity> =>
  fc.nat({ max: 1000 }).map((start) => ({
    type,
    matchedText: `dummy-${type}-${start}`,
    startIndex: start,
    endIndex: start + 10,
  }));

/** Generate a random PIIEntity of any supported type */
const piiEntityArb: fc.Arbitrary<PIIEntity> =
  fc.constantFrom(...ALL_PII_TYPES).chain((type) => piiEntityOfType(type));

/**
 * Generate a non-empty list of PIIEntity objects and a PrivacyRuleConfig where
 * at least one entity's type is mapped to "block".
 *
 * Strategy:
 * 1. Pick a random subset of PII types to appear as entities (1-6 types).
 * 2. For each chosen type, generate 1-3 entities.
 * 3. Pick at least one of those types to be "block"; the rest are randomly "block" or "redact".
 */
const entitiesWithBlockRuleArb = fc
  .record({
    /** Shuffled PII types — we'll take a slice for entity types */
    shuffledTypes: fc.shuffledSubarray(ALL_PII_TYPES, { minLength: 1 }),
    /** How many entities per chosen type (1-3 each) */
    countsPerType: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 6, maxLength: 6 }),
    /** Index within the chosen types that is guaranteed to be "block" */
    guaranteedBlockIdx: fc.nat(),
    /** For each PII type, random action — overridden for the guaranteed block */
    actions: fc.array(fc.constantFrom('block' as const, 'redact' as const), { minLength: 6, maxLength: 6 }),
  })
  .map(({ shuffledTypes, countsPerType, guaranteedBlockIdx, actions }) => {
    // Build entities for each chosen type
    const entities: PIIEntity[] = [];
    for (let i = 0; i < shuffledTypes.length; i++) {
      const count = countsPerType[i % countsPerType.length];
      for (let j = 0; j < count; j++) {
        const start = entities.length * 20;
        entities.push({
          type: shuffledTypes[i],
          matchedText: `dummy-${shuffledTypes[i]}-${j}`,
          startIndex: start,
          endIndex: start + 10,
        });
      }
    }

    // Build rules: assign random actions, but guarantee at least one block
    const rules: Partial<Record<PIIType, 'block' | 'redact'>> = {};
    for (let i = 0; i < shuffledTypes.length; i++) {
      rules[shuffledTypes[i]] = actions[i % actions.length];
    }
    // Force at least one type to "block"
    const blockIdx = guaranteedBlockIdx % shuffledTypes.length;
    rules[shuffledTypes[blockIdx]] = 'block';

    const config: PrivacyRuleConfig = { rules };

    // Compute expected blocked types: unique types whose rule is "block" AND that appear in entities
    const entityTypes = new Set(entities.map((e) => e.type));
    const expectedBlockedTypes = ALL_PII_TYPES.filter(
      (t) => entityTypes.has(t) && rules[t] === 'block'
    );

    return { entities, config, expectedBlockedTypes };
  });

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe('Feature: pii-redaction-filter, Property 6: Block Rule Enforcement', () => {
  it('gate returns allowed: false with correct blockedTypes when ≥1 block rule matches', () => {
    fc.assert(
      fc.property(entitiesWithBlockRuleArb, ({ entities, config, expectedBlockedTypes }) => {
        const result = evaluate(entities, config);

        // Must be blocked
        expect(result.allowed).toBe(false);

        // blockedTypes must contain exactly the PII types that matched "block" rules
        expect([...result.blockedTypes].sort()).toEqual([...expectedBlockedTypes].sort());

        // reason must be non-null
        expect(result.reason).not.toBeNull();
        expect(typeof result.reason).toBe('string');
        expect(result.reason!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
