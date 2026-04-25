import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { evaluate } from '../src/ethics-logic-gate';
import { PIIType, PIIEntity, PrivacyRuleConfig } from '../src/types';

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

// ---------------------------------------------------------------------------
// Property 7: Redact-Only Rules Allow Message
// ---------------------------------------------------------------------------

/**
 * Feature: pii-redaction-filter, Property 7: Redact-Only Rules Allow Message
 *
 * For any set of detected PII entities and any Privacy_Rule configuration
 * (including empty configurations) where no detected entity's type is mapped
 * to "block" (missing types default to "redact"), the Ethics_Logic_Gate SHALL
 * return `allowed: true`.
 *
 * Validates: Requirements 3.4, 3.5, 7.2
 */

/**
 * Generate a list of PIIEntity objects (0+) and a PrivacyRuleConfig where
 * NO entity's type is mapped to "block". Types are either explicitly set to
 * "redact" or omitted from the config entirely (which defaults to "redact").
 *
 * Strategy:
 * 1. Pick a random subset of PII types to appear as entities (0-6 types).
 * 2. For each chosen type, generate 1-3 entities.
 * 3. For each type, randomly decide: explicitly set to "redact" or omit from config.
 * 4. Optionally add extra "redact" rules for types NOT present in entities.
 */
const entitiesWithRedactOnlyRuleArb = fc
  .record({
    /** Subset of PII types to use as entity types */
    entityTypes: fc.shuffledSubarray(ALL_PII_TYPES, { minLength: 0 }),
    /** How many entities per chosen type (1-3 each) */
    countsPerType: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 6, maxLength: 6 }),
    /** For each entity type, whether to explicitly include it in config as "redact" (true) or omit (false) */
    includeInConfig: fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
    /** Extra PII types to add as explicit "redact" rules (types not used as entities) */
    extraRedactTypes: fc.shuffledSubarray(ALL_PII_TYPES, { minLength: 0 }),
  })
  .map(({ entityTypes, countsPerType, includeInConfig, extraRedactTypes }) => {
    // Build entities
    const entities: PIIEntity[] = [];
    for (let i = 0; i < entityTypes.length; i++) {
      const count = countsPerType[i % countsPerType.length];
      for (let j = 0; j < count; j++) {
        const start = entities.length * 20;
        entities.push({
          type: entityTypes[i],
          matchedText: `dummy-${entityTypes[i]}-${j}`,
          startIndex: start,
          endIndex: start + 10,
        });
      }
    }

    // Build rules: only "redact" or omitted — never "block"
    const rules: Partial<Record<PIIType, 'block' | 'redact'>> = {};
    for (let i = 0; i < entityTypes.length; i++) {
      if (includeInConfig[i % includeInConfig.length]) {
        rules[entityTypes[i]] = 'redact';
      }
      // else: omitted from config, defaults to "redact"
    }

    // Add extra "redact" rules for types not in entity set
    const entityTypeSet = new Set(entityTypes);
    for (const t of extraRedactTypes) {
      if (!entityTypeSet.has(t)) {
        rules[t] = 'redact';
      }
    }

    const config: PrivacyRuleConfig = { rules };

    return { entities, config };
  });

describe('Feature: pii-redaction-filter, Property 7: Redact-Only Rules Allow Message', () => {
  it('gate returns allowed: true with empty blockedTypes and null reason when no block rules match', () => {
    fc.assert(
      fc.property(entitiesWithRedactOnlyRuleArb, ({ entities, config }) => {
        const result = evaluate(entities, config);

        // Must be allowed
        expect(result.allowed).toBe(true);

        // blockedTypes must be empty
        expect(result.blockedTypes).toEqual([]);

        // reason must be null
        expect(result.reason).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Privacy Rule Configuration Validation
// ---------------------------------------------------------------------------

import { validateConfig } from '../src/ethics-logic-gate';

/**
 * Feature: pii-redaction-filter, Property 12: Privacy Rule Configuration Validation
 *
 * For any configuration object, the Ethics_Logic_Gate SHALL accept it if and only
 * if all keys in the rules map are supported PII types (including FILE_PATH).
 * Configurations referencing unsupported PII type strings SHALL be rejected.
 *
 * Validates: Requirements 7.1, 7.3
 */

const INVALID_PII_TYPES = ['PASSPORT', 'BIOMETRIC', 'DNA', 'FINGERPRINT', 'RETINA', 'BLOOD_TYPE'];

describe('Feature: pii-redaction-filter, Property 12: Privacy Rule Configuration Validation', () => {
  it('accepts configs with only valid PII type keys', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ALL_PII_TYPES, { minLength: 0 }).chain((types) =>
          fc.record({
            types: fc.constant(types),
            actions: fc.array(fc.constantFrom('block' as const, 'redact' as const), {
              minLength: types.length,
              maxLength: types.length,
            }),
          })
        ),
        ({ types, actions }) => {
          const rules: Record<string, 'block' | 'redact'> = {};
          for (let i = 0; i < types.length; i++) {
            rules[types[i]] = actions[i];
          }
          const config = { rules } as any;

          // Should NOT throw for valid configs
          expect(() => validateConfig(config)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects configs with at least one invalid PII type key', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            validTypes: fc.shuffledSubarray(ALL_PII_TYPES, { minLength: 0 }),
            invalidKeys: fc
              .array(
                fc.oneof(
                  fc.constantFrom(...INVALID_PII_TYPES),
                  fc.string({ minLength: 1, maxLength: 10 })
                    .filter((s: string) => !(ALL_PII_TYPES as readonly string[]).includes(s))
                ),
                { minLength: 1, maxLength: 3 }
              ),
            actions: fc.array(fc.constantFrom('block' as const, 'redact' as const), {
              minLength: 10,
              maxLength: 10,
            }),
          }),
        ({ validTypes, invalidKeys, actions }) => {
          const rules: Record<string, 'block' | 'redact'> = {};
          let actionIdx = 0;
          for (const t of validTypes) {
            rules[t] = actions[actionIdx++ % actions.length];
          }
          for (const k of invalidKeys) {
            rules[k] = actions[actionIdx++ % actions.length];
          }
          const config = { rules } as any;

          // Should throw for configs with invalid keys
          expect(() => validateConfig(config)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
