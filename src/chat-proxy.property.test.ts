import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ChatProxyImpl, DownstreamService } from './chat-proxy';
import { PIIType, PrivacyRuleConfig } from './types';
import { scan } from './pii-scanner';

/**
 * Feature: pii-redaction-filter, Property 11: Redaction Report Structure
 *
 * For any processed message, the generated Redaction_Report SHALL contain:
 * a `messageHash` that is a valid SHA-256 hex string of the original message,
 * `detectedCounts` matching the actual count of detected entities per type,
 * `actions` entries matching the action taken for each entity, and a valid
 * ISO 8601 `timestamp`.
 *
 * Validates: Requirements 6.1
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOWNSTREAM_REPLY = 'downstream-reply';
const mockDownstream: DownstreamService = async () => DOWNSTREAM_REPLY;

const ALL_PII_TYPES: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];

const emptyRules: PrivacyRuleConfig = { rules: {} };
const redactOnlyRules: PrivacyRuleConfig = {
  rules: {
    EMAIL: 'redact',
    PHONE: 'redact',
    SSN: 'redact',
    CREDIT_CARD: 'redact',
    ADDRESS: 'redact',
    FILE_PATH: 'redact',
  },
};

// ---------------------------------------------------------------------------
// Safe text generators (purely alphabetic, no street suffixes)
// ---------------------------------------------------------------------------

const SAFE_WORDS = [
  'lorem', 'ipsum', 'quick', 'brown', 'fox', 'jumps',
  'lazy', 'hello', 'gamma', 'kappa', 'zulu', 'nexus',
  'pixel', 'quaff', 'joker', 'vivid', 'waltz', 'xenon',
];

const safeWord = fc.constantFrom(...SAFE_WORDS);

const safeSeparator = fc
  .array(safeWord, { minLength: 1, maxLength: 3 })
  .map((words) => words.join(' '));

// ---------------------------------------------------------------------------
// PII Generators
// ---------------------------------------------------------------------------

const digit = fc.constantFrom(...'0123456789'.split(''));
const digitString = (len: number) =>
  fc.tuple(...Array.from({ length: len }, () => digit)).map((ds) => ds.join(''));

const lowerAlpha = 'abcdefghijklmnopqrstuvwxyz';

const emailGen = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 8, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')) }),
    fc.string({ minLength: 1, maxLength: 8, unit: fc.constantFrom(...lowerAlpha.split('')) }),
    fc.constantFrom('com', 'org', 'net', 'io'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

const phoneGen = fc
  .tuple(digitString(3), digitString(3), digitString(4))
  .map(([area, mid, last]) => `${area}-${mid}-${last}`);

const ssnGen = fc
  .tuple(digitString(3), digitString(2), digitString(4))
  .map(([a, b, c]) => `${a}-${b}-${c}`);

const creditCardGen = digitString(16);

const addressGen = fc
  .tuple(
    fc.integer({ min: 1, max: 99999 }),
    fc.constantFrom('Main', 'Oak', 'Elm', 'Pine', 'Maple'),
    fc.constantFrom('Street', 'Avenue', 'Drive', 'Road', 'Lane'),
  )
  .map(([num, name, suffix]) => `${num} ${name} ${suffix}`);

const pathChars = 'abcdefghijklmnopqrstuvwxyz0123456789._-';
const pathComponent = fc
  .tuple(
    fc.constantFrom(...pathChars.split('')),
    fc.string({ minLength: 1, maxLength: 6, unit: fc.constantFrom(...pathChars.split('')) }),
  )
  .map(([first, rest]) => first + rest);

const filePathGen = fc
  .array(pathComponent, { minLength: 1, maxLength: 3 })
  .map((comps) => '/' + comps.join('/'));

const piiValueGen = fc.oneof(
  emailGen,
  phoneGen,
  ssnGen,
  creditCardGen,
  addressGen,
  filePathGen,
);

// ---------------------------------------------------------------------------
// Generator: message with embedded PII
// ---------------------------------------------------------------------------

const messageWithPiiGen = fc
  .tuple(
    fc.array(piiValueGen, { minLength: 1, maxLength: 4 }),
    fc.array(safeSeparator, { minLength: 5, maxLength: 8 }),
  )
  .map(([piiItems, separators]) => {
    const parts: string[] = [];
    for (let i = 0; i < piiItems.length; i++) {
      const sep = separators[i] || 'lorem';
      parts.push(sep + ' ' + piiItems[i]);
    }
    parts.push(separators[piiItems.length] || 'ipsum');
    return parts.join('\n');
  });

// Generator: clean message (no PII)
const cleanMessageGen = fc
  .array(safeWord, { minLength: 2, maxLength: 8 })
  .map((words) => words.join(' '));

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Feature: pii-redaction-filter, Property 11: Redaction Report Structure', () => {
  it('report has valid SHA-256 hash, correct detectedCounts, matching actions, and valid ISO 8601 timestamp for messages with PII', () => {
    fc.assert(
      fc.asyncProperty(
        messageWithPiiGen,
        fc.constantFrom(emptyRules, redactOnlyRules),
        async (message, rules) => {
          const proxy = new ChatProxyImpl(mockDownstream);
          const result = await proxy.processRequest({ prompt: message }, rules);
          const report = result.redactionReport;

          // 1. messageHash is valid SHA-256 hex (64 hex chars)
          expect(report.messageHash).toMatch(/^[a-f0-9]{64}$/);

          // 2. messageHash matches SHA-256 of the original prompt
          const expectedHash = createHash('sha256').update(message).digest('hex');
          expect(report.messageHash).toBe(expectedHash);

          // 3. detectedCounts match actual scan results
          const entities = scan(message);
          const expectedCounts: Record<PIIType, number> = {
            EMAIL: 0, PHONE: 0, SSN: 0, CREDIT_CARD: 0, ADDRESS: 0, FILE_PATH: 0,
          };
          for (const entity of entities) {
            expectedCounts[entity.type]++;
          }
          for (const piiType of ALL_PII_TYPES) {
            expect(report.detectedCounts[piiType]).toBe(expectedCounts[piiType]);
          }

          // 4. actions entries match the action taken for each entity
          //    With redact-only/empty rules, all entities should be 'redacted'
          expect(report.actions.length).toBe(entities.length);
          for (const action of report.actions) {
            expect(action.action).toBe('redacted');
            expect(ALL_PII_TYPES).toContain(action.entityType);
          }

          // 5. timestamp is valid ISO 8601
          const parsed = new Date(report.timestamp);
          expect(parsed.getTime()).not.toBeNaN();
          expect(parsed.toISOString()).toBe(report.timestamp);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('clean message report has zero counts, single "none" action, valid hash and timestamp', () => {
    fc.assert(
      fc.asyncProperty(
        cleanMessageGen,
        async (message) => {
          const proxy = new ChatProxyImpl(mockDownstream);
          const result = await proxy.processRequest({ prompt: message }, emptyRules);
          const report = result.redactionReport;

          // 1. messageHash is valid SHA-256 hex
          expect(report.messageHash).toMatch(/^[a-f0-9]{64}$/);

          // 2. messageHash matches SHA-256 of the original prompt
          const expectedHash = createHash('sha256').update(message).digest('hex');
          expect(report.messageHash).toBe(expectedHash);

          // 3. All detectedCounts are zero
          for (const piiType of ALL_PII_TYPES) {
            expect(report.detectedCounts[piiType]).toBe(0);
          }

          // 4. Single action with 'none'
          expect(report.actions.length).toBe(1);
          expect(report.actions[0].action).toBe('none');

          // 5. timestamp is valid ISO 8601
          const parsed = new Date(report.timestamp);
          expect(parsed.getTime()).not.toBeNaN();
          expect(parsed.toISOString()).toBe(report.timestamp);

          // 6. No notification for clean messages
          expect(result.notification).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
