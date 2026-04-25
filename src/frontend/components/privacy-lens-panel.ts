/**
 * PrivacyLensPanel component — renders the slide-out PII review panel as an HTML string.
 *
 * Displays a header with PII count, subtitle, one PIIItemCard per entity,
 * auto-redact and confirm send buttons, a close button, and a stats footer.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 6.3, 8.1
 */

import type { PIIItemState } from '../types';
import { renderPIIItemCard } from './pii-item-card';

/**
 * Props for the PrivacyLensPanel component.
 */
export interface PrivacyLensPanelProps {
  items: PIIItemState[];
  sessionStats: number;
  isOpen: boolean;
}

/**
 * Renders the PrivacyLens slide-out panel as an HTML string.
 *
 * Action buttons use data attributes and class names for external event wiring:
 * - Close button: `class="privacy-lens-close"` with `data-action="close"`
 * - Auto-redact button: `class="auto-redact-btn"` with `data-action="auto-redact-all"`
 * - Confirm send button: `class="confirm-send-btn"` with `data-action="confirm-send"`
 *
 * @param props - The panel props including items, session stats, and open state
 * @returns HTML string representing the PrivacyLens panel
 */
export function renderPrivacyLensPanel(props: PrivacyLensPanelProps): string {
  const { items, sessionStats, isOpen } = props;
  const count = items.length;

  const translateX = isOpen ? 'translateX(0)' : 'translateX(100%)';

  const panelStyle = [
    'position: fixed',
    'top: 0',
    'right: 0',
    'width: 360px',
    'height: 100%',
    'background-color: #F9FAFB',
    'box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15)',
    `transform: ${translateX}`,
    'transition: transform 0.3s ease',
    'display: flex',
    'flex-direction: column',
    'z-index: 1000',
  ].join('; ');

  const cardsHtml = items
    .map((item, index) => renderPIIItemCard(item, index))
    .join('');

  return (
    `<div class="privacy-lens-panel" style="${panelStyle}" data-open="${isOpen}">` +
      // Header area
      `<div class="privacy-lens-header" style="padding: 16px; border-bottom: 1px solid #E5E7EB;">` +
        `<div style="display: flex; justify-content: space-between; align-items: center;">` +
          `<h2 class="privacy-lens-title" style="margin: 0; font-size: 18px; font-weight: 700;">${count} PII items detected</h2>` +
          `<button class="privacy-lens-close" data-action="close" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px;">✕</button>` +
        `</div>` +
        `<p class="privacy-lens-subtitle" style="margin: 4px 0 0; font-size: 14px; color: #6B7280;">Review detected items before sending</p>` +
      `</div>` +
      // Scrollable card list
      `<div class="privacy-lens-items" style="flex: 1; overflow-y: auto; padding: 16px;">` +
        cardsHtml +
      `</div>` +
      // Action buttons
      `<div class="privacy-lens-actions" style="padding: 16px; border-top: 1px solid #E5E7EB; display: flex; flex-direction: column; gap: 8px;">` +
        `<button class="auto-redact-btn" data-action="auto-redact-all" style="width: 100%; padding: 10px; background-color: #F59E0B; color: #FFFFFF; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">Auto-Redact All</button>` +
        `<button class="confirm-send-btn" data-action="confirm-send" style="width: 100%; padding: 10px; background-color: #3B82F6; color: #FFFFFF; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">Confirm &amp; Send</button>` +
      `</div>` +
      // Stats footer
      `<div class="privacy-lens-footer" style="padding: 12px 16px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 13px; color: #6B7280;">` +
        `${sessionStats} items protected today` +
      `</div>` +
    `</div>`
  );
}
