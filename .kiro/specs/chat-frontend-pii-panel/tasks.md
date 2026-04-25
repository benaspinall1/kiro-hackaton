# Implementation Plan: Chat Frontend PII Panel

## Overview

Build a TypeScript web-based chat frontend with inline PII highlighting and a PrivacyLens slide-out panel. The frontend integrates with the existing PII Redaction Filter backend via three REST API endpoints (`/api/scan`, `/api/redact`, `/api/chat`). Implementation proceeds bottom-up: shared types and utilities first, then pure logic functions, then UI components, then API integration, and finally wiring everything together.

## Tasks

- [ ] 1. Set up frontend project structure and shared types
  - [x] 1.1 Create frontend directory structure and entry point
    - Create `src/frontend/` directory with `index.ts` entry point
    - Create `src/frontend/types.ts` with frontend-specific interfaces: `ChatMessage`, `PIIItemState`, `TextSegment`, `SessionStats`, `RiskLevel`
    - Import and re-export shared backend types (`PIIType`, `PIIEntity`, `RedactionResult`, `ChatRequest`, `ChatResponse`) from `src/types.ts`
    - Define `PII_COLOR_MAP` constant mapping each `PIIType` to its background color string
    - Define `RISK_LEVEL_MAP` constant mapping each `PIIType` to its `RiskLevel`
    - _Requirements: 3.2, 5.3_

  - [x] 1.2 Implement risk level and icon utility functions
    - Implement `getRiskLevel(type: PIIType): RiskLevel` using `RISK_LEVEL_MAP`
    - Implement `getPIIIcon(type: PIIType): string` returning a type-appropriate icon identifier
    - _Requirements: 5.1, 5.3_

