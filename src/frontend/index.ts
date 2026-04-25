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
  ChatWindowState,
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

export { segmentText } from './pii-highlighter';

export { filterEnabledEntities, autoRedactAll } from './redaction-filter';

export { renderMessageBubble } from './components/message-bubble';

export { renderPIIItemCard } from './components/pii-item-card';

export { renderPrivacyLensPanel } from './components/privacy-lens-panel';
export type { PrivacyLensPanelProps } from './components/privacy-lens-panel';

export { renderChatWindow } from './components/chat-window';
