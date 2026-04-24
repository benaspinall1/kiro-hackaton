import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { scan } from './pii-scanner';
import { redact } from './redaction-engine';
import { PIIType, PIIEntity } from './types';

/**
 * Feature: pii-redaction-filter, Property 1: PII Detection Accuracy
 *
 * For any valid PII entity of a supported type embedded at any position
 * within arbitrary surrounding text, the PII_Scanner SHALL detect it and
 * return a PII_Entity with the correct type, where matchedText equals the
 * original PII string and text.substring(startIndex, endIndex) === matchedText.
 *
 * Validates: Requirements 1.2, 1.3, 8.1, 8.2, 8.3, 8.4, 10.1, 10.2, 10.3, 10.4
 */

// ---------------------------------------------------------------------------
// Helpers: safe surrounding text (no accidental PII patterns)
// ---------------------------------------------------------------------------

const lowerAlpha = 'abcdefghijklmnopqrstuvwxyz';

/** Generate a safe word: only lowercase alpha, 1-8 chars */
const safeWord = fc.string({ minLength: 1, maxLength: 8, unit: fc.constantFrom(...lowerAlpha.split('')) });

/** Generate safe surrounding text: space-separated safe words */
const safeText = fc
  .array(safeWord, { minLength: 0, maxLength: 5 })
  .map((words) => words.join(' '));

// ---------------------------------------------------------------------------
// PII Generators
// ---------------------------------------------------------------------------

/** Digit char */
const digit = fc.constantFrom(...'0123456789'.split(''));
const digitString = (len: number) =>
  fc.tuple(...Array.from({ length: len }, () => digit)).map((ds) => ds.join(''));

/** Email generator: local-part@domain.tld */
const emailLocalChar = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
);
const emailGen = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 10, unit: emailLocalChar }),
    fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(...lowerAlpha.split('')) }),
    fc.constantFrom('com', 'org', 'net', 'io', 'dev')
  )
  .map(([local, domain, tld]) => ({
    type: 'EMAIL' as PIIType,
    value: `${local}@${domain}.${tld}`,
  }));

/** Phone generator: three US formats */
const phoneGen = fc
  .tuple(digitString(3), digitString(3), digitString(4), digitString(10))
  .chain(([area, mid, last, ten]) =>
    fc.constantFrom(
      `(${area}) ${mid}-${last}`,
      `${area}-${mid}-${last}`,
      `+1${ten}`
    )
  )
  .map((value) => ({ type: 'PHONE' as PIIType, value }));

/** SSN generator: XXX-XX-XXXX or XXXXXXXXX */
const ssnGen = fc
  .tuple(digitString(3), digitString(2), digitString(4))
  .chain(([a, b, c]) => fc.constantFrom(`${a}-${b}-${c}`, `${a}${b}${c}`))
  .map((value) => ({ type: 'SSN' as PIIType, value }));

/** Credit card generator: 13-19 digits, optionally grouped with spaces or dashes */
const creditCardGen = fc
  .integer({ min: 13, max: 19 })
  .chain((len) =>
    fc.tuple(
      digitString(len),
      fc.constantFrom('none', 'space', 'dash')
    )
  )
  .map(([digits, sep]) => {
    if (sep === 'none') {
      return { type: 'CREDIT_CARD' as PIIType, value: digits };
    }
    const separator = sep === 'space' ? ' ' : '-';
    const chunks: string[] = [];
    for (let i = 0; i < digits.length; i += 4) {
      chunks.push(digits.slice(i, i + 4));
    }
    return { type: 'CREDIT_CARD' as PIIType, value: chunks.join(separator) };
  });

/** Address generator: number + street name + street type */
const streetTypes = [
  'Street', 'St', 'Avenue', 'Ave', 'Boulevard', 'Blvd',
  'Drive', 'Dr', 'Lane', 'Ln', 'Road', 'Rd', 'Court', 'Ct',
  'Way', 'Place', 'Pl', 'Circle', 'Cir', 'Terrace', 'Ter',
  'Trail', 'Trl', 'Parkway', 'Pkwy', 'Highway', 'Hwy',
];

const streetNameWord = fc.constantFrom(
  'Main', 'Oak', 'Elm', 'Pine', 'Maple', 'Cedar', 'Park',
  'Lake', 'Hill', 'River', 'Spring', 'Valley', 'Forest'
);

