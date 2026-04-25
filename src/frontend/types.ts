/**
 * Frontend-specific types and constants for the Chat Frontend PII Panel.
 *
 * Re-exports shared backend types and defines frontend-only interfaces,
 * color mappings, and risk level classifications.
 */

// Re-export shared backend types
export {
  PIIType,
  PIIEntity,
  RedactionResult,
  ChatRequest,
  ChatResponse,
} from '../types';

import type { PIIType, PIIEntity } from '../types';

/**
 * Risk classification for PII types.
 */
export type RiskLevel = 'High Risk' | 'Medium Risk' | 'Low Risk';

/**
 * A chat message in the conversation.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  piiEntities?: PIIEntity[];
  redactedText?: string;
  timestamp: Date;
  isError?: boolean;
}

/**
 * State for a PII item in the PrivacyLens panel.
 */
export interface PIIItemState {
  entity: PIIEntity;
  redactionEnabled: boolean;
}

/**
 * A segment of message text, optionally highlighted for a PII entity.
 */
export interface TextSegment {
  text: string;
  entity?: PIIEntity;
  isHighlighted: boolean;
}

/**
 * Session statistics stored in sessionStorage.
 */
export interface SessionStats {
  itemsProtected: number;
}

/**
 * Background color map for inline PII highlighting.
 * Each PIIType maps to a CSS background color string.
 * Validates: Requirement 3.2
 */
export const PII_COLOR_MAP: Record<PIIType, string> = {
  EMAIL: '#DBEAFE',       // blue
  PHONE: '#FFEDD5',       // orange
  SSN: '#FEE2E2',         // red
  CREDIT_CARD: '#F3E8FF', // purple
  ADDRESS: '#DCFCE7',     // green
  FILE_PATH: '#F3F4F6',   // gray
};

/**
 * Risk level classification for each PII type.
 * Validates: Requirement 5.3
 */
export const RISK_LEVEL_MAP: Record<PIIType, RiskLevel> = {
  SSN: 'High Risk',
  CREDIT_CARD: 'High Risk',
  EMAIL: 'Medium Risk',
  PHONE: 'Medium Risk',
  ADDRESS: 'Low Risk',
  FILE_PATH: 'Low Risk',
};

/**
 * Icon identifier map for each PII type.
 */
const PII_ICON_MAP: Record<PIIType, string> = {
  EMAIL: '📧',
  PHONE: '📱',
  SSN: '🔒',
  CREDIT_CARD: '💳',
  ADDRESS: '🏠',
  FILE_PATH: '📁',
};

/**
 * Returns the risk level classification for a given PII type.
 * Validates: Requirement 5.3
 */
export function getRiskLevel(type: PIIType): RiskLevel {
  return RISK_LEVEL_MAP[type];
}

/**
 * Returns a type-appropriate icon identifier for a given PII type.
 * Validates: Requirement 5.1
 */
export function getPIIIcon(type: PIIType): string {
  return PII_ICON_MAP[type];
}
