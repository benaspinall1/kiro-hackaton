import { PIIEntity, GateResult, PrivacyRuleConfig } from './types';
/**
 * Validates a PrivacyRuleConfig, ensuring all referenced PII types are supported.
 * Throws an error if any unsupported PII type is found.
 */
export declare function validateConfig(config: PrivacyRuleConfig): void;
/**
 * Evaluates detected PII entities against privacy rules and decides
 * whether to block or allow the message.
 *
 * - If any entity matches a "block" rule, the entire message is blocked.
 * - If all entities match "redact" rules (or type is absent from config, defaulting to "redact"),
 *   the message is allowed.
 * - On internal error, defaults to blocking and logs the error.
 */
export declare function evaluate(entities: PIIEntity[], rules: PrivacyRuleConfig): GateResult;
//# sourceMappingURL=ethics-logic-gate.d.ts.map