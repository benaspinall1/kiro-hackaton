import { describe, it, expect } from 'vitest';
import { redact } from '../src/redaction-engine';
import { PIIEntity } from '../src/types';
import { InvalidEntityError } from '../src/errors';

describe('RedactionEngine', () => {
  it('should replace a single email entity with [EMAIL_REDACTED]', () => {
    const text = 'Contact me at user@example.com please';
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'user@example.com', startIndex: 14, endIndex: 30 },
    ];
    const result = redact(text, entities);
    expect(result.redactedText).toBe('Contact me at [EMAIL_REDACTED] please');
    expect(result.redactions).toHaveLength(1);
    expect(result.redactions[0].entityType).toBe('EMAIL');
    expect(result.redactions[0].originalText).toBe('user@example.com');
    expect(result.redactions[0].placeholder).toBe('[EMAIL_REDACTED]');
  });

  it('should replace multiple entities of different types', () => {
    const text = 'Email: a@b.com Phone: 555-123-4567';
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'a@b.com', startIndex: 7, endIndex: 14 },
      { type: 'PHONE', matchedText: '555-123-4567', startIndex: 22, endIndex: 34 },
    ];
    const result = redact(text, entities);
    expect(result.redactedText).toBe('Email: [EMAIL_REDACTED] Phone: [PHONE_REDACTED]');
    expect(result.redactions).toHaveLength(2);
    expect(result.redactions[0].entityType).toBe('EMAIL');
    expect(result.redactions[1].entityType).toBe('PHONE');
  });

  it('should handle multiple entities of the same type', () => {
    const text = 'a@b.com and c@d.com';
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'a@b.com', startIndex: 0, endIndex: 7 },
      { type: 'EMAIL', matchedText: 'c@d.com', startIndex: 12, endIndex: 19 },
    ];
    const result = redact(text, entities);
    expect(result.redactedText).toBe('[EMAIL_REDACTED] and [EMAIL_REDACTED]');
    expect(result.redactions).toHaveLength(2);
  });

  it('should preserve non-PII text unchanged', () => {
    const text = 'Hello world, no PII here';
    const result = redact(text, []);
    expect(result.redactedText).toBe(text);
    expect(result.redactions).toHaveLength(0);
  });

  it('should throw InvalidEntityError for out-of-bounds startIndex', () => {
    const text = 'short';
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'a@b.com', startIndex: -1, endIndex: 5 },
    ];
    expect(() => redact(text, entities)).toThrow(InvalidEntityError);
  });

  it('should throw InvalidEntityError for endIndex beyond text length', () => {
    const text = 'short';
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'a@b.com', startIndex: 0, endIndex: 100 },
    ];
    expect(() => redact(text, entities)).toThrow(InvalidEntityError);
  });

  it('should throw InvalidEntityError when startIndex > endIndex', () => {
    const text = 'some text';
    const entities: PIIEntity[] = [
      { type: 'SSN', matchedText: '123', startIndex: 5, endIndex: 2 },
    ];
    expect(() => redact(text, entities)).toThrow(InvalidEntityError);
  });

  it('should use correct placeholder for each PII type', () => {
    const text = 'AAAAAA BBBBBB CCCCCC DDDDDD EEEEEE FFFFFF';
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'AAAAAA', startIndex: 0, endIndex: 6 },
      { type: 'PHONE', matchedText: 'BBBBBB', startIndex: 7, endIndex: 13 },
      { type: 'SSN', matchedText: 'CCCCCC', startIndex: 14, endIndex: 20 },
      { type: 'CREDIT_CARD', matchedText: 'DDDDDD', startIndex: 21, endIndex: 27 },
      { type: 'ADDRESS', matchedText: 'EEEEEE', startIndex: 28, endIndex: 34 },
      { type: 'FILE_PATH', matchedText: 'FFFFFF', startIndex: 35, endIndex: 41 },
    ];
    const result = redact(text, entities);
    expect(result.redactedText).toBe(
      '[EMAIL_REDACTED] [PHONE_REDACTED] [SSN_REDACTED] [CREDIT_CARD_REDACTED] [ADDRESS_REDACTED] [FILE_PATH_REDACTED]'
    );
  });

  it('should return redactions in forward order (by startIndex)', () => {
    const text = 'AAA BBB CCC';
    const entities: PIIEntity[] = [
      { type: 'SSN', matchedText: 'CCC', startIndex: 8, endIndex: 11 },
      { type: 'EMAIL', matchedText: 'AAA', startIndex: 0, endIndex: 3 },
      { type: 'PHONE', matchedText: 'BBB', startIndex: 4, endIndex: 7 },
    ];
    const result = redact(text, entities);
    expect(result.redactions[0].startIndex).toBe(0);
    expect(result.redactions[1].startIndex).toBe(4);
    expect(result.redactions[2].startIndex).toBe(8);
  });
});
