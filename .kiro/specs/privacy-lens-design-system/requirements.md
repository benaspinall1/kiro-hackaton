# Requirements Document

## Introduction

Privacy Lens is a standalone web page that intercepts user-submitted content (PDF, image, or plain text), scans it for Personally Identifiable Information (PII), and guides the user through a redaction review flow before submitting to a downstream AI chat service. This document specifies the requirements for the Privacy Lens design system and frontend UI — covering design tokens, component behaviour, interaction patterns, accessibility, and the complete user flow from upload through submission.

The tone of the product is firm but kind: serious without being alarming, human without being overly friendly. It creates one moment of informed pause — not a barrier, not a lecture.

---

## Glossary

- **Canvas**: The slide-in review panel that opens from the right side of the viewport after PII is detected, containing the before/after comparison, redaction checklist, and submission controls.
- **Design_System**: The complete set of design tokens, component specifications, and interaction patterns defined in this document.
- **Detection_Modal**: The centered modal-style notification that appears immediately after PII is detected in submitted content.
- **Ethics_Gate**: The backend ethics logic gate that evaluates whether a message may be forwarded downstream.
- **PII**: Personally Identifiable Information — any data that could identify a specific individual (e.g. SSN, email, phone number, credit card number, physical address, file path).
- **PII_Item_Card**: A single card in the Canvas checklist representing one detected PII entity, with its type, risk level, matched value, and redaction toggle.
- **PII_Scanner**: The backend component that detects PII entities in text.
- **Placeholder**: A type-specific token that replaces redacted PII in the submitted text (e.g. `[SSN_REDACTED]`, `[EMAIL_REDACTED]`).
- **Redaction_Canvas**: Synonym for Canvas — the full review panel.
- **Risk_Level**: A severity classification assigned to each PII type: High Risk (SSN, CREDIT_CARD), Medium Risk (EMAIL, PHONE), Low Risk (ADDRESS, FILE_PATH).
- **Scrim**: A semi-transparent dark overlay that covers the page behind a modal to focus user attention.
- **Submit_Original_Warning**: The scrim overlay and warning modal triggered when the user chooses to submit content without redaction.
- **Token**: A named design variable (colour, spacing, typography) that is referenced consistently across all components.
- **Upload_Zone**: The primary input area where users upload a PDF, image, or paste plain text.

---

## Requirements

### Requirement 1: Design Tokens — Colour

**User Story:** As a designer or developer, I want a defined colour token system, so that all UI components share a consistent, on-brand visual language.

#### Acceptance Criteria

1. THE Design_System SHALL define a warm-neutral base palette as the default background and surface colours for all components.
2. THE Design_System SHALL define a muted coral colour token used exclusively for PII alerts, warnings, and destructive action states.
3. THE Design_System SHALL define severity colour tokens for Risk_Level classification: a distinct colour for High Risk, a distinct colour for Medium Risk, and a distinct colour for Low Risk.
4. THE Design_System SHALL define a set of neutral text colour tokens covering primary text, secondary text, and disabled/placeholder text.
5. THE Design_System SHALL define border and divider colour tokens derived from the warm-neutral palette.
6. THE Design_System SHALL define interactive state colour tokens for hover, focus, and active states on all interactive elements.
7. WHEN a colour token is used for text on a coloured background, THE Design_System SHALL ensure the combination meets WCAG AA contrast ratio (minimum 4.5:1 for normal text, 3:1 for large text).
8. THE Design_System SHALL be light mode only; no dark mode tokens are required.

---

### Requirement 2: Design Tokens — Typography

**User Story:** As a designer or developer, I want a defined typography token system, so that all text in the UI has clear visual hierarchy and consistent rendering.

#### Acceptance Criteria

1. THE Design_System SHALL use Linden Hill as the primary typeface for all display and body text.
2. THE Design_System SHALL define a type scale with at minimum: a heading size, a subheading size, a body size, a small/label size, and a caption size.
3. THE Design_System SHALL define font-weight tokens for at minimum: regular (400) and bold (700).
4. THE Design_System SHALL define line-height tokens appropriate for each text size to ensure readability.
5. THE Design_System SHALL define letter-spacing tokens for heading and label text.
6. WHEN Linden Hill is unavailable, THE Design_System SHALL specify a serif fallback font stack.

