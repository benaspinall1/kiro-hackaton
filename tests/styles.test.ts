import { describe, it, expect } from 'vitest';
import { getResponsiveStyles, renderAppLayout } from '../src/frontend/styles';

describe('getResponsiveStyles', () => {
  it('returns a <style> tag', () => {
    const result = getResponsiveStyles();
    expect(result).toMatch(/^<style>[\s\S]*<\/style>$/);
  });

  it('includes desktop media query for ≥1024px', () => {
    const result = getResponsiveStyles();
    expect(result).toContain('@media (min-width: 1024px)');
  });

  it('includes mobile media query for <1024px', () => {
    const result = getResponsiveStyles();
    expect(result).toContain('@media (max-width: 1023px)');
  });

  it('sets panel to 360px width at desktop breakpoint', () => {
    const result = getResponsiveStyles();
    // Inside the min-width: 1024px block, panel should be 360px
    expect(result).toContain('width: 360px');
  });

  it('sets panel to full-width at mobile breakpoint', () => {
    const result = getResponsiveStyles();
    // Inside the max-width: 1023px block, panel should be 100%
    expect(result).toContain('width: 100%');
  });

  it('keeps message input fixed at bottom', () => {
    const result = getResponsiveStyles();
    expect(result).toContain('.message-input-area');
    expect(result).toContain('position: fixed');
    expect(result).toContain('bottom: 0');
  });

  it('uses flex row layout for app-layout container', () => {
    const result = getResponsiveStyles();
    expect(result).toContain('.app-layout');
    expect(result).toContain('flex-direction: row');
  });
});

describe('renderAppLayout', () => {
  it('wraps chat window and panel in app-layout container', () => {
    const html = renderAppLayout('<div class="chat-window">chat</div>', '<div class="privacy-lens-panel">panel</div>');
    expect(html).toContain('class="app-layout"');
    expect(html).toContain('class="chat-window"');
    expect(html).toContain('class="privacy-lens-panel"');
  });

  it('includes responsive styles before the layout', () => {
    const html = renderAppLayout('<div>chat</div>', '<div>panel</div>');
    const styleEnd = html.indexOf('</style>');
    const layoutStart = html.indexOf('class="app-layout"');
    expect(styleEnd).toBeLessThan(layoutStart);
  });

  it('places chat window before panel in DOM order', () => {
    const html = renderAppLayout('<div id="chat">chat</div>', '<div id="panel">panel</div>');
    const chatIdx = html.indexOf('id="chat"');
    const panelIdx = html.indexOf('id="panel"');
    expect(chatIdx).toBeLessThan(panelIdx);
  });

  it('preserves the provided HTML content', () => {
    const chatHtml = '<div class="chat-window"><p>Hello</p></div>';
    const panelHtml = '<div class="privacy-lens-panel"><p>PII</p></div>';
    const html = renderAppLayout(chatHtml, panelHtml);
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('<p>PII</p>');
  });
});