- [ ] 2. Implement core logic functions
  - [x] 2.1 Implement `segmentText` function
    - Create `src/frontend/pii-highlighter.ts`
    - Implement `segmentText(text: string, entities: PIIEntity[]): TextSegment[]`
    - Iterate through sorted entities, splitting text into alternating plain and highlighted segments
    - Each highlighted segment carries its entity reference for color mapping
    - Return a single unhighlighted segment when entity array is empty
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 2.2 Write property test for text segmentation (Property 1)
    - **Property 1: Text Segmentation Preserves Original Text**
    - Generate random strings (1–500 chars) and random non-overlapping entity spans within them
    - Verify: (a) concatenating all segment `.text` values reproduces original text exactly, (b) highlighted segments match entity `matchedText`, (c) empty entity array produces single unhighlighted segment
    - Create `tests/pii-highlighter.property.test.ts` using fast-check with `{ numRuns: 100 }`
    - Tag: `Feature: chat-frontend-pii-panel, Property 1: Text Segmentation Preserves Original Text`
    - **Validates: Requirements 3.1, 3.3, 3.4**

  - [x] 2.3 Implement selective redaction filtering logic
    - Create `src/frontend/redaction-filter.ts`
    - Implement `filterEnabledEntities(items: PIIItemState[]): PIIEntity[]` — returns only entities where `redactionEnabled === true`, preserving order
    - Implement `autoRedactAll(items: PIIItemState[]): PIIItemState[]` — returns new array with all `redactionEnabled` set to `true`, entity references unchanged
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.4 Write property test for selective redaction filtering (Property 2)
    - **Property 2: Selective Redaction Filtering**
    - Generate arrays of 1–20 PIIItemState objects with random `redactionEnabled` booleans
    - Verify filtered output contains exactly the entities where `redactionEnabled === true`, preserving order, and count matches
    - Create `tests/redaction-filter.property.test.ts` using fast-check with `{ numRuns: 100 }`
    - Tag: `Feature: chat-frontend-pii-panel, Property 2: Selective Redaction Filtering`
    - **Validates: Requirements 6.1, 6.2, 7.1**

  - [x] 2.5 Write property test for auto-redact-all (Property 3)
    - **Property 3: Auto-Redact Enables All Toggles**
    - Generate arrays of 1–20 PIIItemState objects with random toggle states
    - Verify: all items have `redactionEnabled === true` after applying `autoRedactAll`, array length unchanged, entity references unchanged
    - Add to `tests/redaction-filter.property.test.ts` using fast-check with `{ numRuns: 100 }`
    - Tag: `Feature: chat-frontend-pii-panel, Property 3: Auto-Redact Enables All Toggles`
    - **Validates: Requirements 6.3**

  - [x] 2.6 Implement session stats accumulation logic
    - Create `src/frontend/session-stats.ts`
    - Implement `getSessionStats(): SessionStats` — reads from `sessionStorage`, returns `{ itemsProtected: 0 }` if not found
    - Implement `incrementSessionStats(count: number): SessionStats` — adds count to current value, writes back to `sessionStorage`, returns updated stats
    - Implement `resetSessionStats(): void` — clears the session stats entry
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 2.7 Write property test for session stats accumulation (Property 4)
    - **Property 4: Session Stats Accumulation**
    - Generate sequences of 1–50 non-negative integers
    - Apply each as a redaction count increment, verify running total equals sum of all counts
    - Create `tests/session-stats.property.test.ts` using fast-check with `{ numRuns: 100 }`
    - Tag: `Feature: chat-frontend-pii-panel, Property 4: Session Stats Accumulation`
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement API service layer
  - [x] 4.1 Create API service module
    - Create `src/frontend/api-service.ts`
    - Implement `scanForPII(text: string): Promise<PIIEntity[]>` — POST to `/api/scan` with `{ text }`, return parsed `PIIEntity[]`
    - Implement `redactText(text: string, entities: PIIEntity[]): Promise<RedactionResult>` — POST to `/api/redact` with `{ text, entities }`, return parsed `RedactionResult`
    - Implement `sendMessage(request: ChatRequest): Promise<ChatResponse>` — POST to `/api/chat` with request body, return parsed `ChatResponse`
    - Throw typed errors on non-200 responses for UI error handling
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 4.2 Write unit tests for API service
    - Test `scanForPII` returns `PIIEntity[]` on success and throws on non-200
    - Test `redactText` returns `RedactionResult` on success and throws on non-200
    - Test `sendMessage` returns `ChatResponse` on success and throws on non-200
    - Test network error handling (fetch failure)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 5. Implement UI components
  - [x] 5.1 Implement MessageBubble component
    - Create `src/frontend/components/message-bubble.ts`
    - Render user messages right-aligned with user background color
    - Render assistant messages left-aligned with assistant background color
    - Render error messages with distinct error styling
    - For user messages with PII entities, render inline PII_Highlight spans using `segmentText` and `PII_COLOR_MAP`
    - Apply muted style to highlights for toggled-off entities
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.2, 3.4, 6.4_

  - [~] 5.2 Implement PIIItemCard component
    - Create `src/frontend/components/pii-item-card.ts`
    - Display PII type icon using `getPIIIcon`
    - Display PII type label
    - Display Risk_Level_Badge using `getRiskLevel` with color coding (red for High, yellow for Medium, green for Low)
    - Display matched text value
    - Display Redaction_Toggle switch defaulting to enabled state
    - Emit toggle event when switch is clicked
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [~] 5.3 Implement PrivacyLensPanel component
    - Create `src/frontend/components/privacy-lens-panel.ts`
    - Slide-out panel from right side of Chat_UI
    - Display header with "{count} PII items detected" format
    - Display subtitle "Review detected items before sending"
    - Render one PIIItemCard per detected entity
    - Include Auto_Redact_Button that calls `onAutoRedactAll`
    - Include confirm send button that calls `onConfirmSend`
    - Include close button that calls `onClose`
    - Display Stats_Footer with "{count} items protected today" format
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 6.3, 8.1_

  - [~] 5.4 Implement ChatWindow component
    - Create `src/frontend/components/chat-window.ts`
    - Manage `ChatWindowState`: messages array, isLoading flag, inputText
    - Render Message_List with auto-scroll to most recent message
    - Render Message_Input fixed at bottom of viewport with send button
    - Disable send button when input is empty or loading
    - Show loading indicator while processing
    - Handle Enter key and send button click to trigger message submission
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 10.3_

  - [~] 5.5 Write unit tests for UI components
    - Test MessageBubble renders user messages right-aligned, assistant left-aligned
    - Test MessageBubble applies distinct background colors per role
    - Test PII color map returns distinct colors for each PIIType
    - Test getRiskLevel returns correct risk level for each PIIType
    - Test PIIItemCard displays icon, label, matched text, and toggle defaulting to enabled
    - Test PrivacyLensPanel header shows correct count format
    - Test PrivacyLensPanel subtitle shows static text
    - Test PrivacyLensPanel renders one card per entity
    - Test send button disabled when input is empty
    - _Requirements: 1.1, 1.2, 1.4, 2.4, 3.2, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [~] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement message flow orchestration and wiring
  - [~] 7.1 Implement message submission flow controller
    - Create `src/frontend/chat-controller.ts`
    - On message submit: call `scanForPII`, check for PII entities
    - If no PII detected: send original message directly to `sendMessage`, display reply
    - If PII detected: render highlights in message, open PrivacyLensPanel with PIIItemState array (all `redactionEnabled: true`)
    - On confirm send: filter enabled entities via `filterEnabledEntities`, call `redactText` with selected entities, forward redacted text to `sendMessage`
    - On reply received: add assistant Message_Bubble to Message_List, increment session stats by redacted entity count
    - Handle scan API errors: show error notification, allow retry
    - Handle redaction API errors: show error notification, prevent send, keep panel open
    - Handle chat API errors: display error Message_Bubble
    - Handle `blocked: true` response: display block notification
    - _Requirements: 2.2, 2.3, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 9.4, 9.5_

  - [~] 7.2 Implement responsive layout
    - Add responsive CSS/layout logic to ChatWindow and PrivacyLensPanel
    - At viewport ≥1024px: display Message_List and PrivacyLensPanel side by side
    - At viewport <1024px: PrivacyLensPanel overlays as full-width modal
    - Message_Input remains fixed at bottom of viewport
    - _Requirements: 10.1, 10.2, 10.3_

  - [~] 7.3 Wire all components together in main entry point
    - Update `src/frontend/index.ts` to initialize ChatWindow, bind ChatController, mount to DOM
    - Connect PrivacyLensPanel toggle events to PIIItemState updates
    - Connect Auto_Redact_Button to `autoRedactAll`
    - Connect close button to panel close handler
    - Connect Stats_Footer to `getSessionStats`
    - Ensure session stats reset on new session (sessionStorage behavior)
    - _Requirements: 4.1, 4.5, 4.6, 6.3, 8.1, 8.3_

  - [~] 7.4 Write integration tests for message flow
    - Test full flow: compose → scan → highlight → toggle → redact → send → display reply
    - Test no-PII message sends directly without panel
    - Test error response displayed as error bubble
    - Test scan API error shows notification with retry
    - Test redaction API error prevents send
    - _Requirements: 2.2, 7.1, 7.2, 7.3, 7.4, 7.5, 9.4, 9.5_

