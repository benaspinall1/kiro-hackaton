/**
 * Frontend-specific types and constants for the Chat Frontend PII Panel.
 *
 * Re-exports shared backend types and defines frontend-only interfaces,
 * color mappings, and risk level classifications.
 */
export { PIIType, PIIEntity, RedactionResult, ChatRequest, ChatResponse, } from '../types';
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
export declare const PII_COLOR_MAP: Record<PIIType, string>;
/**
 * Risk level classification for each PII type.
 * Validates: Requirement 5.3
 */
export declare const RISK_LEVEL_MAP: Record<PIIType, RiskLevel>;
/**
 * Returns the risk level classification for a given PII type.
 * Validates: Requirement 5.3
 */
export declare function getRiskLevel(type: PIIType): RiskLevel;
/**
 * Returns a type-appropriate icon identifier for a given PII type.
 * Validates: Requirement 5.1
 */
export declare function getPIIIcon(type: PIIType): string;
//# sourceMappingURL=types.d.ts.map