/**
 * Chat Frontend PII Panel — entry point.
 *
 * Re-exports all frontend types, constants, and components.
 * Provides `initApp()` factory that wires all components together
 * with real API service and session stats dependencies.
 *
 * Validates: Requirements 4.1, 4.5, 4.6, 6.3, 8.1, 8.3
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

export { ChatController } from './chat-controller';
export type { ChatControllerDeps, ChatControllerCallbacks } from './chat-controller';

export { getResponsiveStyles, renderAppLayout } from './styles';

import type { ChatMessage, PIIItemState, ChatWindowState } from './types';
import type { PrivacyLensPanelProps } from './components/privacy-lens-panel';
import { ChatController } from './chat-controller';
import type { ChatControllerDeps, ChatControllerCallbacks } from './chat-controller';
import { scanForPII, redactText, sendMessage } from './api-service';
import { getSessionStats, incrementSessionStats } from './session-stats';
import { renderChatWindow } from './components/chat-window';
import { renderPrivacyLensPanel } from './components/privacy-lens-panel';
import { renderAppLayout } from './styles';
import { autoRedactAll } from './redaction-filter';

/**
 * Application state managed by initApp, used by the render function.
 */
export interface AppState {
  chatWindow: ChatWindowState;
  panel: PrivacyLensPanelProps;
}

/**
 * The object returned by `initApp()`.
 */
export interface AppInstance {
  controller: ChatController;
  render: (state: AppState) => string;
  getState: () => AppState;
}

/**
 * Initializes the chat application by wiring all components together.
 *
 * Creates a ChatController with real API service and session stats deps,
 * sets up callbacks that update internal state on changes, and provides
 * a render function that produces the full HTML layout string.
 *
 * Since there is no real DOM in Node.js, this is a factory that returns
 * `{ controller, render, getState }` for external use.
 *
 * - PrivacyLensPanel toggle events update PIIItemState via controller.toggleRedaction
 * - Auto_Redact_Button connects to controller.autoRedactAll
 * - Close button connects to controller.closePanel
 * - Stats_Footer reads from getSessionStats
 * - Session stats reset on new session (sessionStorage behavior)
 *
 * Validates: Requirements 4.1, 4.5, 4.6, 6.3, 8.1, 8.3
 */
export function initApp(): AppInstance {
  // Internal mutable state
  let chatWindowState: ChatWindowState = {
    messages: [],
    isLoading: false,
    inputText: '',
  };

  let panelState: PrivacyLensPanelProps = {
    items: [],
    sessionStats: getSessionStats().itemsProtected,
    isOpen: false,
  };

  // Wire real API service + session stats as controller deps
  const deps: ChatControllerDeps = {
    scanForPII,
    redactText,
    sendMessage,
    incrementSessionStats,
    getSessionStats,
  };

  // Callbacks update internal state when the controller signals changes
  const callbacks: ChatControllerCallbacks = {
    onMessagesChanged(messages: ChatMessage[]) {
      chatWindowState = { ...chatWindowState, messages };
    },
    onLoadingChanged(isLoading: boolean) {
      chatWindowState = { ...chatWindowState, isLoading };
    },
    onPanelOpen(items: PIIItemState[], _messageText: string) {
      panelState = {
        ...panelState,
        items,
        isOpen: true,
        sessionStats: getSessionStats().itemsProtected,
      };
    },
    onPanelClose() {
      panelState = { ...panelState, items: [], isOpen: false };
    },
    onError(_message: string) {
      // Error state is reflected in messages (error bubbles)
    },
    onStatsChanged(itemsProtected: number) {
      panelState = { ...panelState, sessionStats: itemsProtected };
    },
    onBlockedNotification(_message: string) {
      // Blocked state is reflected in messages
    },
  };

  const controller = new ChatController(deps, callbacks);

  /**
   * Renders the full app layout HTML from the given state.
   * Combines ChatWindow + PrivacyLensPanel inside the responsive layout.
   */
  function render(state: AppState): string {
    const chatHtml = renderChatWindow(state.chatWindow);
    const panelHtml = renderPrivacyLensPanel(state.panel);
    return renderAppLayout(chatHtml, panelHtml);
  }

  /**
   * Returns a snapshot of the current internal state.
   */
  function getState(): AppState {
    return {
      chatWindow: { ...chatWindowState },
      panel: { ...panelState },
    };
  }

  return { controller, render, getState };
}
