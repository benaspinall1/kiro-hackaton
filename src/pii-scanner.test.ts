import { describe, it, expect } from 'vitest';
import { scan } from './pii-scanner';

describe('PII_Scanner', () => {
  describe('Email detection', () => {
    it('detects a simple email address', () => {
      const result = scan('Contact me at user@example.com please');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('EMAIL');
      expect(result[0].matchedText).toBe('user@example.com');
      expect(result[0].startIndex).toBe(14);
      expect(result[0].endIndex).toBe(30);
    });

    it('detects multiple emails', () => {
      const result = scan('Email a@b.com and c@d.org');
      const emails = result.filter((e) => e.type === 'EMAIL');
      expect(emails).toHaveLength(2);
    });
  });

  describe('Phone detection', () => {
    it('detects (XXX) XXX-XXXX format', () => {
      const result = scan('Call (555) 123-4567 now');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('PHONE');
      expect(result[0].matchedText).toBe('(555) 123-4567');
    });

    it('detects XXX-XXX-XXXX format', () => {
      const result = scan('Call 555-123-4567 now');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('PHONE');
      expect(result[0].matchedText).toBe('555-123-4567');
    });

    it('detects +1XXXXXXXXXX format', () => {
      const result = scan('Call +15551234567 now');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('PHONE');
      expect(result[0].matchedText).toBe('+15551234567');
    });
  });

  describe('SSN detection', () => {
    it('detects XXX-XX-XXXX format', () => {
      const result = scan('SSN: 123-45-6789');
      const ssns = result.filter((e) => e.type === 'SSN');
      expect(ssns).toHaveLength(1);
      expect(ssns[0].matchedText).toBe('123-45-6789');
    });

    it('detects 9 consecutive digits', () => {
      const result = scan('SSN: 123456789');
      const ssns = result.filter((e) => e.type === 'SSN');
      expect(ssns).toHaveLength(1);
      expect(ssns[0].matchedText).toBe('123456789');
    });
  });

  describe('Credit card detection', () => {
    it('detects 16-digit card with dashes', () => {
      const result = scan('Card: 4111-1111-1111-1111');
      const cards = result.filter((e) => e.type === 'CREDIT_CARD');
      expect(cards).toHaveLength(1);
      expect(cards[0].matchedText).toBe('4111-1111-1111-1111');
    });

    it('detects 16-digit card with spaces', () => {
      const result = scan('Card: 4111 1111 1111 1111');
      const cards = result.filter((e) => e.type === 'CREDIT_CARD');
      expect(cards).toHaveLength(1);
      expect(cards[0].matchedText).toBe('4111 1111 1111 1111');
    });

    it('detects 16 consecutive digits', () => {
      const result = scan('Card: 4111111111111111');
      const cards = result.filter((e) => e.type === 'CREDIT_CARD');
      expect(cards).toHaveLength(1);
    });
  });

  describe('Address detection', () => {
    it('detects a street address', () => {
      const result = scan('I live at 123 Main Street');
      const addrs = result.filter((e) => e.type === 'ADDRESS');
      expect(addrs).toHaveLength(1);
      expect(addrs[0].matchedText).toContain('123 Main Street');
    });

    it('detects a full address with city, state, zip', () => {
      const result = scan('Address: 456 Oak Avenue, Springfield, IL 62704');
      const addrs = result.filter((e) => e.type === 'ADDRESS');
      expect(addrs).toHaveLength(1);
    });
  });

  describe('File path detection', () => {
    it('detects Unix absolute paths', () => {
      const result = scan('Error at /home/user/project/src/main.ts');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(1);
      expect(paths[0].matchedText).toBe('/home/user/project/src/main.ts');
    });

    it('detects Unix home-relative paths', () => {
      const result = scan('File at ~/Documents/secret.pdf');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(1);
      expect(paths[0].matchedText).toBe('~/Documents/secret.pdf');
    });

    it('detects Windows drive paths', () => {
      const result = scan('File at C:\\Users\\john\\Documents\\file.txt');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(1);
      expect(paths[0].matchedText).toBe('C:\\Users\\john\\Documents\\file.txt');
    });

    it('detects Windows UNC paths', () => {
      const result = scan('Share at \\\\server\\share\\folder');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(1);
      expect(paths[0].matchedText).toBe('\\\\server\\share\\folder');
    });

    it('does not flag single forward slashes', () => {
      const result = scan('Use a / to separate');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(0);
    });

    it('does not flag lone tildes', () => {
      const result = scan('Use ~ for home');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(0);
    });

    it('does not flag URLs as file paths', () => {
      const result = scan('Visit https://example.com/path/to/page');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(0);
    });

    it('does not flag http URLs as file paths', () => {
      const result = scan('Visit http://example.com/path/to/page');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(0);
    });

    it('detects paths with spaces, dots, hyphens, underscores', () => {
      const result = scan('Path: /home/user/my project/file-name_v2.0.txt');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(1);
      expect(paths[0].matchedText).toBe('/home/user/my project/file-name_v2.0.txt');
    });
  });

  describe('Placeholder skipping', () => {
    it('does not flag [EMAIL_REDACTED] as PII', () => {
      const result = scan('Contact [EMAIL_REDACTED] for info');
      expect(result).toHaveLength(0);
    });

    it('does not flag [FILE_PATH_REDACTED] as a file path', () => {
      const result = scan('Error at [FILE_PATH_REDACTED]');
      const paths = result.filter((e) => e.type === 'FILE_PATH');
      expect(paths).toHaveLength(0);
    });

    it('does not flag any redacted placeholder as PII', () => {
      const text = '[EMAIL_REDACTED] [PHONE_REDACTED] [SSN_REDACTED] [CREDIT_CARD_REDACTED] [ADDRESS_REDACTED] [FILE_PATH_REDACTED]';
      const result = scan(text);
      expect(result).toHaveLength(0);
    });
  });

  describe('Sorting', () => {
    it('returns entities sorted by startIndex', () => {
      const result = scan('Email user@test.com and SSN 123-45-6789');
      expect(result.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].startIndex).toBeGreaterThanOrEqual(result[i - 1].startIndex);
      }
    });
  });

  describe('Empty / no PII', () => {
    it('returns empty list for text with no PII', () => {
      const result = scan('Hello world, this is a normal message.');
      expect(result).toHaveLength(0);
    });

    it('returns empty list for empty string', () => {
      const result = scan('');
      expect(result).toHaveLength(0);
    });
  });

  describe('Position accuracy', () => {
    it('matchedText equals text.substring(startIndex, endIndex)', () => {
      const text = 'Send to user@example.com and call 555-123-4567';
      const result = scan(text);
      for (const entity of result) {
        expect(text.substring(entity.startIndex, entity.endIndex)).toBe(entity.matchedText);
      }
    });
  });
});
