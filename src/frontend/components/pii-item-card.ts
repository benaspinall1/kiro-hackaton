/**
 * PIIItemCard component — renders a single PII entity card as an HTML string.
 *
 * Displays the PII type icon, label, risk level badge, matched text value,
 * and a redaction toggle switch defaulting to enabled.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import type { PIIItemState } from '../types';
import { getPIIIcon, getRiskLevel } from '../types';
import type { RiskLevel } from '../types';

/** Risk level badge color mapping. */
const RISK_BADGE_COLORS: Record<RiskLevel, string> = {
  'High Risk': '#EF4444',
  'Medium Risk': '#F59E0B',
  'Low Risk': '#22C55E',
};

/**
 * Escapes HTML special characters to prevent XSS in rendered output.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders a PII item card as an HTML string.
 *
 * @param item - The PII item state containing entity and redaction toggle state
 * @param index - The index of this item, used as a data attribute for external event wiring
 * @returns HTML string representing the PII item card
 */
export function renderPIIItemCard(item: PIIItemState, index: number): string {
  const { entity, redactionEnabled } = item;
  const icon = getPIIIcon(entity.type);
  const riskLevel = getRiskLevel(entity.type);
  const badgeColor = RISK_BADGE_COLORS[riskLevel];
  const checkedAttr = redactionEnabled ? ' checked' : '';

  return (
    `<div class="pii-item-card" style="display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid #E5E7EB; border-radius: 8px; margin-bottom: 8px;">` +
      `<span class="pii-icon" style="font-size: 20px;">${icon}</span>` +
      `<div class="pii-item-details" style="flex: 1; min-width: 0;">` +
        `<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">` +
          `<span class="pii-type-label" style="font-weight: 600;">${escapeHtml(entity.type)}</span>` +
          `<span class="risk-badge" style="background-color: ${badgeColor}; color: #FFFFFF; font-size: 11px; padding: 2px 6px; border-radius: 4px;">${escapeHtml(riskLevel)}</span>` +
        `</div>` +
        `<span class="pii-matched-text" style="font-size: 13px; color: #6B7280; word-break: break-all;">${escapeHtml(entity.matchedText)}</span>` +
      `</div>` +
      `<label class="redaction-toggle" style="position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0;">` +
        `<input type="checkbox" data-pii-index="${index}"${checkedAttr} style="opacity: 0; width: 0; height: 0;" />` +
        `<span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${redactionEnabled ? '#22C55E' : '#D1D5DB'}; border-radius: 20px; transition: background-color 0.2s;"></span>` +
      `</label>` +
    `</div>`
  );
}
