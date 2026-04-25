import { describe, it, expect } from 'vitest';
import { getRiskLevel, getPIIIcon, RISK_LEVEL_MAP } from '../src/frontend/types';
import type { PIIType } from '../src/types';

describe('getRiskLevel', () => {
  it('returns "High Risk" for SSN', () => {
    expect(getRiskLevel('SSN')).toBe('High Risk');
  });

  it('returns "High Risk" for CREDIT_CARD', () => {
    expect(getRiskLevel('CREDIT_CARD')).toBe('High Risk');
  });

  it('returns "Medium Risk" for EMAIL', () => {
    expect(getRiskLevel('EMAIL')).toBe('Medium Risk');
  });

  it('returns "Medium Risk" for PHONE', () => {
    expect(getRiskLevel('PHONE')).toBe('Medium Risk');
  });

  it('returns "Low Risk" for ADDRESS', () => {
    expect(getRiskLevel('ADDRESS')).toBe('Low Risk');
  });

  it('returns "Low Risk" for FILE_PATH', () => {
    expect(getRiskLevel('FILE_PATH')).toBe('Low Risk');
  });

  it('returns the same value as RISK_LEVEL_MAP for all types', () => {
    const types: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];
    for (const type of types) {
      expect(getRiskLevel(type)).toBe(RISK_LEVEL_MAP[type]);
    }
  });
});

describe('getPIIIcon', () => {
  it('returns an icon for EMAIL', () => {
    expect(getPIIIcon('EMAIL')).toBe('📧');
  });

  it('returns an icon for PHONE', () => {
    expect(getPIIIcon('PHONE')).toBe('📱');
  });

  it('returns an icon for SSN', () => {
    expect(getPIIIcon('SSN')).toBe('🔒');
  });

  it('returns an icon for CREDIT_CARD', () => {
    expect(getPIIIcon('CREDIT_CARD')).toBe('💳');
  });

  it('returns an icon for ADDRESS', () => {
    expect(getPIIIcon('ADDRESS')).toBe('🏠');
  });

  it('returns an icon for FILE_PATH', () => {
    expect(getPIIIcon('FILE_PATH')).toBe('📁');
  });

  it('returns a non-empty string for every PIIType', () => {
    const types: PIIType[] = ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD', 'ADDRESS', 'FILE_PATH'];
    for (const type of types) {
      const icon = getPIIIcon(type);
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    }
  });
});
