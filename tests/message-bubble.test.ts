import { describe, it, expect } from 'vitest';
import { renderMessageBubble } from '../src/frontend/components/message-bubble';
import type { ChatMessage } from '../src/frontend/types';
import type { PIIEntity } from '../src/types';
import { PII_COLOR_MAP } from '../src/frontend/types';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: '1',
    role: 'user',
    text: 'Hello world',
    timestamp: new Date(),
    ...overrides,
  };
}

describe('renderMessageBubble', () => {
  it('renders user messages right-aligned', () => {
    const html = renderMessageBubble(makeMessage({ role: 'user' }));
    expect(html).toContain('text-align: right');
    expect(html).toContain('message-user');
  });

  it('renders assistant messages left-aligned', () => {
    const html = renderMessageBubble(makeMessage({ role: 'assistant' }));
    expect(html).toContain('text-align: left');
    expect(html).toContain('message-assistant');
  });

  it('applies user background color for user messages', () => {
    const html = renderMessageBubble(makeMessage({ role: 'user' }));
    expect(html).toContain('background-color: #DCF8C6');
  });

  it('applies assistant background color for assistant messages', () => {
    const html = renderMessageBubble(makeMessage({ role: 'assistant' }));
    expect(html).toContain('background-color: #FFFFFF');
  });

  it('renders error messages with distinct error styling', () => {
    const html = renderMessageBubble(makeMessage({ isError: true }));
    expect(html).toContain('message-error');
    expect(html).toContain('background-color: #FEE2E2');
    expect(html).toContain('border: 1px solid #EF4444');
    expect(html).toContain('color: #991B1B');
  });

  it('renders plain text for assistant messages', () => {
    const html = renderMessageBubble(makeMessage({ role: 'assistant', text: 'Hi there' }));
    expect(html).toContain('Hi there');
    expect(html).not.toContain('pii-highlight');
  });

  it('renders plain text for user messages without PII entities', () => {
    const html = renderMessageBubble(makeMessage({ text: 'No PII here' }));
    expect(html).toContain('No PII here');
    expect(html).not.toContain('pii-highlight');
  });

  it('renders inline PII highlights for user messages with entities', () => {
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'test@example.com', startIndex: 10, endIndex: 26 },
    ];
    const msg = makeMessage({
      text: 'Email me: test@example.com please',
      piiEntities: entities,
    });
    const html = renderMessageBubble(msg);
    expect(html).toContain('pii-highlight');
    expect(html).toContain(`background-color: ${PII_COLOR_MAP.EMAIL}`);
    expect(html).toContain('test@example.com');
    expect(html).toContain('data-pii-type="EMAIL"');
  });

  it('renders correct colors for different PII types', () => {
    const entities: PIIEntity[] = [
      { type: 'SSN', matchedText: '123-45-6789', startIndex: 5, endIndex: 16 },
    ];
    const msg = makeMessage({
      text: 'SSN: 123-45-6789 end',
      piiEntities: entities,
    });
    const html = renderMessageBubble(msg);
    expect(html).toContain(`background-color: ${PII_COLOR_MAP.SSN}`);
  });

  it('applies muted style to highlights for toggled-off entities', () => {
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'a@b.com', startIndex: 0, endIndex: 7 },
      { type: 'PHONE', matchedText: '555-1234', startIndex: 8, endIndex: 16 },
    ];
    const msg = makeMessage({
      text: 'a@b.com 555-1234',
      piiEntities: entities,
    });
    // Disable entity at index 0 (EMAIL)
    const html = renderMessageBubble(msg, new Set([0]));
    // The EMAIL highlight should be muted
    expect(html).toContain('opacity: 0.4');
    // The PHONE highlight should be full opacity
    expect(html).toContain('opacity: 1');
  });

  it('renders all highlights at full opacity when no entities are disabled', () => {
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'a@b.com', startIndex: 0, endIndex: 7 },
    ];
    const msg = makeMessage({
      text: 'a@b.com',
      piiEntities: entities,
    });
    const html = renderMessageBubble(msg);
    expect(html).toContain('opacity: 1');
    expect(html).not.toContain('opacity: 0.4');
  });

  it('escapes HTML in message text to prevent XSS', () => {
    const html = renderMessageBubble(makeMessage({ text: '<script>alert("xss")</script>' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not render PII highlights for assistant messages even with entities', () => {
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'a@b.com', startIndex: 0, endIndex: 7 },
    ];
    const msg = makeMessage({
      role: 'assistant',
      text: 'a@b.com',
      piiEntities: entities,
    });
    const html = renderMessageBubble(msg);
    expect(html).not.toContain('pii-highlight');
  });
});
