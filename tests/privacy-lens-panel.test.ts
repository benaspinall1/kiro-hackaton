import { describe, it, expect } from 'vitest';
import { renderPrivacyLensPanel } from '../src/frontend/components/privacy-lens-panel';
import type { PrivacyLensPanelProps } from '../src/frontend/components/privacy-lens-panel';
import type { PIIItemState } from '../src/frontend/types';
import type { PIIEntity } from '../src/types';

function makeItem(overrides: Partial<PIIEntity> = {}, redactionEnabled = true): PIIItemState {
  return {
    entity: {
      type: 'EMAIL',
      matchedText: 'test@example.com',
      startIndex: 0,
      endIndex: 16,
      ...overrides,
    },
    redactionEnabled,
  };
}

function makeProps(overrides: Partial<PrivacyLensPanelProps> = {}): PrivacyLensPanelProps {
  return {
    items: [makeItem()],
    sessionStats: 0,
    isOpen: true,
    ...overrides,
  };
}

describe('renderPrivacyLensPanel', () => {
  it('displays header with correct PII count format', () => {
    const html = renderPrivacyLensPanel(makeProps({ items: [makeItem(), makeItem({ type: 'SSN', matchedText: '123-45-6789' })] }));
    expect(html).toContain('2 PII items detected');
  });

  it('displays header with count of 0 when no items', () => {
    const html = renderPrivacyLensPanel(makeProps({ items: [] }));
    expect(html).toContain('0 PII items detected');
  });

  it('displays subtitle text', () => {
    const html = renderPrivacyLensPanel(makeProps());
    expect(html).toContain('Review detected items before sending');
  });

  it('renders one PIIItemCard per detected entity', () => {
    const items = [
      makeItem({ type: 'EMAIL', matchedText: 'a@b.com' }),
      makeItem({ type: 'PHONE', matchedText: '555-1234' }),
      makeItem({ type: 'SSN', matchedText: '123-45-6789' }),
    ];
    const html = renderPrivacyLensPanel(makeProps({ items }));
    // Each card has class pii-item-card
    const cardCount = (html.match(/class="pii-item-card"/g) || []).length;
    expect(cardCount).toBe(3);
  });

  it('includes auto-redact button with correct data attribute', () => {
    const html = renderPrivacyLensPanel(makeProps());
    expect(html).toContain('class="auto-redact-btn"');
    expect(html).toContain('data-action="auto-redact-all"');
    expect(html).toContain('Auto-Redact All');
  });

  it('includes confirm send button with correct data attribute', () => {
    const html = renderPrivacyLensPanel(makeProps());
    expect(html).toContain('class="confirm-send-btn"');
    expect(html).toContain('data-action="confirm-send"');
    expect(html).toContain('Confirm &amp; Send');
  });

  it('includes close button with correct data attribute', () => {
    const html = renderPrivacyLensPanel(makeProps());
    expect(html).toContain('class="privacy-lens-close"');
    expect(html).toContain('data-action="close"');
  });

  it('displays stats footer with correct format', () => {
    const html = renderPrivacyLensPanel(makeProps({ sessionStats: 42 }));
    expect(html).toContain('42 items protected today');
  });

  it('displays stats footer with zero count', () => {
    const html = renderPrivacyLensPanel(makeProps({ sessionStats: 0 }));
    expect(html).toContain('0 items protected today');
  });

  it('applies slide-out transform when panel is open', () => {
    const html = renderPrivacyLensPanel(makeProps({ isOpen: true }));
    expect(html).toContain('translateX(0)');
    expect(html).toContain('data-open="true"');
  });

  it('applies hidden transform when panel is closed', () => {
    const html = renderPrivacyLensPanel(makeProps({ isOpen: false }));
    expect(html).toContain('translateX(100%)');
    expect(html).toContain('data-open="false"');
  });

  it('renders cards with correct data-pii-index attributes', () => {
    const items = [makeItem({ type: 'EMAIL' }), makeItem({ type: 'PHONE', matchedText: '555-1234' })];
    const html = renderPrivacyLensPanel(makeProps({ items }));
    expect(html).toContain('data-pii-index="0"');
    expect(html).toContain('data-pii-index="1"');
  });
});
