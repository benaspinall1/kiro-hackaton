# Requirements Document

## Introduction

Chat Frontend PII Panel is a web-based chat interface that integrates with the existing PII Redaction Filter backend. The frontend provides a modern chat experience where users can compose messages, have PII automatically detected and highlighted inline, review detected PII items in a slide-out side panel ("PrivacyLens"), and selectively redact or toggle individual PII items before sending messages to the downstream service. The goal is to give users full visibility and control over their sensitive data before it leaves the client.

## Glossary

- **Chat_UI**: The main web-based chat interface comprising the message list, input area, and PrivacyLens panel
- **Message_List**: The scrollable area displaying the conversation history as message bubbles
- **Message_Bubble**: A single chat message rendered as a styled container, aligned right for user messages and left for assistant responses
- **Message_Input**: The text input area at the bottom of the Chat_UI where users compose messages
- **PrivacyLens_Panel**: A slide-out side panel on the right side of the Chat_UI that displays detected PII items for user review before sending
- **PII_Highlight**: An inline colored background span applied to detected PII text within a message, with colors varying by PII type
- **PII_Item_Card**: A single entry in the PrivacyLens_Panel representing one detected PII entity, showing its type icon, label, risk level badge, matched value, and a redaction toggle
- **Risk_Level_Badge**: A visual indicator on a PII_Item_Card showing "High Risk", "Medium Risk", or "Low Risk" based on the PII type
- **Redaction_Toggle**: A switch control on each PII_Item_Card that enables or disables redaction for that specific PII entity
- **Auto_Redact_Button**: A button in the PrivacyLens_Panel that enables all Redaction_Toggles at once
- **PII_Scanner_API**: The backend endpoint that accepts text and returns detected PIIEntity arrays using the existing `scan()` function
- **Redaction_API**: The backend endpoint that accepts text and PIIEntity selections and returns redacted text using the existing `redact()` function
- **Chat_Proxy_API**: The backend endpoint that processes chat requests through the full pipeline using the existing `ChatProxyImpl`
- **Stats_Footer**: A footer area in the PrivacyLens_Panel displaying a cumulative count of PII items protected during the current session

## Requirements

### Requirement 1: Chat Message Display

**User Story:** As a user, I want to see my conversation displayed as message bubbles in a scrollable list, so that I can follow the chat history clearly.

#### Acceptance Criteria

1. THE Chat_UI SHALL render user messages as Message_Bubbles aligned to the right side of the Message_List
2. THE Chat_UI SHALL render assistant responses as Message_Bubbles aligned to the left side of the Message_List
3. THE Message_List SHALL automatically scroll to the most recent message when a new message is added
4. THE Chat_UI SHALL display a distinct visual style for user Message_Bubbles and assistant Message_Bubbles using different background colors

### Requirement 2: Message Composition and Submission

**User Story:** As a user, I want to type messages and send them, so that I can interact with the chat assistant.

#### Acceptance Criteria

1. THE Message_Input SHALL provide a text input field at the bottom of the Chat_UI
2. WHEN the user clicks the send button, THE Chat_UI SHALL submit the message text for PII scanning before sending
3. WHEN the user presses the Enter key, THE Chat_UI SHALL submit the message text for PII scanning before sending
4. WHILE the Message_Input contains no text, THE Chat_UI SHALL disable the send button
5. WHILE a message is being processed by the backend, THE Chat_UI SHALL display a loading indicator and disable the send button

### Requirement 3: Inline PII Highlighting

**User Story:** As a user, I want PII detected in my messages to be visually highlighted with colored backgrounds, so that I can immediately see which parts of my text contain sensitive data.

#### Acceptance Criteria

1. WHEN the PII_Scanner_API detects PII entities in a message, THE Chat_UI SHALL render each detected entity as a PII_Highlight with a colored background span inline within the message text
2. THE Chat_UI SHALL assign distinct background colors to each PII type: yellow for names and general identifiers, blue for EMAIL entities, red for SSN entities, orange for PHONE entities, purple for CREDIT_CARD entities, green for ADDRESS entities, and gray for FILE_PATH entities
3. WHEN no PII entities are detected in a message, THE Chat_UI SHALL render the message text without any PII_Highlights
4. THE PII_Highlight SHALL display the original matched text within the colored span so the user can read the detected value in context

### Requirement 4: PrivacyLens Panel Display

**User Story:** As a user, I want a side panel to appear showing all detected PII items, so that I can review sensitive data before my message is sent.

#### Acceptance Criteria

1. WHEN the PII_Scanner_API detects one or more PII entities in the current message, THE PrivacyLens_Panel SHALL slide open from the right side of the Chat_UI
2. THE PrivacyLens_Panel SHALL display a header showing the total count of detected PII items with the text format "{count} PII items detected"
3. THE PrivacyLens_Panel SHALL display the subtitle text "Review detected items before sending" below the count header
4. THE PrivacyLens_Panel SHALL render one PII_Item_Card for each detected PII entity
5. WHEN the user clicks the close button on the PrivacyLens_Panel, THE PrivacyLens_Panel SHALL slide closed
6. WHEN no PII entities are detected in the current message, THE PrivacyLens_Panel SHALL remain closed