---

### Requirement 3: Design Tokens — Spacing, Radius, and Shadow

**User Story:** As a designer or developer, I want spacing, border-radius, and shadow tokens, so that layout and elevation are consistent across all components.

#### Acceptance Criteria

1. THE Design_System SHALL define a spacing scale using a base unit of 4px, with named tokens at 4px, 8px, 12px, 16px, 24px, 32px, and 48px.
2. THE Design_System SHALL define border-radius tokens for: small (4px), medium (8px), large (12px), and pill (9999px).
3. THE Design_System SHALL define shadow tokens for: card elevation, panel elevation (Canvas), and modal elevation (Detection_Modal, Submit_Original_Warning).
4. THE Design_System SHALL define a z-index scale with named layers for: base content, Canvas panel, Scrim, and modal.

---

### Requirement 4: Upload Zone Component

**User Story:** As a user, I want a clear and accessible area to upload my content, so that I can easily submit a PDF, image, or plain text for PII scanning.

#### Acceptance Criteria

1. THE Upload_Zone SHALL accept PDF files, image files (JPEG, PNG, WebP), and plain text input via paste.
2. THE Upload_Zone SHALL support drag-and-drop file upload in addition to click-to-browse.
3. WHEN a user drags a file over the Upload_Zone, THE Upload_Zone SHALL display a visual drag-active state using the focus colour token.
4. WHEN a file type other than PDF, JPEG, PNG, or WebP is dropped, THE Upload_Zone SHALL display an inline error message and reject the file.
5. WHEN a file is accepted, THE Upload_Zone SHALL display the file name and type before submission.
6. THE Upload_Zone SHALL include a clearly labelled text area for pasting plain text as an alternative to file upload.
7. WHEN the text area is empty and no file is selected, THE Upload_Zone SHALL disable the primary submission button.
8. THE Upload_Zone SHALL be keyboard-navigable and operable without a mouse.

---

### Requirement 5: Detection Modal Component

**User Story:** As a user, I want to be clearly notified when PII is found in my content, so that I understand what was detected before deciding how to proceed.

#### Acceptance Criteria

1. WHEN PII is detected in submitted content, THE Detection_Modal SHALL appear centered in the viewport over a Scrim.
2. THE Detection_Modal SHALL display a summary count of detected PII items (e.g. "3 items detected").
3. THE Detection_Modal SHALL display a brief, non-alarming message explaining that PII was found and that the user can review it.
4. THE Detection_Modal SHALL include a single primary action button labelled "Review" that opens the Canvas.
5. THE Detection_Modal SHALL include a secondary action labelled "Dismiss" that closes the modal without opening the Canvas.
6. WHEN the Detection_Modal is open, THE page content behind the Scrim SHALL be non-interactive.
7. WHEN the Detection_Modal is open, THE Detection_Modal SHALL be focusable and operable via keyboard, with focus trapped inside the modal.
8. WHEN the user presses Escape while the Detection_Modal is open, THE Detection_Modal SHALL close.
9. THE Detection_Modal SHALL use the muted coral colour token for its alert icon or accent element, not as a dominant background colour.

---

### Requirement 6: Canvas Panel Component

**User Story:** As a user, I want a dedicated review panel where I can compare original and redacted content and choose which items to redact, so that I have full control before submitting.

#### Acceptance Criteria

1. WHEN the user clicks "Review" in the Detection_Modal, THE Canvas SHALL slide in from the right side of the viewport with a smooth transition (300ms ease).
2. THE Canvas SHALL display a before/after comparison slider showing the original content alongside the redacted version.
3. WHEN the content is text, THE Canvas SHALL render the original text with detected PII highlighted (highlight + underline) and the redacted version with Placeholder tokens substituted.
4. WHEN the content is a PDF or image, THE Canvas SHALL render the original with bounding boxes drawn around detected PII regions and the redacted version with black boxes over those regions.
5. THE Canvas SHALL include a scrollable checklist of all detected PII items below the comparison view.
6. THE Canvas SHALL display a small download button in the top-right corner of the Canvas header that downloads the redacted file.
7. THE Canvas SHALL display two primary action buttons below the checklist: "Submit Anonymized" and "Submit Original".
8. THE Canvas SHALL be closeable via a close button (✕) in the Canvas header.
9. WHEN the Canvas is open on a viewport narrower than 1024px, THE Canvas SHALL overlay the full viewport width.
10. WHEN the Canvas is open on a viewport 1024px or wider, THE Canvas SHALL occupy a fixed panel width of 360px alongside the main content.
11. THE Canvas header SHALL display the total count of detected PII items.

