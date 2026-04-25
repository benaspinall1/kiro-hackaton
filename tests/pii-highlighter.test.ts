import { describe, it, expect } from 'vitest';
import { segmentText } from '../src/frontend/pii-highlighter';
import type { PIIEntity } from '../src/types';

describe('segmentText', () => {
  it('returns a single unhighlighted segment when entities array is empty', () => {
    const result = segmentText('Hello world', []);
    expect(result).toEqual([{ text: 'Hello world', isHighlighted: false }]);
  });

  it('highlights a single entity in the middle of text', () => {
    const entity: PIIEntity = {
      type: 'EMAIL',
      matchedText: 'test@example.com',
      startIndex: 10,
      endIndex: 26,
    };
    const text = 'Contact: test@example.com please';
    const result = segmentText(text, [entity]);

    expect(result).toEqual([
      { text: 'Contact: ', isHighlighted: false },
      { text: 'test@example.com', entity, isHighlighted: true },
      { text: ' please', isHighlighted: false },
    ]);
  });

  it('highlights an entity at the start of text', () => {
    const entity: PIIEntity = {
      type: 'PHONE',
      matchedText: '555-1234',
      startIndex: 0,
      endIndex: 8,
    };
    const result = segmentText('555-1234 is my number', [entity]);

    expect(result).toEqual([
      { text: '555-1234', entity, isHighlighted: true },
      { text: ' is my number', isHighlighted: false },
    ]);
  });

  it('highlights an entity at the end of text', () => {
    const entity: PIIEntity = {
      type: 'SSN',
      matchedText: '123-45-6789',
      startIndex: 8,
      endIndex: 19,
    };
    const result = segmentText('My SSN: 123-45-6789', [entity]);

    expect(result).toEqual([
      { text: 'My SSN: ', isHighlighted: false },
      { text: '123-45-6789', entity, isHighlighted: true },
    ]);
  });

  it('handles multiple entities and sorts them by startIndex', () => {
    const email: PIIEntity = {
      type: 'EMAIL',
      matchedText: 'a@b.com',
      startIndex: 20,
      endIndex: 27,
    };
    const phone: PIIEntity = {
      type: 'PHONE',
      matchedText: '555-0000',
      startIndex: 5,
      endIndex: 13,
    };
    const text = 'Call 555-0000 email a@b.com end';
    // Pass entities out of order to test sorting
    const result = segmentText(text, [email, phone]);

    expect(result).toEqual([
      { text: 'Call ', isHighlighted: false },
      { text: '555-0000', entity: phone, isHighlighted: true },
      { text: ' email ', isHighlighted: false },
      { text: 'a@b.com', entity: email, isHighlighted: true },
      { text: ' end', isHighlighted: false },
    ]);
  });

  it('handles entity covering the entire text', () => {
    const entity: PIIEntity = {
      type: 'ADDRESS',
      matchedText: '123 Main St',
      startIndex: 0,
      endIndex: 11,
    };
    const result = segmentText('123 Main St', [entity]);

    expect(result).toEqual([
      { text: '123 Main St', entity, isHighlighted: true },
    ]);
  });

  it('concatenation of all segments reproduces original text', () => {
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'x@y.com', startIndex: 6, endIndex: 13 },
      { type: 'PHONE', matchedText: '555', startIndex: 18, endIndex: 21 },
    ];
    const text = 'Hello x@y.com and 555 bye';
    const result = segmentText(text, entities);
    const reconstructed = result.map(s => s.text).join('');
    expect(reconstructed).toBe(text);
  });
});