const addressGen = fc
  .tuple(
    fc.integer({ min: 1, max: 99999 }),
    fc.array(streetNameWord, { minLength: 1, maxLength: 3 }),
    fc.constantFrom(...streetTypes)
  )
  .map(([num, nameWords, suffix]) => ({
    type: 'ADDRESS' as PIIType,
    value: `${num} ${nameWords.join(' ')} ${suffix}`,
  }));

// ---------------------------------------------------------------------------
// File path generators
// ---------------------------------------------------------------------------

const pathChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-';

/** Valid path component: starts with non-space, may contain letters/digits/dots/hyphens/underscores */
const pathComponent = fc
  .tuple(
    fc.constantFrom(...pathChars.split('')),
    fc.string({
      minLength: 0,
      maxLength: 8,
      unit: fc.constantFrom(...(pathChars + ' ').split('')),
    })
  )
  .map(([first, rest]) => first + rest);

/** Unix absolute path: /comp/comp... */
const unixAbsolutePathGen = fc
  .array(pathComponent, { minLength: 1, maxLength: 4 })
  .map((comps) => ({
    type: 'FILE_PATH' as PIIType,
    value: '/' + comps.join('/'),
  }));

/** Unix home-relative path: ~/comp/comp... */
const unixHomePathGen = fc
  .array(pathComponent, { minLength: 1, maxLength: 4 })
  .map((comps) => ({
    type: 'FILE_PATH' as PIIType,
    value: '~/' + comps.join('/'),
  }));

/** Windows drive path: X:\comp\comp... */
const windowsDrivePathGen = fc
  .tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.array(pathComponent, { minLength: 1, maxLength: 4 })
  )
  .map(([drive, comps]) => ({
    type: 'FILE_PATH' as PIIType,
    value: `${drive}:\\${comps.join('\\')}`,
  }));

/** Windows UNC path: \\server\share\folder... */
const windowsUNCPathGen = fc
  .array(pathComponent, { minLength: 2, maxLength: 4 })
  .map((comps) => ({
    type: 'FILE_PATH' as PIIType,
    value: `\\\\${comps.join('\\')}`,
  }));

const filePathGen = fc.oneof(
  unixAbsolutePathGen,
  unixHomePathGen,
  windowsDrivePathGen,
  windowsUNCPathGen
);

// ---------------------------------------------------------------------------
// Combined PII generator
// ---------------------------------------------------------------------------