- [ ] 8. Implement backend REST API endpoints
  - [~] 8.1 Create Express/HTTP server with API routes
    - Create `src/frontend/server.ts` (or extend existing server if present)
    - Implement `POST /api/scan` — parse `{ text }` body, call `scan(text)`, return `PIIEntity[]` as JSON
    - Implement `POST /api/redact` — parse `{ text, entities }` body, call `redact(text, entities)`, return `RedactionResult` as JSON
    - Implement `POST /api/chat` — parse `ChatRequest` body, call `ChatProxyImpl.processRequest()`, return `ChatResponse` as JSON
    - Add error handling middleware returning appropriate HTTP status codes
    - _Requirements: 9.1, 9.2, 9.3_

  - [~] 8.2 Write unit tests for API endpoints
    - Test `/api/scan` returns PIIEntity array for text with PII
    - Test `/api/scan` returns empty array for clean text
    - Test `/api/redact` returns RedactionResult with correct redacted text
    - Test `/api/chat` returns ChatResponse
    - Test error responses return appropriate status codes
    - _Requirements: 9.1, 9.2, 9.3_

- [~] 9. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 4 correctness properties defined in the design document
- The frontend reuses shared types from the existing backend `src/types.ts`
- All tests use vitest with fast-check for property-based tests, consistent with the existing project setup