### Requirement 5: PII Item Card Content

**User Story:** As a user, I want each detected PII item to show its type, risk level, and value, so that I can make informed decisions about redaction.

#### Acceptance Criteria

1. THE PII_Item_Card SHALL display an icon representing the PII type of the entity
2. THE PII_Item_Card SHALL display a label showing the PII type name of the entity
3. THE PII_Item_Card SHALL display a Risk_Level_Badge indicating the risk level: "High Risk" for SSN and CREDIT_CARD types, "Medium Risk" for EMAIL and PHONE types, and "Low Risk" for ADDRESS and FILE_PATH types
4. THE PII_Item_Card SHALL display the matched text value of the detected PII entity
5. THE PII_Item_Card SHALL display a Redaction_Toggle switch defaulting to the enabled state

### Requirement 6: Selective PII Redaction

**User Story:** As a user, I want to toggle redaction on or off for individual PII items, so that I can choose which sensitive data to protect before sending.

#### Acceptance Criteria

1. WHEN the user disables a Redaction_Toggle on a PII_Item_Card, THE Chat_UI SHALL exclude that PII entity from the redaction list when the message is sent
2. WHEN the user enables a Redaction_Toggle on a PII_Item_Card, THE Chat_UI SHALL include that PII entity in the redaction list when the message is sent
3. WHEN the user clicks the Auto_Redact_Button, THE Chat_UI SHALL set all Redaction_Toggles in the PrivacyLens_Panel to the enabled state
4. THE PII_Highlight for a toggled-off entity SHALL change to a muted visual style to indicate the entity will not be redacted

### Requirement 7: Message Sending with Redaction

**User Story:** As a user, I want my message to be sent with my chosen redactions applied, so that only the PII I selected is protected.

#### Acceptance Criteria

1. WHEN the user confirms sending from the PrivacyLens_Panel, THE Chat_UI SHALL send only the PII entities with enabled Redaction_Toggles to the Redaction_API for replacement
2. WHEN the Redaction_API returns the redacted text, THE Chat_UI SHALL forward the redacted message to the Chat_Proxy_API for processing
3. WHEN the Chat_Proxy_API returns a response, THE Chat_UI SHALL display the assistant reply as a new Message_Bubble in the Message_List
4. IF the Chat_Proxy_API returns an error, THEN THE Chat_UI SHALL display an error message to the user within the Message_List
5. WHEN no PII is detected in a message, THE Chat_UI SHALL send the original message directly to the Chat_Proxy_API without opening the PrivacyLens_Panel

### Requirement 8: Session PII Statistics

**User Story:** As a user, I want to see how many PII items have been protected during my session, so that I have confidence the system is working.

#### Acceptance Criteria

1. THE Stats_Footer SHALL display a cumulative count of PII items redacted during the current session with the text format "{count} items protected today"
2. WHEN a message is sent with redacted PII entities, THE Stats_Footer SHALL increment the cumulative count by the number of redacted entities
3. WHEN the user starts a new browser session, THE Stats_Footer SHALL reset the cumulative count to zero

### Requirement 9: Backend API Integration

**User Story:** As a developer, I want the frontend to communicate with the existing PII Redaction Filter backend through a REST API, so that the frontend leverages the proven scanning and redaction logic.

#### Acceptance Criteria

1. THE PII_Scanner_API SHALL accept a POST request with a JSON body containing a "text" field and return a JSON array of PIIEntity objects as defined in the backend types.ts
2. THE Redaction_API SHALL accept a POST request with a JSON body containing "text" and "entities" fields and return a JSON object with "redactedText" and "redactions" fields matching the backend RedactionResult type
3. THE Chat_Proxy_API SHALL accept a POST request with a JSON body matching the backend ChatRequest type and return a JSON response matching the backend ChatResponse type
4. IF the PII_Scanner_API returns a non-200 status code, THEN THE Chat_UI SHALL display an error notification and allow the user to retry scanning
5. IF the Redaction_API returns a non-200 status code, THEN THE Chat_UI SHALL display an error notification and prevent the message from being sent

### Requirement 10: Responsive Layout

**User Story:** As a user, I want the chat interface to adapt to different screen sizes, so that I can use it on desktop and tablet devices.

#### Acceptance Criteria

1. WHILE the viewport width is 1024 pixels or greater, THE Chat_UI SHALL display the Message_List and PrivacyLens_Panel side by side
2. WHILE the viewport width is less than 1024 pixels, THE PrivacyLens_Panel SHALL overlay the Message_List as a full-width modal panel
3. THE Message_Input SHALL remain fixed at the bottom of the viewport regardless of scroll position
