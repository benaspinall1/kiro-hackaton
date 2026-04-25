import { PIIEntity, RedactionResult } from './types';
/**
 * Replaces detected PII entities in text with type-specific placeholders.
 * Processes entities in reverse startIndex order to preserve character positions.
 */
export declare function redact(text: string, entities: PIIEntity[]): RedactionResult;
//# sourceMappingURL=redaction-engine.d.ts.map