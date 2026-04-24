import { PIIType, PIIEntity, PLACEHOLDER_MAP } from './types';

/**
 * Regex patterns for each PII type.
 * Order matters: patterns are applied in this order to the input text.
 */
interface PatternEntry {
  type: PIIType;
  pattern: RegExp;
}

/** Valid path component character class (letters, digits, dots, hyphens, underscores, spaces) */
const PC = '[a-zA-Z0-9._\\- ]';
/** Path component that starts with a non-space character */
const PC_START = '[a-zA-Z0-9._\\-]';

const PATTERNS: PatternEntry[] = [
  // Email: RFC 5322 simplified (local-part@domain)
  {
    type: 'EMAIL',
    pattern: /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g,
  },
  // US Phone: (XXX) XXX-XXXX, XXX-XXX-XXXX, +1XXXXXXXXXX
  {
    type: 'PHONE',
    pattern: /(?:\+1\d{10}|\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4})/g,
  },
  // SSN: XXX-XX-XXXX or 9 consecutive digits (with word boundaries)
  {
    type: 'SSN',
    pattern: /\b(?:\d{3}-\d{2}-\d{4}|\d{9})\b/g,
  },
  // Credit card: 13-19 digits with optional spaces or dashes between groups
  {
    type: 'CREDIT_CARD',
    pattern: /\b\d(?:\d[ -]?){12,18}\b/g,
  },
  // Address: simple US mailing address pattern
  {
    type: 'ADDRESS',
    pattern: /\d{1,5}\s+(?:[A-Za-z]+\s*){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Court|Ct|Way|Place|Pl|Circle|Cir|Terrace|Ter|Trail|Trl|Parkway|Pkwy|Highway|Hwy)\.?(?:\s*,\s*(?:[A-Za-z]+\s*)+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/gi,
  },
  // File paths: Unix home-relative must come before Unix absolute to get priority
  // Unix home-relative: ~/dir/file
  {
    type: 'FILE_PATH',
    pattern: new RegExp(`~\\/${PC_START}${PC}*(?:\\/${PC_START}${PC}*)*`, 'g'),
  },
  // Unix absolute: /dir/file
  {
    type: 'FILE_PATH',
    pattern: new RegExp(`\\/${PC_START}${PC}*(?:\\/${PC_START}${PC}*)*`, 'g'),
  },
  // Windows drive: C:\dir\file
  {
    type: 'FILE_PATH',
    pattern: new RegExp(`[a-zA-Z]:\\\\${PC_START}${PC}*(?:\\\\${PC_START}${PC}*)*`, 'g'),
  },
  // Windows UNC: \\server\share\folder
  {
    type: 'FILE_PATH',
    pattern: new RegExp(`\\\\\\\\${PC_START}${PC}*(?:\\\\${PC_START}${PC}*)+`, 'g'),
  },
];

/**
 * Escape a string for use in a RegExp.
 */
function escapeRegExp(str: string): string {
  let result = '';
  for (const ch of str) {
    if ('.*+?^${}()|[]\\'.includes(ch)) {
      result += '\\' + ch;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Build a regex that matches any [*_REDACTED] placeholder token.
 */
function buildPlaceholderPattern(): RegExp {
  const escaped = Object.values(PLACEHOLDER_MAP).map(escapeRegExp);
  return new RegExp(escaped.join('|'), 'g');
}

const PLACEHOLDER_PATTERN = buildPlaceholderPattern();

/**
 * Regex to match URLs so we can exclude path-like segments within them.
 */
const URL_PATTERN = /(?:https?|ftp):\/\/[^\s]+/gi;

/**
 * Check if a match overlaps with any exclusion span.
 */
function overlapsSpan(
  start: number,
  end: number,
  spans: Array<{ start: number; end: number }>
): boolean {
  return spans.some((span) => start < span.end && end > span.start);
}

/**
 * Find all spans matching a pattern in the text.
 */
function findSpans(
  text: string,
  pattern: RegExp
): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

/**
 * Scans text for PII entities.
 *
 * @param text - The input text to scan.
 * @returns A list of detected PII entities sorted by startIndex.
 */
export function scan(text: string): PIIEntity[] {
  try {
    const placeholderSpans = findSpans(text, PLACEHOLDER_PATTERN);
    const urlSpans = findSpans(text, URL_PATTERN);
    const entities: PIIEntity[] = [];

    for (const { type, pattern } of PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const startIndex = match.index;
        const matchedText = match[0];
        const endIndex = startIndex + matchedText.length;

        // Skip matches that overlap with placeholder tokens
        if (overlapsSpan(startIndex, endIndex, placeholderSpans)) {
          continue;
        }

        // Skip FILE_PATH matches that fall within a URL
        if (type === 'FILE_PATH' && overlapsSpan(startIndex, endIndex, urlSpans)) {
          continue;
        }

        // Skip if this span is contained within an existing entity of the same type
        // (handles dedup across multiple FILE_PATH patterns)
        const isOverlapping = entities.some(
          (e) =>
            e.type === type &&
            startIndex >= e.startIndex &&
            endIndex <= e.endIndex
        );
        if (isOverlapping) {
          continue;
        }

        entities.push({ type, matchedText, startIndex, endIndex });
      }
    }

    // Sort by startIndex
    entities.sort((a, b) => a.startIndex - b.startIndex);

    return entities;
  } catch (error) {
    console.error('PII_Scanner: internal regex error', error);
    return [];
  }
}
