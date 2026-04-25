/**
 * ChatWindow component — renders the full chat window as an HTML string.
 *
 * Includes a scrollable message list, a loading indicator, and a fixed
 * message input area with a send button at the bottom of the viewport.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 10.3
 */

import type { ChatWindowState } from '../types';
import { renderMessageBubble } from './message-bubble';

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
 * Renders the full chat window as an HTML string.
 *
 * The message list auto-scrolls to the most recent message via a scroll
 * anchor element. The input area is fixed at the bottom of the viewport.
 * The send button is disabled when inputText is empty or isLoading is true.
 * A loading indicator is visible when isLoading is true.
 *
 * Action elements use class names and data attributes for external wiring:
 * - Send button: `class="send-btn"` with `data-action="send"`
 * - Message input: `class="message-input"`
 * - Message list: `class="message-list"`
 *
 * @param state - The current chat window state
 * @returns HTML string representing the chat window
 */
export function renderChatWindow(state: ChatWindowState): string {
  const { messages, isLoading, inputText } = state;

  const sendDisabled = inputText.trim() === '' || isLoading;
  const disabledAttr = sendDisabled ? ' disabled' : '';

  const messagesHtml = messages
    .map((msg) => renderMessageBubble(msg))
    .join('');

  const loadingHtml = isLoading
    ? '<div class="loading-indicator" style="text-align: center; padding: 8px; color: #6B7280;">Processing...</div>'
    : '';

  return (
    '<div class="chat-window" style="display: flex; flex-direction: column; height: 100vh;">' +
      // Scrollable message list
      '<div class="message-list" style="flex: 1; overflow-y: auto; padding: 16px;">' +
        messagesHtml +
        loadingHtml +
        '<div class="scroll-anchor"></div>' +
      '</div>' +
      // Fixed input area at bottom
      '<div class="message-input-area" style="position: fixed; bottom: 0; left: 0; right: 0; padding: 12px 16px; background-color: #FFFFFF; border-top: 1px solid #E5E7EB; display: flex; gap: 8px; align-items: center;">' +
        `<input class="message-input" type="text" value="${escapeHtml(inputText)}" placeholder="Type a message..." ` +
        'style="flex: 1; padding: 10px 12px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 14px;" ' +
        'data-action="input" />' +
        `<button class="send-btn" data-action="send"${disabledAttr} ` +
        'style="padding: 10px 20px; background-color: #3B82F6; color: #FFFFFF; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">' +
        'Send</button>' +
      '</div>' +
    '</div>'
  );
}
