/**
 * Chat message flow controller — orchestrates the submit → scan → redact → send pipeline.
 *
 * Manages internal state and calls injected dependencies for testability.
 * Does NOT manipulate the DOM; instead exposes state via callbacks.
 *
 * Validates: Requirements 2.2, 2.3, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 9.4, 9.5
 */

import type { PIIEntity, RedactionResult, ChatRequest, ChatResponse } from '../types';
import type { ChatMessage, PIIItemState } from './types';
import { filterEnabledEntities } from './redaction-filter';

/**
 * Dependencies injected into the ChatController for testability.
 */
export interface ChatControllerDeps {
  scanForPII: (text: string) => Promise<PIIEntity[]>;
  redactText: (text: string, entities: PIIEntity[]) => Promise<RedactionResult>;
  sendMessage: (request: ChatRequest) => Promise<ChatResponse>;
  incrementSessionStats: (count: number) => { itemsProtected: number };
  getSessionStats: () => { itemsProtected: number };
}

/**
 * Callbacks the controller invokes to notify the UI layer of state changes.
 */
export interface ChatControllerCallbacks {
  onMessagesChanged: (messages: ChatMessage[]) => void;
  onLoadingChanged: (isLoading: boolean) => void;
  onPanelOpen: (items: PIIItemState[], messageText: string) => void;
  onPanelClose: () => void;
  onError: (message: string) => void;
  onStatsChanged: (itemsProtected: number) => void;
  onBlockedNotification: (message: string) => void;
}

/**
 * Orchestrates the message submission flow:
 * submit → scan → (no PII → send) or (PII → panel → confirm → redact → send)
 */
export class ChatController {
  private messages: ChatMessage[] = [];
  private pendingText: string = '';
  private pendingPIIItems: PIIItemState[] = [];
  private pendingEntities: PIIEntity[] = [];
  private isLoading: boolean = false;

  constructor(
    private readonly deps: ChatControllerDeps,
    private readonly callbacks: ChatControllerCallbacks,
  ) {}

  /** Returns the current message list. */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /** Returns whether a request is in progress. */
  getIsLoading(): boolean {
    return this.isLoading;
  }

  /** Returns the current pending PII items (while panel is open). */
  getPendingPIIItems(): PIIItemState[] {
    return [...this.pendingPIIItems];
  }

  /**
   * Submit a message for PII scanning and processing.
   * If no PII is found, sends directly. If PII is found, opens the panel.
   */
  async submitMessage(text: string): Promise<void> {
    if (!text.trim()) return;

    this.pendingText = text;
    this.setLoading(true);

    // Add user message to the list immediately
    const userMessage = this.createMessage('user', text);
    this.addMessage(userMessage);

    let entities: PIIEntity[];
    try {
      entities = await this.deps.scanForPII(text);
    } catch {
      this.setLoading(false);
      this.callbacks.onError('Failed to scan message for PII. Please try again.');
      // Remove the user message so they can retry
      this.removeLastMessage();
      return;
    }

    if (entities.length === 0) {
      // No PII — send directly
      await this.sendAndDisplayReply(text, 0);
    } else {
      // PII detected — update user message with entities, open panel
      userMessage.piiEntities = entities;
      this.pendingEntities = entities;
      this.pendingPIIItems = entities.map((entity) => ({
        entity,
        redactionEnabled: true,
      }));
      this.notifyMessagesChanged();
      this.setLoading(false);
      this.callbacks.onPanelOpen(this.getPendingPIIItems(), text);
    }
  }

  /**
   * Toggle redaction for a specific PII item by index.
   */
  toggleRedaction(index: number): void {
    if (index < 0 || index >= this.pendingPIIItems.length) return;
    this.pendingPIIItems[index] = {
      ...this.pendingPIIItems[index],
      redactionEnabled: !this.pendingPIIItems[index].redactionEnabled,
    };
  }

  /**
   * Enable redaction for all pending PII items.
   */
  autoRedactAll(): void {
    this.pendingPIIItems = this.pendingPIIItems.map((item) => ({
      ...item,
      redactionEnabled: true,
    }));
  }

  /**
   * Confirm send from the PrivacyLens panel.
   * Filters enabled entities, redacts text, then sends.
   */
  async confirmSend(): Promise<void> {
    const enabledEntities = filterEnabledEntities(this.pendingPIIItems);
    const redactedCount = enabledEntities.length;

    this.setLoading(true);

    let textToSend: string;

    if (enabledEntities.length > 0) {
      let result: RedactionResult;
      try {
        result = await this.deps.redactText(this.pendingText, enabledEntities);
      } catch {
        this.setLoading(false);
        this.callbacks.onError('Failed to redact PII. Please try again.');
        return; // Keep panel open
      }
      textToSend = result.redactedText;
    } else {
      // No entities enabled — send original text
      textToSend = this.pendingText;
    }

    this.callbacks.onPanelClose();
    await this.sendAndDisplayReply(textToSend, redactedCount);
  }

  /**
   * Close the panel without sending.
   */
  closePanel(): void {
    // Remove the pending user message since they cancelled
    this.removeLastMessage();
    this.clearPendingState();
    this.callbacks.onPanelClose();
  }

  /**
   * Sends text to the chat API and displays the reply.
   */
  private async sendAndDisplayReply(text: string, redactedCount: number): Promise<void> {
    this.setLoading(true);

    let response: ChatResponse;
    try {
      response = await this.deps.sendMessage({ prompt: text });
    } catch {
      this.setLoading(false);
      const errorMessage = this.createMessage('assistant', 'Failed to get a response. Please try again.', true);
      this.addMessage(errorMessage);
      this.clearPendingState();
      return;
    }

    this.setLoading(false);

    if (response.blocked) {
      this.callbacks.onBlockedNotification('Your message was blocked by privacy rules.');
      this.clearPendingState();
      return;
    }

    if (response.error) {
      const errorMessage = this.createMessage('assistant', response.error, true);
      this.addMessage(errorMessage);
      this.clearPendingState();
      return;
    }

    // Display assistant reply
    const assistantMessage = this.createMessage('assistant', response.reply ?? '');
    this.addMessage(assistantMessage);

    // Increment session stats
    if (redactedCount > 0) {
      const stats = this.deps.incrementSessionStats(redactedCount);
      this.callbacks.onStatsChanged(stats.itemsProtected);
    }

    this.clearPendingState();
  }

  private createMessage(role: 'user' | 'assistant', text: string, isError = false): ChatMessage {
    return {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role,
      text,
      timestamp: new Date(),
      isError: isError || undefined,
    };
  }

  private addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.notifyMessagesChanged();
  }

  private removeLastMessage(): void {
    this.messages.pop();
    this.notifyMessagesChanged();
  }

  private notifyMessagesChanged(): void {
    this.callbacks.onMessagesChanged([...this.messages]);
  }

  private setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.callbacks.onLoadingChanged(loading);
  }

  private clearPendingState(): void {
    this.pendingText = '';
    this.pendingPIIItems = [];
    this.pendingEntities = [];
  }
}
