/**
 * Responsive layout styles and app layout wrapper.
 *
 * Provides CSS media queries for responsive behavior:
 * - ≥1024px: Message_List and PrivacyLensPanel side by side
 * - <1024px: PrivacyLensPanel overlays as full-width modal
 * - Message_Input fixed at bottom of viewport at all sizes
 *
 * Validates: Requirements 10.1, 10.2, 10.3
 */

/**
 * Returns a `<style>` tag containing responsive CSS for the chat app layout.
 *
 * Media query breakpoints:
 * - ≥1024px: flex row layout, panel at fixed 360px width beside the chat
 * - <1024px: panel overlays as full-width modal (width: 100%)
 */
export function getResponsiveStyles(): string {
  return `<style>
.app-layout {
  display: flex;
  flex-direction: row;
  height: 100vh;
  width: 100%;
  position: relative;
}

.app-layout .chat-window {
  flex: 1;
  min-width: 0;
}

.message-input-area {
  position: fixed;
  bottom: 0;
}

/* Desktop: ≥1024px — side by side */
@media (min-width: 1024px) {
  .app-layout {
    flex-direction: row;
  }

  .app-layout .privacy-lens-panel {
    position: relative;
    width: 360px;
    height: 100%;
    transform: none;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  }
}

/* Mobile/Tablet: <1024px — panel overlays as full-width modal */
@media (max-width: 1023px) {
  .app-layout .privacy-lens-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
  }
}
</style>`;
}

/**
 * Wraps the chat window and privacy lens panel HTML in a responsive
 * flex container, prepended with the responsive stylesheet.
 *
 * @param chatWindowHtml - Rendered HTML string from renderChatWindow
 * @param panelHtml - Rendered HTML string from renderPrivacyLensPanel
 * @returns Full app layout HTML string with responsive styles
 */
export function renderAppLayout(chatWindowHtml: string, panelHtml: string): string {
  return (
    getResponsiveStyles() +
    '<div class="app-layout">' +
      chatWindowHtml +
      panelHtml +
    '</div>'
  );
}
