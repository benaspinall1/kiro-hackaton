import { describe, it, expect } from 'vitest';
import { renderPIIItemCard } from '../src/frontend/components/pii-item-card';
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

describe('renderPIIItemCard', () => {
  it('displays PII type icon using getPIIIcon', () => {
    const html = renderPIIItemCard(makeItem({ type: 'EMAIL' }), 0);
    expect(html).toContain('📧');

    const phoneHtml = renderPIIItemCard(makeItem({ type: 'PHONE', matchedText: '555-1234' }), 1);
    expect(phoneHtml).toContain('📱');
  });

  it('displays PII type label', () => {
    const html = renderPIIItemCard(makeItem({ type: 'CREDIT_CARD', matchedText: '4111111111111111' }), 0);
    expect(html).toContain('CREDIT_CARD');
  });

  it('displays High Risk badge in red for SSN', () => {
    const html = renderPIIItemCard(makeItem({ type: 'SSN', matchedText: '123-45-6789' }), 0);
    expect(html).toContain('High Risk');
    expect(html).toContain('#EF4444');
  });

  it('displays High Risk badge in red for CREDIT_CARD', () => {
    const html = renderPIIItemCard(makeItem({ type: 'CREDIT_CARD', matchedText: '4111111111111111' }), 0);
    expect(html).toContain('High Risk');
    expect(html).toContain('#EF4444');
  });

  it('displays Medium Risk badge in yellow for EMAIL', () => {
    const html = renderPIIItemCard(makeItem({ type: 'EMAIL' }), 0);
    expect(html).toContain('Medium Risk');
    expect(html).toContain('#F59E0B');
  });

  it('displays Medium Risk badge in yellow for PHONE', () => {
    const html = renderPIIItemCard(makeItem({ type: 'PHONE', matchedText: '555-1234' }), 0);
    expect(html).toContain('Medium Risk');
    expect(html).toContain('#F59E0B');
  });

  it('displays Low Risk badge in green for ADDRESS', () => {
    const html = renderPIIItemCard(makeItem({ type: 'ADDRESS', matchedText: '123 Main St' }), 0);
    expect(html).toContain('Low Risk');
    expect(html).toContain('#22C55E');
  });

  it('displays Low Risk badge in green for FILE_PATH', () => {
    const html = renderPIIItemCard(makeItem({ type: 'FILE_PATH', matchedText: '/etc/passwd' }), 0);
    expect(html).toContain('Low Risk');
    expect(html).toContain('#22C55E');
  });

  it('displays matched text value', () => {
    const html = renderPIIItemCard(makeItem({ matchedText: 'secret@mail.com' }), 0);
    expect(html).toContain('secret@mail.com');
  });

  it('renders redaction toggle defaulting to enabled (checked)', () => {
    const html = renderPIIItemCard(makeItem(), 0);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('renders toggle as unchecked when redactionEnabled is false', () => {
    const html = renderPIIItemCard(makeItem({}, false), 0);
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('checked');
  });

  it('includes data-pii-index attribute with the correct index', () => {
    const html = renderPIIItemCard(makeItem(), 5);
    expect(html).toContain('data-pii-index="5"');
  });

  it('escapes HTML in matched text to prevent XSS', () => {
    const html = renderPIIItemCard(makeItem({ matchedText: '<script>alert("xss")</script>' }), 0);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