---

### Requirement 7: PII Item Card Component

**User Story:** As a user, I want to see each detected PII item clearly labelled with its type, risk level, and matched value, so that I can make an informed decision about whether to redact it.

#### Acceptance Criteria

1. THE PII_Item_Card SHALL display the PII type label (e.g. "SSN", "EMAIL").
2. THE PII_Item_Card SHALL display a Risk_Level badge colour-coded by severity: the High Risk badge SHALL use the High Risk severity colour token, the Medium Risk badge SHALL use the Medium Risk severity colour token, and the Low Risk badge SHALL use the Low Risk severity colour token.
3. THE PII_Item_Card SHALL display the matched text value (the actual detected string).
4. THE PII_Item_Card SHALL display a toggle switch that defaults to the enabled (redact) state.
5. WHEN the toggle is enabled, THE PII_Item_Card SHALL visually indicate that the item will be redacted.
6. WHEN the toggle is disabled, THE PII_Item_Card SHALL visually indicate that the item will be kept in the submitted content.
7. THE PII_Item_Card SHALL display a type-appropriate icon alongside the PII type label.
8. THE PII_Item_Card toggle SHALL be operable via keyboard.

---

### Requirement 8: PII Highlighting in Text

**User Story:** As a user, I want detected PII in text content to be visually marked, so that I can immediately see what was found and where.

#### Acceptance Criteria

1. WHEN PII is detected in plain text, THE PII_Highlighter SHALL render each detected entity with a background highlight colour and an underline.
2. THE PII_Highlighter SHALL use a distinct highlight colour per PII type, derived from the Design_System colour tokens.
3. THE PII_Highlighter SHALL not alter the text content — only the visual presentation.
4. WHEN two PII entities overlap in position, THE PII_Highlighter SHALL render the entity with the earlier start index first without dropping characters.
5. WHEN no PII entities are present, THE PII_Highlighter SHALL render the text without any highlighting.

---

### Requirement 9: Image and PDF Bounding Box Rendering

**User Story:** As a user, I want detected PII regions in images and PDFs to be visually marked with bounding boxes, so that I can see exactly where sensitive information appears.

#### Acceptance Criteria

1. WHEN PII is detected in an image, THE Canvas SHALL draw a bounding box around each detected region using the muted coral colour token as the box stroke colour.
2. WHEN the user views the redacted version of an image, THE Canvas SHALL render a solid black filled rectangle (blackout bar) over each redacted region, fully obscuring the underlying content.
3. WHEN PII is detected in a PDF, THE Canvas SHALL draw bounding boxes on the rendered page view in the same manner as images; in the redacted version, each PII region SHALL be covered with a solid black blackout bar.
4. THE bounding box stroke SHALL have sufficient width (minimum 2px) to be clearly visible against varied image backgrounds.
5. WHEN a bounding box is hovered, THE Canvas SHALL display a tooltip showing the PII type and Risk_Level of the detected entity.

---

### Requirement 10: Submit Original Warning Component

**User Story:** As a user, I want a clear warning when I choose to submit content without redaction, so that I can make a fully informed decision about the privacy risk.

#### Acceptance Criteria

1. WHEN the user clicks "Submit Original" in the Canvas, THE Submit_Original_Warning SHALL appear as a modal centered in the viewport over a Scrim.
2. THE Submit_Original_Warning SHALL display a warning message of 1–2 lines that clearly states the risk of submitting PII to an AI service.
3. THE Submit_Original_Warning SHALL use the muted coral colour token as an accent on the warning icon or heading, not as a dominant background.
4. THE Submit_Original_Warning SHALL include two buttons: "Go Back" (secondary) and "Submit Original" (primary destructive).
5. WHEN the user clicks "Go Back", THE Submit_Original_Warning SHALL close and return focus to the Canvas.
6. WHEN the user clicks "Submit Original" in the Submit_Original_Warning, THE system SHALL proceed with the unredacted submission.
7. WHEN the Submit_Original_Warning is open, THE page content and Canvas behind the Scrim SHALL be non-interactive.
8. WHEN the Submit_Original_Warning is open, THE Submit_Original_Warning SHALL trap keyboard focus inside the modal.
9. WHEN the user presses Escape while the Submit_Original_Warning is open, THE Submit_Original_Warning SHALL close and return focus to the Canvas.
10. THE warning message tone SHALL be firm and informative without using alarming or judgmental language.

