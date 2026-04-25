/**
 * MessageBubble component — renders a single chat message as an HTML string.
 *
 * User messages are right-aligned, assistant messages are left-aligned.
 * Error messages use distinct error styling.
 * User messages with PII entities render inline PII_Highlight spans
 * using segmentText and PII_COLOR_MAP, with muted style for toggled-off entities.
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 3.1, 3.2, 3.4, 6.4
 */

import type { ChatMessage } from '../types';
import { PII_COLOR_MAP } from '../types';
import { segmentText } from '../pii-highlighter';

/** Background color for user message bubbles. */
const USER_BG = '#DCF8C6';

/** Background color for assistant message bubbles. */
const ASSISTANT_BG = '#FFFFFF';

/** Background color for error message bubbles. */
const ERROR_BG = '#FEE2E2';

/** Border color for error message bubbles. */
const ERROR_BORDER = '#EF4444';

/** Text color for error message bubbles. */
const ERROR_TEXT_COLOR = '#991B1B';

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
 * Renders a chat message as an HTML string.
 *
 * @param message - The chat message to render
 * @param disabledEntityIndices - Set of entity indices (into message.piiEntities) that are toggled off
 * @returns HTML string representing the message bubble
 */
export function renderMessageBubble(
  message: ChatMessage,
  disabledEntityIndices?: Set<number>,
): string {
  const isUser = message.role === 'user';
  const alignment = isUser ? 'right' : 'left';
  const isError = message.isError === true;

  let bgColor: string;
  let extraStyles = '';

  if (isError) {
    bgColor = ERROR_BG;
    extraStyles = `border: 1px solid ${ERROR_BORDER}; color: ${ERROR_TEXT_COLOR};`;
  } else {
    bgColor = isUser ? USER_BG : ASSISTANT_BG;
  }

  const bubbleStyle = [
    `text-align: ${alignment}`,
    `background-color: ${bgColor}`,
    `padding: 8px 12px`,
    `border-radius: 8px`,
    `margin: 4px 0`,
    `max-width: 70%`,
    `display: inline-block`,
    extraStyles,
  ]
    .filter(Boolean)
    .join('; ');

  const wrapperAlign = isUser ? 'right' : 'left';
  const content = renderContent(message, disabledEntityIndices);

  return (
    `<div class="message-row" style="text-align: ${wrapperAlign};">` +
    `<div class="message-bubble ${isError ? 'message-error' : `message-${message.role}`}" ` +
    `style="${bubbleStyle}">` +
    content +
    `</div>` +
    `</div>`
  );
}

/**
 * Renders the inner content of a message bubble.
 * For user messages with PII entities, produces highlighted spans.
 * Otherwise, renders escaped plain text.
 */
function renderContent(
  message: ChatMessage,
  disabledEntityIndices?: Set<number>,
): string {
  const entities = message.piiEntities;

  // Only user messages with PII entities get inline highlighting
  if (message.role === 'user' && entities && entities.length > 0) {
    return renderHighlightedContent(message.text, entities, disabledEntityIndices);
  }

  return `<span>${escapeHtml(message.text)}</span>`;
}

/**
 * Renders message text with inline PII highlight spans.
 * Toggled-off entities use a muted (reduced opacity) style.
 */
function renderHighlightedContent(
  text: string,
  entities: import('../types').PIIEntity[],
  disabledEntityIndices?: Set<number>,
): string {
  const segments = segmentText(text, entities);
  const disabled = disabledEntityIndices ?? new Set<number>();

  // Build a map from entity reference to its index in the original array
  const entityIndexMap = new Map<import('../types').PIIEntity, number>();
  for (let i = 0; i < entities.length; i++) {
    entityIndexMap.set(entities[i], i);
  }

  return segments
    .map((segment) => {
      if (!segment.isHighlighted || !segment.entity) {
        return escapeHtml(segment.text);
      }

      const entityIdx = entityIndexMap.get(segment.entity);
      const isMuted = entityIdx !== undefined && disabled.has(entityIdx);
      const color = PII_COLOR_MAP[segment.entity.type];
      const opacity = isMuted ? '0.4' : '1';

      return (
        `<span class="pii-highlight" ` +
        `style="background-color: ${color}; opacity: ${opacity}; ` +
        `padding: 1px 3px; border-radius: 3px;" ` +
        `data-pii-type="${segment.entity.type}">` +
        escapeHtml(segment.text) +
        `</span>`
      );
    })
    .join('');
}
