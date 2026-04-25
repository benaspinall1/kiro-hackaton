/**
 * Chat Frontend PII Panel — entry point.
 *
 * Re-exports all frontend types, constants, and (future) components.
 */

export {
  // Backend re-exports
  PIIType,
  PIIEntity,
  RedactionResult,
  ChatRequest,
  ChatResponse,
  // Frontend types
  RiskLevel,
  ChatMessage,
  PIIItemState,
  TextSegment,
  SessionStats,
  // Constants
  PII_COLOR_MAP,
  RISK_LEVEL_MAP,
  // Utility functions
  getRiskLevel,
  getPIIIcon,
} from './types';
