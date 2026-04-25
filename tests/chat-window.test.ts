import { describe, it, expect } from 'vitest';
import { renderChatWindow } from '../src/frontend/components/chat-window';
import type { ChatWindowState } from '../src/frontend/types';
import type { ChatMessage } from '../src/frontend/types';

function makeMessage(overrides: Partial<ChatMessage> & { id: string; role: ChatMessage['role']; text: string }): ChatMessage {
  return {
    timestamp: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('renderChatWindow', () => {
  it('renders message list with class "message-list"', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '' };
    const html = renderChatWindow(state);
    expect(html).toContain('class="message-list"');
  });

  it('renders message input with class "message-input"', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '' };
    const html = renderChatWindow(state);
    expect(html).toContain('class="message-input"');
  });

  it('renders send button with class "send-btn" and data-action="send"', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '' };
    const html = renderChatWindow(state);
    expect(html).toContain('class="send-btn"');
    expect(html).toContain('data-action="send"');
  });

  it('disables send button when inputText is empty', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '' };
    const html = renderChatWindow(state);
    expect(html).toMatch(/send-btn[^>]*disabled/);
  });

  it('disables send button when inputText is whitespace only', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '   ' };
    const html = renderChatWindow(state);
    expect(html).toMatch(/send-btn[^>]*disabled/);
  });

  it('enables send button when inputText has content and not loading', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: 'hello' };
    const html = renderChatWindow(state);
    // The button should NOT have disabled attribute
    const btnMatch = html.match(/<button[^>]*class="send-btn"[^>]*>/);
    expect(btnMatch).not.toBeNull();
    expect(btnMatch![0]).not.toContain('disabled');
  });

  it('disables send button when isLoading is true even with input text', () => {
    const state: ChatWindowState = { messages: [], isLoading: true, inputText: 'hello' };
    const html = renderChatWindow(state);
    expect(html).toMatch(/send-btn[^>]*disabled/);
  });

  it('shows loading indicator when isLoading is true', () => {
    const state: ChatWindowState = { messages: [], isLoading: true, inputText: '' };
    const html = renderChatWindow(state);
    expect(html).toContain('class="loading-indicator"');
  });

  it('hides loading indicator when isLoading is false', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '' };
    const html = renderChatWindow(state);
    expect(html).not.toContain('class="loading-indicator"');
  });

  it('renders user messages in the message list', () => {
    const state: ChatWindowState = {
      messages: [makeMessage({ id: '1', role: 'user', text: 'Hello world' })],
      isLoading: false,
      inputText: '',
    };
    const html = renderChatWindow(state);
    expect(html).toContain('Hello world');
    expect(html).toContain('message-bubble');
  });

  it('renders assistant messages in the message list', () => {
    const state: ChatWindowState = {
      messages: [makeMessage({ id: '1', role: 'assistant', text: 'Hi there' })],
      isLoading: false,
      inputText: '',
    };
    const html = renderChatWindow(state);
    expect(html).toContain('Hi there');
  });

  it('renders multiple messages in order', () => {
    const state: ChatWindowState = {
      messages: [
        makeMessage({ id: '1', role: 'user', text: 'First message' }),
        makeMessage({ id: '2', role: 'assistant', text: 'Second message' }),
      ],
      isLoading: false,
      inputText: '',
    };
    const html = renderChatWindow(state);
    const firstIdx = html.indexOf('First message');
    const secondIdx = html.indexOf('Second message');
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it('includes a scroll anchor for auto-scroll behavior', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '' };
    const html = renderChatWindow(state);
    expect(html).toContain('class="scroll-anchor"');
  });

  it('renders input area fixed at bottom of viewport', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '' };
    const html = renderChatWindow(state);
    expect(html).toContain('position: fixed');
    expect(html).toContain('bottom: 0');
  });

  it('escapes HTML in inputText to prevent XSS', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: '<script>alert("xss")</script>' };
    const html = renderChatWindow(state);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders the input value from state', () => {
    const state: ChatWindowState = { messages: [], isLoading: false, inputText: 'typed text' };
    const html = renderChatWindow(state);
    expect(html).toContain('value="typed text"');
  });
});
