/**
 * Chat Frontend PII Panel — entry point.
 *
 * Re-exports all frontend types, constants, and (future) components.
 */
export { PIIType, PIIEntity, RedactionResult, ChatRequest, ChatResponse, RiskLevel, ChatMessage, PIIItemState, TextSegment, SessionStats, PII_COLOR_MAP, RISK_LEVEL_MAP, getRiskLevel, getPIIIcon, } from './types';
export { segmentText } from './pii-highlighter';
export { filterEnabledEntities, autoRedactAll } from './redaction-filter';
//# sourceMappingURL=index.d.ts.map