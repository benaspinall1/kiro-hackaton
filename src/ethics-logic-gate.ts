import { PIIType, PIIEntity, GateResult, PrivacyRuleConfig } from './types';

/**
 * Supported PII types for validation.
 */
const SUPPORTED_PII_TYPES: ReadonlySet<string> = new Set<PIIType>([
  'EMAIL',
  'PHONE',
  'SSN',
  'CREDIT_CARD',
  'ADDRESS',
  'FILE_PATH',
]);

/**
 * Validates a PrivacyRuleConfig, ensuring all referenced PII types are supported.
 * Throws an error if any unsupported PII type is found.
 */
export function validateConfig(config: PrivacyRuleConfig): void {
  for (const key of Object.keys(config.rules)) {
    if (!SUPPORTED_PII_TYPES.has(key)) {
      throw new Error(
        `Unsupported PII type in privacy rule config: "${key}". Supported types: ${[...SUPPORTED_PII_TYPES].join(', ')}`
      );
    }
  }
}

/**
 * Evaluates detected PII entities against privacy rules and decides
 * whether to block or allow the message.
 *
 * - If any entity matches a "block" rule, the entire message is blocked.
 * - If all entities match "redact" rules (or type is absent from config, defaulting to "redact"),
 *   the message is allowed.
 * - On internal error, defaults to blocking and logs the error.
 */
export function evaluate(entities: PIIEntity[], rules: PrivacyRuleConfig): GateResult {
  try {
    // No entities → nothing to block
    if (entities.length === 0) {
      return { allowed: true, blockedTypes: [], reason: null };
    }

    const blockedTypes: PIIType[] = [];

    for (const entity of entities) {
      const action = rules.rules[entity.type] ?? 'redact';
      if (action === 'block' && !blockedTypes.includes(entity.type)) {
        blockedTypes.push(entity.type);
      }
    }

    if (blockedTypes.length > 0) {
      return {
        allowed: false,
        blockedTypes,
        reason: `Message blocked: PII types [${blockedTypes.join(', ')}] violate privacy rules configured as "block".`,
      };
    }

    return { allowed: true, blockedTypes: [], reason: null };
  } catch (error) {
    console.error('Ethics_Logic_Gate: internal error during rule evaluation', error);
    return {
      allowed: false,
      blockedTypes: [],
      reason: 'Message blocked due to internal error in Ethics Logic Gate.',
    };
  }
}
