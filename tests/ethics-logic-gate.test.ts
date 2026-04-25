import { describe, it, expect, vi } from 'vitest';
import { evaluate, validateConfig } from '../src/ethics-logic-gate';
import { PIIEntity, PrivacyRuleConfig } from '../src/types';

describe('Ethics_Logic_Gate', () => {
  describe('evaluate', () => {
    it('should block when any entity matches a block rule', () => {
      const entities: PIIEntity[] = [
        { type: 'SSN', matchedText: '123-45-6789', startIndex: 0, endIndex: 11 },
        { type: 'EMAIL', matchedText: 'test@example.com', startIndex: 15, endIndex: 31 },
      ];
      const rules: PrivacyRuleConfig = {
        rules: { SSN: 'block', EMAIL: 'redact' },
      };

      const result = evaluate(entities, rules);

      expect(result.allowed).toBe(false);
      expect(result.blockedTypes).toEqual(['SSN']);
      expect(result.reason).not.toBeNull();
    });

    it('should include all blocked types when multiple entities match block rules', () => {
      const entities: PIIEntity[] = [
        { type: 'SSN', matchedText: '123-45-6789', startIndex: 0, endIndex: 11 },
        { type: 'CREDIT_CARD', matchedText: '4111111111111111', startIndex: 15, endIndex: 31 },
        { type: 'EMAIL', matchedText: 'test@example.com', startIndex: 35, endIndex: 51 },
      ];
      const rules: PrivacyRuleConfig = {
        rules: { SSN: 'block', CREDIT_CARD: 'block', EMAIL: 'redact' },
      };

      const result = evaluate(entities, rules);

      expect(result.allowed).toBe(false);
      expect(result.blockedTypes).toContain('SSN');
      expect(result.blockedTypes).toContain('CREDIT_CARD');
      expect(result.blockedTypes).not.toContain('EMAIL');
    });

    it('should allow when all entities match redact rules', () => {
      const entities: PIIEntity[] = [
        { type: 'EMAIL', matchedText: 'test@example.com', startIndex: 0, endIndex: 16 },
        { type: 'PHONE', matchedText: '555-123-4567', startIndex: 20, endIndex: 32 },
      ];
      const rules: PrivacyRuleConfig = {
        rules: { EMAIL: 'redact', PHONE: 'redact' },
      };

      const result = evaluate(entities, rules);

      expect(result.allowed).toBe(true);
      expect(result.blockedTypes).toEqual([]);
      expect(result.reason).toBeNull();
    });

    it('should default to redact when PII type is not in config', () => {
      const entities: PIIEntity[] = [
        { type: 'EMAIL', matchedText: 'test@example.com', startIndex: 0, endIndex: 16 },
        { type: 'FILE_PATH', matchedText: '/home/user/file.txt', startIndex: 20, endIndex: 39 },
      ];
      const rules: PrivacyRuleConfig = {
        rules: {}, // empty config → all default to redact
      };

      const result = evaluate(entities, rules);

      expect(result.allowed).toBe(true);
      expect(result.blockedTypes).toEqual([]);
      expect(result.reason).toBeNull();
    });

    it('should allow when entity list is empty', () => {
      const rules: PrivacyRuleConfig = {
        rules: { SSN: 'block', EMAIL: 'block' },
      };

      const result = evaluate([], rules);

      expect(result.allowed).toBe(true);
      expect(result.blockedTypes).toEqual([]);
      expect(result.reason).toBeNull();
    });

    it('should not duplicate blocked types when multiple entities of the same type exist', () => {
      const entities: PIIEntity[] = [
        { type: 'SSN', matchedText: '123-45-6789', startIndex: 0, endIndex: 11 },
        { type: 'SSN', matchedText: '987-65-4321', startIndex: 15, endIndex: 26 },
      ];
      const rules: PrivacyRuleConfig = {
        rules: { SSN: 'block' },
      };

      const result = evaluate(entities, rules);

      expect(result.allowed).toBe(false);
      expect(result.blockedTypes).toEqual(['SSN']);
    });

    it('should default to blocking and log error on internal error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Force an internal error by passing a malformed rules object
      // that will throw when accessed
      const trap = new Proxy({} as PrivacyRuleConfig, {
        get(_target, prop) {
          if (prop === 'rules') {
            throw new Error('Simulated internal error');
          }
          return undefined;
        },
      });

      const entities: PIIEntity[] = [
        { type: 'EMAIL', matchedText: 'test@example.com', startIndex: 0, endIndex: 16 },
      ];

      const result = evaluate(entities, trap);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('internal error');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('validateConfig', () => {
    it('should accept config with all supported PII types', () => {
      const config: PrivacyRuleConfig = {
        rules: {
          EMAIL: 'redact',
          PHONE: 'block',
          SSN: 'block',
          CREDIT_CARD: 'redact',
          ADDRESS: 'redact',
          FILE_PATH: 'block',
        },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept empty config', () => {
      const config: PrivacyRuleConfig = { rules: {} };
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept config with a subset of supported types', () => {
      const config: PrivacyRuleConfig = {
        rules: { EMAIL: 'redact', SSN: 'block' },
      };
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should reject config referencing unsupported PII types', () => {
      const config = {
        rules: { EMAIL: 'redact', PASSPORT: 'block' },
      } as unknown as PrivacyRuleConfig;

      expect(() => validateConfig(config)).toThrow('Unsupported PII type');
      expect(() => validateConfig(config)).toThrow('PASSPORT');
    });

    it('should reject config with multiple unsupported types', () => {
      const config = {
        rules: { BIOMETRIC: 'block', DNA: 'redact' },
      } as unknown as PrivacyRuleConfig;

      expect(() => validateConfig(config)).toThrow('Unsupported PII type');
    });
  });
});
