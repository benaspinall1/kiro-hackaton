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
      reply: 'Hello!',
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

describe('ChatController', () => {
  let deps: ChatControllerDeps;
  let callbacks: ChatControllerCallbacks;
  let controller: ChatController;

  beforeEach(() => {
    deps = makeDeps();
    callbacks = makeCallbacks();
    controller = new ChatController(deps, callbacks);
  });

  describe('submitMessage — no PII detected', () => {
    it('sends original message directly and displays reply (Req 7.5)', async () => {
      await controller.submitMessage('Hello world');

      expect(deps.scanForPII).toHaveBeenCalledWith('Hello world');
      expect(deps.sendMessage).toHaveBeenCalledWith({ prompt: 'Hello world' });
      expect(callbacks.onPanelOpen).not.toHaveBeenCalled();

      const messages = controller.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].text).toBe('Hello world');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].text).toBe('Hello!');
    });

    it('ignores empty/whitespace input', async () => {
      await controller.submitMessage('   ');
      expect(deps.scanForPII).not.toHaveBeenCalled();
    });
  });

  describe('submitMessage — PII detected', () => {
    it('opens panel with PIIItemState array, all redactionEnabled true (Req 2.2, 4.1)', async () => {
      const entities: PIIEntity[] = [
        makeEntity('EMAIL', 'test@example.com', 10),
      ];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);

      await controller.submitMessage('Contact test@example.com please');

      expect(callbacks.onPanelOpen).toHaveBeenCalledTimes(1);
      const [items] = (callbacks.onPanelOpen as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(items).toHaveLength(1);
      expect(items[0].redactionEnabled).toBe(true);
      expect(items[0].entity).toBe(entities[0]);

      // Should NOT have sent the message yet
      expect(deps.sendMessage).not.toHaveBeenCalled();

      // User message should have piiEntities set
      const messages = controller.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].piiEntities).toEqual(entities);
    });
  });

  describe('confirmSend', () => {
    it('filters enabled entities, redacts, and sends (Req 7.1, 7.2)', async () => {
      const entities: PIIEntity[] = [
        makeEntity('EMAIL', 'a@b.com', 0),
        makeEntity('PHONE', '555-1234', 10),
      ];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);
      deps.redactText = vi.fn().mockResolvedValue({
        redactedText: '[EMAIL_REDACTED] [PHONE_REDACTED]',
        redactions: [],
      } satisfies RedactionResult);

      await controller.submitMessage('a@b.com hi 555-1234');

      // Toggle off the phone entity
      controller.toggleRedaction(1);

      await controller.confirmSend();

      // redactText called with only the email entity
      expect(deps.redactText).toHaveBeenCalledWith(
        'a@b.com hi 555-1234',
        [entities[0]],
      );
      expect(deps.sendMessage).toHaveBeenCalled();
      expect(callbacks.onPanelClose).toHaveBeenCalled();
    });

    it('sends original text when all entities toggled off', async () => {
      const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);

      await controller.submitMessage('a@b.com');
      controller.toggleRedaction(0);
      await controller.confirmSend();

      expect(deps.redactText).not.toHaveBeenCalled();
      expect(deps.sendMessage).toHaveBeenCalledWith({ prompt: 'a@b.com' });
    });

    it('increments session stats by redacted entity count (Req 8.2)', async () => {
      const entities: PIIEntity[] = [
        makeEntity('EMAIL', 'a@b.com', 0),
        makeEntity('PHONE', '555-1234', 10),
      ];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);
      deps.redactText = vi.fn().mockResolvedValue({ redactedText: 'redacted', redactions: [] });
      deps.incrementSessionStats = vi.fn().mockReturnValue({ itemsProtected: 2 });

      await controller.submitMessage('a@b.com hi 555-1234');
      await controller.confirmSend();

      expect(deps.incrementSessionStats).toHaveBeenCalledWith(2);
      expect(callbacks.onStatsChanged).toHaveBeenCalledWith(2);
    });
  });

  describe('toggleRedaction', () => {
    it('toggles redaction state for a PII item', async () => {
      const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);

      await controller.submitMessage('a@b.com');

      expect(controller.getPendingPIIItems()[0].redactionEnabled).toBe(true);
      controller.toggleRedaction(0);
      expect(controller.getPendingPIIItems()[0].redactionEnabled).toBe(false);
      controller.toggleRedaction(0);
      expect(controller.getPendingPIIItems()[0].redactionEnabled).toBe(true);
    });

    it('ignores out-of-range index', () => {
      controller.toggleRedaction(-1);
      controller.toggleRedaction(999);
      // No error thrown
    });
  });

  describe('autoRedactAll', () => {
    it('enables all redaction toggles (Req 6.3)', async () => {
      const entities: PIIEntity[] = [
        makeEntity('EMAIL', 'a@b.com', 0),
        makeEntity('PHONE', '555-1234', 10),
      ];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);

      await controller.submitMessage('a@b.com hi 555-1234');
      controller.toggleRedaction(0);
      controller.toggleRedaction(1);

      expect(controller.getPendingPIIItems().every((i) => !i.redactionEnabled)).toBe(true);

      controller.autoRedactAll();
      expect(controller.getPendingPIIItems().every((i) => i.redactionEnabled)).toBe(true);
    });
  });

  describe('closePanel', () => {
    it('removes pending user message and closes panel', async () => {
      const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);

      await controller.submitMessage('a@b.com');
      expect(controller.getMessages()).toHaveLength(1);

      controller.closePanel();
      expect(controller.getMessages()).toHaveLength(0);
      expect(callbacks.onPanelClose).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error notification on scan API failure (Req 9.4)', async () => {
      deps.scanForPII = vi.fn().mockRejectedValue(new Error('Network error'));

      await controller.submitMessage('test message');

      expect(callbacks.onError).toHaveBeenCalledWith(
        'Failed to scan message for PII. Please try again.',
      );
      // User message should be removed for retry
      expect(controller.getMessages()).toHaveLength(0);
    });

    it('shows error notification on redaction API failure, keeps panel open (Req 9.5)', async () => {
      const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
      deps.scanForPII = vi.fn().mockResolvedValue(entities);
      deps.redactText = vi.fn().mockRejectedValue(new Error('Redaction failed'));

      await controller.submitMessage('a@b.com');
      await controller.confirmSend();

      expect(callbacks.onError).toHaveBeenCalledWith(
        'Failed to redact PII. Please try again.',
      );
      // Panel should NOT have been closed
      expect(callbacks.onPanelClose).not.toHaveBeenCalled();
      // Message should NOT have been sent
      expect(deps.sendMessage).not.toHaveBeenCalled();
    });

    it('displays error message bubble on chat API failure (Req 7.4)', async () => {
      deps.sendMessage = vi.fn().mockRejectedValue(new Error('Chat failed'));

      await controller.submitMessage('Hello');

      const messages = controller.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].isError).toBe(true);
      expect(messages[1].text).toContain('Failed to get a response');
    });

    it('displays error bubble when response has error field (Req 7.4)', async () => {
      deps.sendMessage = vi.fn().mockResolvedValue({
        reply: null,
        redactionReport: { messageHash: '', detectedCounts: {}, actions: [], timestamp: '' },
        notification: null,
        blocked: false,
        error: 'Something went wrong',
      } satisfies ChatResponse);

      await controller.submitMessage('Hello');

      const messages = controller.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[1].isError).toBe(true);
      expect(messages[1].text).toBe('Something went wrong');
    });

    it('displays block notification on blocked response (Req 7.4)', async () => {
      deps.sendMessage = vi.fn().mockResolvedValue({
        reply: null,
        redactionReport: { messageHash: '', detectedCounts: {}, actions: [], timestamp: '' },
        notification: null,
        blocked: true,
      } satisfies ChatResponse);

      await controller.submitMessage('Hello');

      expect(callbacks.onBlockedNotification).toHaveBeenCalledWith(
        'Your message was blocked by privacy rules.',
      );
      // No assistant message added for blocked responses
      expect(controller.getMessages()).toHaveLength(1);
    });
  });

  describe('loading state', () => {
    it('sets loading true during scan and false after', async () => {
      await controller.submitMessage('Hello');

      const calls = (callbacks.onLoadingChanged as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0]).toBe(true);
      // Last call should be false
      expect(calls[calls.length - 1][0]).toBe(false);
      expect(controller.getIsLoading()).toBe(false);
    });
  });
});
