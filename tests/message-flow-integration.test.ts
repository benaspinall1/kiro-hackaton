/**
 * Integration tests for the full message flow pipeline.
 *
 * Exercises: compose → scan → highlight → toggle → redact → send → display reply
 *
 * Validates: Requirements 2.2, 7.1, 7.2, 7.3, 7.4, 7.5, 9.4, 9.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatController, ChatControllerDeps, ChatControllerCallbacks } from '../src/frontend/chat-controller';
import type { PIIEntity, ChatResponse, RedactionResult } from '../src/types';

function makeEntity(type: PIIEntity['type'], matched: string, start: number): PIIEntity {
  return { type, matchedText: matched, startIndex: start, endIndex: start + matched.length };
}

function makeDeps(overrides: Partial<ChatControllerDeps> = {}): ChatControllerDeps {
  return {
    scanForPII: vi.fn().mockResolvedValue([]),
    redactText: vi.fn().mockResolvedValue({ redactedText: '', redactions: [] }),
    sendMessage: vi.fn().mockResolvedValue({
      reply: 'Assistant reply',
      redactionReport: { messageHash: '', detectedCounts: {}, actions: [], timestamp: '' },
      notification: null,
      blocked: false,
    } satisfies ChatResponse),
    incrementSessionStats: vi.fn().mockReturnValue({ itemsProtected: 1 }),
    getSessionStats: vi.fn().mockReturnValue({ itemsProtected: 0 }),
    ...overrides,
  };
}

function makeCallbacks(overrides: Partial<ChatControllerCallbacks> = {}): ChatControllerCallbacks {
  return {
    onMessagesChanged: vi.fn(),
    onLoadingChanged: vi.fn(),
    onPanelOpen: vi.fn(),
    onPanelClose: vi.fn(),
    onError: vi.fn(),
    onStatsChanged: vi.fn(),
    onBlockedNotification: vi.fn(),
    ...overrides,
  };
}

describe('Message Flow Integration', () => {
  let deps: ChatControllerDeps;
  let callbacks: ChatControllerCallbacks;
  let controller: ChatController;

  beforeEach(() => {
    deps = makeDeps();
    callbacks = makeCallbacks();
    controller = new ChatController(deps, callbacks);
  });

  describe('Full flow: compose → scan → highlight → toggle → redact → send → display reply (Req 2.2, 7.1, 7.2, 7.3)', () => {
    it('completes the entire pipeline with selective redaction', async () => {
      const entities: PIIEntity[] = [
        makeEntity('EMAIL', 'alice@example.com', 8),
        makeEntity('PHONE', '555-123-4567', 30),
      ];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);
      deps.redactText = vi.fn().mockResolvedValue({
        redactedText: 'Contact [EMAIL_REDACTED] or call 555-123-4567',
        redactions: [],
      } satisfies RedactionResult);
      deps.sendMessage = vi.fn().mockResolvedValue({
        reply: 'Got it, I will help you.',
        redactionReport: { messageHash: 'abc', detectedCounts: {}, actions: [], timestamp: '' },
        notification: null,
        blocked: false,
      } satisfies ChatResponse);
      deps.incrementSessionStats = vi.fn().mockReturnValue({ itemsProtected: 1 });

      // Step 1: Compose and submit
      await controller.submitMessage('Contact alice@example.com or call 555-123-4567');

      // Step 2: Scan returned entities — panel should open
      expect(deps.scanForPII).toHaveBeenCalledWith('Contact alice@example.com or call 555-123-4567');
      expect(callbacks.onPanelOpen).toHaveBeenCalledTimes(1);

      // Step 3: Verify PII items are highlighted (entities attached to user message)
      const messagesAfterScan = controller.getMessages();
      expect(messagesAfterScan).toHaveLength(1);
      expect(messagesAfterScan[0].piiEntities).toEqual(entities);

      // Step 4: Toggle off the phone entity (index 1)
      controller.toggleRedaction(1);
      expect(controller.getPendingPIIItems()[0].redactionEnabled).toBe(true);
      expect(controller.getPendingPIIItems()[1].redactionEnabled).toBe(false);

      // Step 5: Confirm send — redact only email, then send
      await controller.confirmSend();

      // Step 6: Redaction called with only the email entity
      expect(deps.redactText).toHaveBeenCalledWith(
        'Contact alice@example.com or call 555-123-4567',
        [entities[0]],
      );

      // Step 7: Send called with redacted text
      expect(deps.sendMessage).toHaveBeenCalledWith({
        prompt: 'Contact [EMAIL_REDACTED] or call 555-123-4567',
      });

      // Step 8: Panel closed
      expect(callbacks.onPanelClose).toHaveBeenCalled();

      // Step 9: Reply displayed
      const finalMessages = controller.getMessages();
      expect(finalMessages).toHaveLength(2);
      expect(finalMessages[0].role).toBe('user');
      expect(finalMessages[1].role).toBe('assistant');
      expect(finalMessages[1].text).toBe('Got it, I will help you.');
      expect(finalMessages[1].isError).toBeUndefined();

      // Step 10: Session stats incremented (1 entity redacted)
      expect(deps.incrementSessionStats).toHaveBeenCalledWith(1);
      expect(callbacks.onStatsChanged).toHaveBeenCalledWith(1);
    });

    it('redacts all entities when none are toggled off', async () => {
      const entities: PIIEntity[] = [
        makeEntity('SSN', '123-45-6789', 4),
        makeEntity('CREDIT_CARD', '4111111111111111', 20),
      ];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);
      deps.redactText = vi.fn().mockResolvedValue({
        redactedText: 'SSN [SSN_REDACTED] CC [CREDIT_CARD_REDACTED]',
        redactions: [],
      } satisfies RedactionResult);
      deps.incrementSessionStats = vi.fn().mockReturnValue({ itemsProtected: 2 });

      await controller.submitMessage('SSN 123-45-6789 CC 4111111111111111');
      await controller.confirmSend();

      // Both entities sent to redaction
      expect(deps.redactText).toHaveBeenCalledWith(
        'SSN 123-45-6789 CC 4111111111111111',
        entities,
      );
      expect(deps.incrementSessionStats).toHaveBeenCalledWith(2);
    });
  });

  describe('No-PII message sends directly without panel (Req 7.5)', () => {
    it('skips panel and sends original message when no PII detected', async () => {
      deps.scanForPII = vi.fn().mockResolvedValue([]);
      deps.sendMessage = vi.fn().mockResolvedValue({
        reply: 'Hello there!',
        redactionReport: { messageHash: '', detectedCounts: {}, actions: [], timestamp: '' },
        notification: null,
        blocked: false,
      } satisfies ChatResponse);

      await controller.submitMessage('Hello world');

      // Panel never opened
      expect(callbacks.onPanelOpen).not.toHaveBeenCalled();

      // No redaction called
      expect(deps.redactText).not.toHaveBeenCalled();

      // Message sent directly
      expect(deps.sendMessage).toHaveBeenCalledWith({ prompt: 'Hello world' });

      // Both user and assistant messages displayed
      const messages = controller.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].text).toBe('Hello world');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].text).toBe('Hello there!');
    });
  });

  describe('Error response displayed as error bubble (Req 7.4)', () => {
    it('displays error bubble when chat API throws', async () => {
      deps.sendMessage = vi.fn().mockRejectedValue(new Error('Network timeout'));

      await controller.submitMessage('Hello');

      const messages = controller.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].isError).toBe(true);
      expect(messages[1].text).toContain('Failed to get a response');
    });

    it('displays error bubble when response contains error field', async () => {
      deps.sendMessage = vi.fn().mockResolvedValue({
        reply: null,
        redactionReport: { messageHash: '', detectedCounts: {}, actions: [], timestamp: '' },
        notification: null,
        blocked: false,
        error: 'Internal server error',
      } satisfies ChatResponse);

      await controller.submitMessage('Hello');

      const messages = controller.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].isError).toBe(true);
      expect(messages[1].text).toBe('Internal server error');
    });

    it('displays error bubble after PII redaction flow when chat API fails', async () => {
      const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);
      deps.redactText = vi.fn().mockResolvedValue({
        redactedText: '[EMAIL_REDACTED]',
        redactions: [],
      } satisfies RedactionResult);
      deps.sendMessage = vi.fn().mockRejectedValue(new Error('Server down'));

      await controller.submitMessage('a@b.com');
      await controller.confirmSend();

      const messages = controller.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[1].isError).toBe(true);
      expect(messages[1].text).toContain('Failed to get a response');
    });
  });

  describe('Scan API error shows notification with retry (Req 9.4)', () => {
    it('calls onError and removes user message on scan failure', async () => {
      deps.scanForPII = vi.fn().mockRejectedValue(new Error('Scan service unavailable'));

      await controller.submitMessage('My email is test@test.com');

      // Error callback fired
      expect(callbacks.onError).toHaveBeenCalledWith(
        'Failed to scan message for PII. Please try again.',
      );

      // User message removed so they can retry
      expect(controller.getMessages()).toHaveLength(0);

      // Panel never opened
      expect(callbacks.onPanelOpen).not.toHaveBeenCalled();

      // No send attempted
      expect(deps.sendMessage).not.toHaveBeenCalled();
    });

    it('allows retry after scan failure', async () => {
      // First attempt fails
      deps.scanForPII = vi.fn().mockRejectedValueOnce(new Error('Timeout'));

      await controller.submitMessage('test@test.com');
      expect(callbacks.onError).toHaveBeenCalledTimes(1);
      expect(controller.getMessages()).toHaveLength(0);

      // Second attempt succeeds
      deps.scanForPII = vi.fn().mockResolvedValue([]);
      await controller.submitMessage('test@test.com');

      expect(controller.getMessages()).toHaveLength(2);
      expect(controller.getMessages()[1].role).toBe('assistant');
    });
  });

  describe('Redaction API error prevents send (Req 9.5)', () => {
    it('calls onError, keeps panel open, and does not send message', async () => {
      const entities: PIIEntity[] = [makeEntity('SSN', '123-45-6789', 0)];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);
      deps.redactText = vi.fn().mockRejectedValue(new Error('Redaction service error'));

      await controller.submitMessage('123-45-6789');
      await controller.confirmSend();

      // Error callback fired
      expect(callbacks.onError).toHaveBeenCalledWith(
        'Failed to redact PII. Please try again.',
      );

      // Panel NOT closed — user can retry
      expect(callbacks.onPanelClose).not.toHaveBeenCalled();

      // Message NOT sent
      expect(deps.sendMessage).not.toHaveBeenCalled();

      // User message still present (not removed)
      expect(controller.getMessages()).toHaveLength(1);
      expect(controller.getMessages()[0].role).toBe('user');
    });

    it('allows retry after redaction failure', async () => {
      const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);

      // First redaction attempt fails
      deps.redactText = vi.fn().mockRejectedValueOnce(new Error('Service down'));

      await controller.submitMessage('a@b.com');
      await controller.confirmSend();

      expect(callbacks.onError).toHaveBeenCalledTimes(1);
      expect(deps.sendMessage).not.toHaveBeenCalled();

      // Second attempt succeeds
      deps.redactText = vi.fn().mockResolvedValue({
        redactedText: '[EMAIL_REDACTED]',
        redactions: [],
      } satisfies RedactionResult);

      await controller.confirmSend();

      expect(deps.sendMessage).toHaveBeenCalled();
      expect(callbacks.onPanelClose).toHaveBeenCalled();
    });
  });
});