---

### Requirement 11: Accessibility

**User Story:** As a user with accessibility needs, I want the Privacy Lens UI to be fully operable without a mouse and to meet WCAG AA standards, so that I can use the product regardless of how I interact with my computer.

#### Acceptance Criteria

1. THE Design_System SHALL ensure all interactive elements have a visible focus indicator that meets WCAG AA contrast requirements.
2. THE Design_System SHALL ensure all text and interactive elements meet WCAG AA colour contrast ratios (4.5:1 for normal text, 3:1 for large text and UI components).
3. WHEN a modal (Detection_Modal or Submit_Original_Warning) is open, THE system SHALL trap keyboard focus within the modal and restore focus to the triggering element on close.
4. THE Upload_Zone, Canvas, Detection_Modal, and Submit_Original_Warning SHALL each have appropriate ARIA roles and labels.
5. THE PII_Item_Card toggle SHALL have an accessible label that includes the PII type and current state (e.g. "Redact SSN — enabled").
6. THE Canvas before/after comparison slider SHALL be operable via keyboard arrow keys.
7. WHEN an error state occurs (e.g. unsupported file type), THE system SHALL announce the error to screen readers via an ARIA live region.
8. THE Design_System SHALL not rely on colour alone to convey meaning — all colour-coded states SHALL also have a text label or icon.

---

### Requirement 12: Tone and Copy

**User Story:** As a user, I want all UI copy to feel calm, respectful, and informative, so that I feel guided rather than judged or alarmed.

#### Acceptance Criteria

1. THE Design_System SHALL define copy guidelines specifying that all user-facing messages use firm but kind language — serious without being alarming.
2. THE Design_System SHALL specify that warning messages state the risk clearly in 1–2 lines without using words that imply user fault or negligence.
3. THE Design_System SHALL specify that action button labels use plain, direct language (e.g. "Submit Anonymized", "Submit Original", "Review", "Go Back").
4. THE Design_System SHALL specify that PII type labels use the canonical type names defined in the Glossary (SSN, EMAIL, PHONE, CREDIT_CARD, ADDRESS, FILE_PATH).
5. THE Design_System SHALL specify that empty states and loading states include brief, reassuring copy rather than technical error codes.

---

### Requirement 13: Responsive Layout

**User Story:** As a user on a desktop browser, I want the layout to adapt correctly between narrow and wide viewports, so that the Canvas and main content are always usable.

#### Acceptance Criteria

1. WHEN the viewport width is 1024px or wider, THE layout SHALL display the Canvas as a fixed 360px panel to the right of the main content area.
2. WHEN the viewport width is less than 1024px, THE Canvas SHALL overlay the full viewport as a modal-style panel.
3. THE primary submission button in the Upload_Zone SHALL remain visible and accessible at all viewport widths.
4. THE Canvas checklist SHALL be scrollable independently of the main page content.
5. THE Design_System SHALL target Chrome on desktop as the primary supported browser.

---

### Requirement 14: Animation and Motion

**User Story:** As a user, I want UI transitions to feel smooth and purposeful, so that the interface feels polished without being distracting.

#### Acceptance Criteria

1. THE Canvas SHALL animate open with a slide-in-from-right transition of 300ms using an ease timing function.
2. THE Canvas SHALL animate closed with a slide-out-to-right transition of 300ms using an ease timing function.
3. THE Detection_Modal SHALL animate in with a fade-in transition of 150ms.
4. THE Submit_Original_Warning SHALL animate in with a fade-in transition of 150ms.
5. THE Scrim SHALL fade in and out with a transition of 150ms.
6. THE PII_Item_Card toggle SHALL animate its state change with a colour transition of 200ms.
7. WHERE a user has enabled the `prefers-reduced-motion` media query, THE Design_System SHALL disable or minimise all transitions and animations.
