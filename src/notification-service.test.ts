import { describe, it, expect } from 'vitest';
import { createRedactionNotification, createBlockNotification } from './notification-service';
import { RedactionAction } from './types';

describe('NotificationService', () => {
  describe('createRedactionNotification', () => {
    it('should return null for an empty redactions list', () => {
      const result = createRedactionNotification([]);
      expect(result).toBeNull();
    });

    it('should produce a redaction notification with a single type', () => {
      const redactions: RedactionAction[] = [
        { entityType: 'EMAIL', originalText: 'a@b.com', placeholder: '[EMAIL_REDACTED]', startIndex: 0, endIndex: 7 },
      ];
      const result = createRedactionNotification(redactions);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('redaction');
      expect(result!.details.EMAIL).toBe(1);
      expect(result!.details.PHONE).toBe(0);
      expect(result!.message).toContain('1 EMAIL');
    });

    it('should produce correct per-type counts with multiple types', () => {
      const redactions: RedactionAction[] = [
        { entityType: 'EMAIL', originalText: 'a@b.com', placeholder: '[EMAIL_REDACTED]', startIndex: 0, endIndex: 7 },
        { entityType: 'PHONE', originalText: '555-123-4567', placeholder: '[PHONE_REDACTED]', startIndex: 10, endIndex: 22 },
        { entityType: 'EMAIL', originalText: 'c@d.com', placeholder: '[EMAIL_REDACTED]', startIndex: 25, endIndex: 32 },
        { entityType: 'SSN', originalText: '123-45-6789', placeholder: '[SSN_REDACTED]', startIndex: 35, endIndex: 46 },
      ];
      const result = createRedactionNotification(redactions);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('redaction');
      expect(result!.details.EMAIL).toBe(2);
      expect(result!.details.PHONE).toBe(1);
      expect(result!.details.SSN).toBe(1);
      expect(result!.details.CREDIT_CARD).toBe(0);
      expect(result!.details.ADDRESS).toBe(0);
      expect(result!.details.FILE_PATH).toBe(0);
    });

    it('should count FILE_PATH redactions correctly', () => {
      const redactions: RedactionAction[] = [
        { entityType: 'FILE_PATH', originalText: '/home/user/file.txt', placeholder: '[FILE_PATH_REDACTED]', startIndex: 0, endIndex: 19 },
        { entityType: 'FILE_PATH', originalText: 'C:\\Users\\doc.txt', placeholder: '[FILE_PATH_REDACTED]', startIndex: 25, endIndex: 41 },
      ];
      const result = createRedactionNotification(redactions);
      expect(result).not.toBeNull();
      expect(result!.details.FILE_PATH).toBe(2);
    });
  });

  describe('createBlockNotification', () => {
    it('should produce a block notification with blocked types and reason', () => {
      const result = createBlockNotification(['SSN', 'CREDIT_CARD'], 'Privacy rule violation');
      expect(result.type).toBe('block');
      expect(result.details.SSN).toBe(1);
      expect(result.details.CREDIT_CARD).toBe(1);
      expect(result.details.EMAIL).toBe(0);
      expect(result.message).toContain('Privacy rule violation');
      expect(result.message).toContain('SSN');
      expect(result.message).toContain('CREDIT_CARD');
    });

    it('should handle a single blocked type', () => {
      const result = createBlockNotification(['EMAIL'], 'Blocked by policy');
      expect(result.type).toBe('block');
      expect(result.details.EMAIL).toBe(1);
      expect(result.message).toContain('Blocked by policy');
    });
  });
});
