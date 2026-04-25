import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initApp } from '../src/frontend/index';
import type { AppState } from '../src/frontend/index';
import type { PIIEntity, ChatResponse, RedactionResult } from '../src/types';

// Mock the API service module
vi.mock('../src/frontend/api-service', () => ({
  scanForPII: vi.fn().mockResolvedValue([]),
  redactText: vi.fn().mockResolvedValue({ redactedText: '', redactions: [] }),
  sendMessage: vi.fn().mockResolvedValue({
    reply: 'Hello!',
    redactionReport: { messageHash: '', detectedCounts: {}, actions: [], timestamp: '' },
    notification: null,
    blocked: false,
  }),
}));

// Mock session-stats module
vi.mock('../src/frontend/session-stats', () => ({
  getSessionStats: vi.fn().mockReturnValue({ itemsProtected: 0 }),
  incrementSessionStats: vi.fn().mockReturnValue({ itemsProtected: 1 }),
}));

import * as apiService from '../src/frontend/api-service';
import * as sessionStats from '../src/frontend/session-stats';

function makeEntity(type: PIIEntity['type'], matched: string, start: number): PIIEntity {
  return { type, matchedText: matched, startIndex: start, endIndex: start + matched.length };
}

describe('initApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sessionStats.getSessionStats as ReturnType<typeof vi.fn>).mockReturnValue({ itemsProtected: 0 });
    (sessionStats.incrementSessionStats as ReturnType<typeof vi.fn>).mockReturnValue({ itemsProtected: 1 });
    (apiService.scanForPII as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (apiService.redactText as ReturnType<typeof vi.fn>).mockResolvedValue({ redactedText: '', redactions: [] });
    (apiService.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
      reply: 'Hello!',
      redactionReport: { messageHash: '', detectedCounts: {}, actions: [], timestamp: '' },
      notification: null,
      blocked: false,
    } satisfies ChatResponse);
  });

  it('returns controller, render, and getState', () => {
    const app = initApp();
    expect(app.controller).toBeDefined();
    expect(typeof app.render).toBe('function');
    expect(typeof app.getState).toBe('function');
  });

  it('initial state has empty messages, not loading, panel closed', () => {
    const app = initApp();
    const state = app.getState();

    expect(state.chatWindow.messages).toEqual([]);
    expect(state.chatWindow.isLoading).toBe(false);
    expect(state.chatWindow.inputText).toBe('');
    expect(state.panel.isOpen).toBe(false);
    expect(state.panel.items).toEqual([]);
  });

  it('reads session stats on init (Req 8.1)', () => {
    (sessionStats.getSessionStats as ReturnType<typeof vi.fn>).mockReturnValue({ itemsProtected: 5 });
    const app = initApp();
    const state = app.getState();
    expect(state.panel.sessionStats).toBe(5);
  });

  it('render produces HTML string with app-layout class', () => {
    const app = initApp();
    const state = app.getState();
    const html = app.render(state);

    expect(typeof html).toBe('string');
    expect(html).toContain('app-layout');
    expect(html).toContain('chat-window');
    expect(html).toContain('privacy-lens-panel');
  });

  it('panel opens when PII is detected (Req 4.1)', async () => {
    const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
    (apiService.scanForPII as ReturnType<typeof vi.fn>).mockResolvedValue(entities);

    const app = initApp();
    await app.controller.submitMessage('a@b.com');

    const state = app.getState();
    expect(state.panel.isOpen).toBe(true);
    expect(state.panel.items).toHaveLength(1);
    expect(state.panel.items[0].redactionEnabled).toBe(true);
  });

  it('panel remains closed when no PII detected (Req 4.6)', async () => {
    const app = initApp();
    await app.controller.submitMessage('Hello world');

    const state = app.getState();
    expect(state.panel.isOpen).toBe(false);
  });

  it('close button handler closes panel (Req 4.5)', async () => {
    const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
    (apiService.scanForPII as ReturnType<typeof vi.fn>).mockResolvedValue(entities);

    const app = initApp();
    await app.controller.submitMessage('a@b.com');
    expect(app.getState().panel.isOpen).toBe(true);

    app.controller.closePanel();
    expect(app.getState().panel.isOpen).toBe(false);
    expect(app.getState().panel.items).toEqual([]);
  });

  it('autoRedactAll enables all toggles via controller (Req 6.3)', async () => {
    const entities: PIIEntity[] = [
      makeEntity('EMAIL', 'a@b.com', 0),
      makeEntity('PHONE', '555-1234', 10),
    ];
    (apiService.scanForPII as ReturnType<typeof vi.fn>).mockResolvedValue(entities);

    const app = initApp();
    await app.controller.submitMessage('a@b.com hi 555-1234');

    // Toggle both off
    app.controller.toggleRedaction(0);
    app.controller.toggleRedaction(1);

    // Auto-redact all
    app.controller.autoRedactAll();
    const items = app.controller.getPendingPIIItems();
    expect(items.every((i) => i.redactionEnabled)).toBe(true);
  });

  it('session stats update after confirm send (Req 8.1)', async () => {
    const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
    (apiService.scanForPII as ReturnType<typeof vi.fn>).mockResolvedValue(entities);
    (apiService.redactText as ReturnType<typeof vi.fn>).mockResolvedValue({
      redactedText: '[EMAIL_REDACTED]',
      redactions: [],
    } satisfies RedactionResult);
    (sessionStats.incrementSessionStats as ReturnType<typeof vi.fn>).mockReturnValue({ itemsProtected: 1 });

    const app = initApp();
    await app.controller.submitMessage('a@b.com');
    await app.controller.confirmSend();

    expect(sessionStats.incrementSessionStats).toHaveBeenCalledWith(1);
    const state = app.getState();
    expect(state.panel.sessionStats).toBe(1);
  });

  it('messages update in state after submit (no PII path)', async () => {
    const app = initApp();
    await app.controller.submitMessage('Hello');

    const state = app.getState();
    expect(state.chatWindow.messages).toHaveLength(2);
    expect(state.chatWindow.messages[0].role).toBe('user');
    expect(state.chatWindow.messages[1].role).toBe('assistant');
  });

  it('session stats reset on new session via sessionStorage behavior (Req 8.3)', () => {
    // First session has stats
    (sessionStats.getSessionStats as ReturnType<typeof vi.fn>).mockReturnValue({ itemsProtected: 10 });
    const app1 = initApp();
    expect(app1.getState().panel.sessionStats).toBe(10);

    // New session resets (sessionStorage cleared)
    (sessionStats.getSessionStats as ReturnType<typeof vi.fn>).mockReturnValue({ itemsProtected: 0 });
    const app2 = initApp();
    expect(app2.getState().panel.sessionStats).toBe(0);
  });

  it('render accepts custom state and produces correct HTML', () => {
    const app = initApp();
    const customState: AppState = {
      chatWindow: {
        messages: [{
          id: 'test-1',
          role: 'user',
          text: 'Hello',
          timestamp: new Date(),
        }],
        isLoading: false,
        inputText: 'typing...',
      },
      panel: {
        items: [],
        sessionStats: 3,
        isOpen: false,
      },
    };

    const html = app.render(customState);
    expect(html).toContain('Hello');
    expect(html).toContain('typing...');
    expect(html).toContain('3 items protected today');
  });

  it('panel stats refresh from getSessionStats on panel open', async () => {
    (sessionStats.getSessionStats as ReturnType<typeof vi.fn>).mockReturnValue({ itemsProtected: 7 });
    const entities: PIIEntity[] = [makeEntity('EMAIL', 'a@b.com', 0)];
    (apiService.scanForPII as ReturnType<typeof vi.fn>).mockResolvedValue(entities);

    const app = initApp();
    await app.controller.submitMessage('a@b.com');

    const state = app.getState();
    expect(state.panel.sessionStats).toBe(7);
  });
});