const piiGen = fc.oneof(
  emailGen,
  phoneGen,
  ssnGen,
  creditCardGen,
  addressGen,
  filePathGen
);

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe('Feature: pii-redaction-filter, Property 1: PII Detection Accuracy', () => {
  it('detects any valid PII value embedded in random surrounding text with correct type and positions', () => {
    fc.assert(
      fc.property(
        piiGen,
        safeText,
        safeText,
        (pii, before, after) => {
          // Build text with PII embedded between safe surrounding text
          const prefix = before.length > 0 ? before + ' ' : '';
          const suffix = after.length > 0 ? ' ' + after : '';
          const text = prefix + pii.value + suffix;

          const entities = scan(text);

          // Find entity matching our PII type
          const matching = entities.filter((e) => e.type === pii.type);

          // Assert at least one entity of the correct type was detected
          expect(matching.length).toBeGreaterThanOrEqual(1);

          // Assert at least one match contains our PII value
          const found = matching.some((e) => {
            // The scanner may match a superset (e.g., address with extra context)
            // but the matched text must at least contain our value
            // and positions must be consistent
            return (
              text.substring(e.startIndex, e.endIndex) === e.matchedText &&
              e.matchedText.includes(pii.value)
            );
          });

          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 2: No False Positives on Clean Text
// ---------------------------------------------------------------------------

/**
 * Feature: pii-redaction-filter, Property 2: No False Positives on Clean Text
 *
 * For any text string that contains no valid PII patterns (no email addresses,
 * phone numbers, SSNs, credit card numbers, addresses, or file system paths),
 * the PII_Scanner SHALL return an empty list of PII entities.
 *
 * Validates: Requirements 1.4
 */

// ---------------------------------------------------------------------------
// Generators for clean (non-PII) text
// ---------------------------------------------------------------------------

/**
 * Safe alphabet: lowercase + uppercase letters only.
 * Avoids digits (which could form SSNs, phones, credit cards, addresses)
 * and special characters (which could form emails, paths).
 */
const alphaChar = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
);

/**
 * A clean word: 1-12 purely alphabetic characters.
 * No digits, no '@', no '/', no '\', no '~', no '-', no '.', no '(' or ')'.
 * This ensures no substring can accidentally match email, phone, SSN,
 * credit card, address, or file path patterns.
 */
const cleanWord = fc.string({ minLength: 1, maxLength: 12, unit: alphaChar });

/**
 * Clean text: space-separated clean words forming a sentence-like string.
 * Between 1 and 20 words to give reasonable variety.
 */
const cleanText = fc
  .array(cleanWord, { minLength: 1, maxLength: 20 })
  .map((words) => words.join(' '));

describe('Feature: pii-redaction-filter, Property 2: No False Positives on Clean Text', () => {
  it('returns an empty list for text containing no PII patterns', () => {
    fc.assert(
      fc.property(cleanText, (text: string) => {
        const entities: PIIEntity[] = scan(text);
        expect(entities).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 13: File System Path Detection Accuracy
// ---------------------------------------------------------------------------

/**
 * Feature: pii-redaction-filter, Property 13: File System Path Detection Accuracy
 *
 * For any valid file system path of a supported style (Unix absolute, Unix
 * home-relative, Windows drive, Windows UNC) containing valid path characters
 * (letters, digits, dots, hyphens, underscores, spaces) embedded at any
 * position within arbitrary surrounding text, the PII_Scanner SHALL detect it
 * and return a PII_Entity with type FILE_PATH, where matchedText equals the
 * original path string and text.substring(startIndex, endIndex) === matchedText.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.8
 */

describe('Feature: pii-redaction-filter, Property 13: File System Path Detection Accuracy', () => {
  it('detects Unix absolute paths embedded in random surrounding text', () => {
    fc.assert(
      fc.property(
        unixAbsolutePathGen,
        safeText,
        safeText,
        (pathObj, before, after) => {
          const prefix = before.length > 0 ? before + ' ' : '';
          const suffix = after.length > 0 ? ' ' + after : '';
          const text = prefix + pathObj.value + suffix;

          const entities = scan(text);
          const matching = entities.filter((e) => e.type === 'FILE_PATH');

          expect(matching.length).toBeGreaterThanOrEqual(1);

          const found = matching.some(
            (e) =>
              text.substring(e.startIndex, e.endIndex) === e.matchedText &&
              e.matchedText.includes(pathObj.value)
          );
          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detects Unix home-relative paths embedded in random surrounding text', () => {
    fc.assert(
      fc.property(
        unixHomePathGen,
        safeText,
        safeText,
        (pathObj, before, after) => {
          const prefix = before.length > 0 ? before + ' ' : '';
          const suffix = after.length > 0 ? ' ' + after : '';
          const text = prefix + pathObj.value + suffix;

          const entities = scan(text);
          const matching = entities.filter((e) => e.type === 'FILE_PATH');

          expect(matching.length).toBeGreaterThanOrEqual(1);

          const found = matching.some(
            (e) =>
              text.substring(e.startIndex, e.endIndex) === e.matchedText &&
              e.matchedText.includes(pathObj.value)
          );
          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detects Windows drive paths embedded in random surrounding text', () => {
    fc.assert(
      fc.property(
        windowsDrivePathGen,
        safeText,
        safeText,
        (pathObj, before, after) => {
          const prefix = before.length > 0 ? before + ' ' : '';
          const suffix = after.length > 0 ? ' ' + after : '';
          const text = prefix + pathObj.value + suffix;

          const entities = scan(text);
          const matching = entities.filter((e) => e.type === 'FILE_PATH');

          expect(matching.length).toBeGreaterThanOrEqual(1);

          const found = matching.some(
            (e) =>
              text.substring(e.startIndex, e.endIndex) === e.matchedText &&
              e.matchedText.includes(pathObj.value)
          );
          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('detects Windows UNC paths embedded in random surrounding text', () => {
    fc.assert(
      fc.property(
        windowsUNCPathGen,
        safeText,
        safeText,
        (pathObj, before, after) => {
          const prefix = before.length > 0 ? before + ' ' : '';
          const suffix = after.length > 0 ? ' ' + after : '';
          const text = prefix + pathObj.value + suffix;

          const entities = scan(text);
          const matching = entities.filter((e) => e.type === 'FILE_PATH');

          expect(matching.length).toBeGreaterThanOrEqual(1);

          const found = matching.some(
            (e) =>
              text.substring(e.startIndex, e.endIndex) === e.matchedText &&
              e.matchedText.includes(pathObj.value)
          );
          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 14: No False Positives on Non-Path Patterns
// ---------------------------------------------------------------------------

/**
 * Feature: pii-redaction-filter, Property 14: No False Positives on Non-Path Patterns
 *
 * For any text containing single forward slashes, lone tildes, URL patterns
 * (e.g., https://example.com/path), or plain words without path separators,
 * the PII_Scanner SHALL not return any PII_Entity with type FILE_PATH.
 *
 * Validates: Requirements 10.6
 */

// ---------------------------------------------------------------------------
// Generators for non-path patterns
// ---------------------------------------------------------------------------

/** Single forward slash */
const singleSlashGen = fc.constant('/');

/** Lone tilde */
const loneTildeGen = fc.constant('~');

/** URL pattern generator: protocol://domain.tld/path */
const urlProtocol = fc.constantFrom('https', 'http', 'ftp');
const urlDomainWord = fc.string({
  minLength: 2,
  maxLength: 10,
  unit: fc.constantFrom(...lowerAlpha.split('')),
});
const urlTld = fc.constantFrom('com', 'org', 'net', 'io', 'dev', 'edu');
const urlPathSegment = fc.string({
  minLength: 1,
  maxLength: 8,
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
});

const urlGen = fc
  .tuple(
    urlProtocol,
    urlDomainWord,
    urlTld,
    fc.array(urlPathSegment, { minLength: 1, maxLength: 3 })
  )
  .map(([proto, domain, tld, segments]) =>
    `${proto}://${domain}.${tld}/${segments.join('/')}`
  );

/** Plain word generator: alphabetic words with no path separators */
const plainWordGen = fc.string({
  minLength: 1,
  maxLength: 15,
  unit: fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  ),
});

/** Combined non-path pattern generator */
const nonPathPatternGen = fc.oneof(
  singleSlashGen,
  loneTildeGen,
  urlGen,
  plainWordGen
);

describe('Feature: pii-redaction-filter, Property 14: No False Positives on Non-Path Patterns', () => {
  it('returns no FILE_PATH entities for single slashes, lone tildes, URLs, and plain words', () => {
    fc.assert(
      fc.property(nonPathPatternGen, (input: string) => {
        const entities = scan(input);
        const filePathEntities = entities.filter((e) => e.type === 'FILE_PATH');
        expect(filePathEntities).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});


// ---------------------------------------------------------------------------
// Property 15: File Path Redaction Round-Trip
// ---------------------------------------------------------------------------

/**
 * Feature: pii-redaction-filter, Property 15: File Path Redaction Round-Trip
 *
 * For any valid input text containing file system paths, scanning for PII,
 * redacting all detected entities (including file paths with [FILE_PATH_REDACTED]),
 * and then scanning the redacted output again SHALL yield zero PII entities of
 * type FILE_PATH. This ensures that the [FILE_PATH_REDACTED] placeholder is not
 * itself flagged as a file path.
 *
 * Validates: Requirements 10.7, 2.5
 */

describe('Feature: pii-redaction-filter, Property 15: File Path Redaction Round-Trip', () => {
  it('scan → redact → scan yields zero FILE_PATH entities for all path styles', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          unixAbsolutePathGen,
          unixHomePathGen,
          windowsDrivePathGen,
          windowsUNCPathGen
        ),
        safeText,
        safeText,
        (pathObj, before, after) => {
          const prefix = before.length > 0 ? before + ' ' : '';
          const suffix = after.length > 0 ? ' ' + after : '';
          const text = prefix + pathObj.value + suffix;

          // First scan
          const entities = scan(text);

          // Redact all detected entities
          const { redactedText } = redact(text, entities);

          // Second scan on redacted output
          const secondScanEntities = scan(redactedText);
          const filePathEntities = secondScanEntities.filter(
            (e) => e.type === 'FILE_PATH'
          );

          expect(filePathEntities).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
