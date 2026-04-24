# Requirements Document

## Introduction

The PII Redaction Filter is a middleware layer for chat applications that intercepts user prompts before they reach the underlying chat service. It detects Personally Identifiable Information (PII) such as email addresses, phone numbers, social security numbers, credit card numbers, physical addresses, and file system paths within user messages and uploaded document content, including text extracted from PDF attachments. When PII is detected, the filter redacts the sensitive data, notifies the user about what was redacted, and enforces an Ethics Logic Gate that halts processing if a privacy rule is violated. This feature actively mitigates the human bias of inadvertent data disclosure — users often share sensitive information without realizing the privacy risk. Developers frequently paste terminal output into chat applications, inadvertently leaking their file system structure, usernames, and project layouts through file and directory paths.

## Glossary

- **PII_Scanner**: The component responsible for analyzing text input and identifying PII entities within it.
- **Redaction_Engine**: The component responsible for replacing detected PII entities with redacted placeholders in the text.
- **Ethics_Logic_Gate**: The component that evaluates privacy rules against detected PII and halts the processing pipeline if a privacy violation is detected.
- **Notification_Service**: The component responsible for informing the user about detected and redacted PII entities.
- **Chat_Proxy**: The middleware layer that sits between the user interface and the downstream chat service, orchestrating scanning, redaction, and forwarding.
- **PII_Entity**: A discrete piece of personally identifiable information detected in text (e.g., an email address, phone number, SSN).
- **Redacted_Placeholder**: A replacement token inserted in place of a PII entity (e.g., `[EMAIL_REDACTED]`, `[PHONE_REDACTED]`).
- **Privacy_Rule**: A configurable rule that defines which PII types must be blocked, redacted, or flagged.
- **Redaction_Report**: A structured summary of all PII entities detected and actions taken on a given message.
- **PDF_Text_Extractor**: The component responsible for extracting readable text content from uploaded PDF documents so that the extracted text can be scanned for PII.
- **Uploaded_Document**: A file attached to a user chat submission, such as a PDF, that may contain PII in its text content.
- **File_Path**: A file system path string that reveals directory structure, usernames, or project layout. Includes Unix-style paths (e.g., `/home/user/project/src/main.ts`, `~/Documents/secret.pdf`), Windows-style paths (e.g., `C:\Users\john\Documents\file.txt`, `\\server\share\folder`), and relative paths with directory separators.

## Requirements

### Requirement 1: PII Detection in User Prompts

**User Story:** As a chat application operator, I want all user prompts scanned for PII before they reach the chat service, so that sensitive data is never forwarded unredacted.

#### Acceptance Criteria

1. WHEN a user submits a chat prompt, THE PII_Scanner SHALL analyze the full text content for PII entities before the prompt is forwarded to the downstream chat service.
2. THE PII_Scanner SHALL detect the following PII types: email addresses, phone numbers, Social Security Numbers, credit card numbers, physical mailing addresses, and file system paths.
3. WHEN the PII_Scanner detects one or more PII entities, THE PII_Scanner SHALL return a list of PII_Entity objects each containing the entity type, the matched text span, and the start and end character positions.
4. WHEN the PII_Scanner receives a prompt containing no PII, THE PII_Scanner SHALL return an empty list of PII entities.
5. THE PII_Scanner SHALL process each prompt within 500 milliseconds for messages up to 10,000 characters.

### Requirement 2: PII Redaction

**User Story:** As a chat application operator, I want detected PII automatically replaced with safe placeholders, so that sensitive data is removed before the message is processed further.

#### Acceptance Criteria

1. WHEN the PII_Scanner returns one or more PII entities, THE Redaction_Engine SHALL replace each detected PII entity in the original text with a corresponding Redacted_Placeholder.
2. THE Redaction_Engine SHALL use type-specific placeholders: `[EMAIL_REDACTED]` for email addresses, `[PHONE_REDACTED]` for phone numbers, `[SSN_REDACTED]` for Social Security Numbers, `[CREDIT_CARD_REDACTED]` for credit card numbers, `[ADDRESS_REDACTED]` for physical addresses, and `[FILE_PATH_REDACTED]` for file system paths.
3. THE Redaction_Engine SHALL preserve all non-PII text in the original message unchanged.
4. WHEN multiple PII entities of the same type appear in a single message, THE Redaction_Engine SHALL redact each occurrence independently.
5. FOR ALL valid input texts, redacting then scanning the redacted output SHALL detect zero PII entities (round-trip property).

### Requirement 3: Ethics Logic Gate

**User Story:** As a compliance officer, I want the system to halt processing and refuse to forward a message when a critical privacy rule is violated, so that high-risk PII is never transmitted downstream.

#### Acceptance Criteria

1. THE Ethics_Logic_Gate SHALL evaluate all detected PII entities against the configured set of Privacy_Rules before the message is forwarded.
2. WHEN a detected PII entity matches a Privacy_Rule configured as "block", THE Ethics_Logic_Gate SHALL halt the processing pipeline and prevent the message from being forwarded to the downstream chat service.
3. WHEN the Ethics_Logic_Gate blocks a message, THE Ethics_Logic_Gate SHALL return a rejection response containing the reason for blocking and the PII types that triggered the block.
4. WHEN all detected PII entities match Privacy_Rules configured as "redact", THE Ethics_Logic_Gate SHALL allow the redacted message to proceed through the pipeline.
5. WHEN no Privacy_Rules are configured, THE Ethics_Logic_Gate SHALL default to redacting all detected PII types and allowing the message to proceed.
6. IF the Ethics_Logic_Gate encounters an internal error during rule evaluation, THEN THE Ethics_Logic_Gate SHALL block the message and log the error rather than allowing unscanned content through.

### Requirement 4: User Notification

**User Story:** As a chat user, I want to be informed when my message contains PII and what actions were taken, so that I am aware of the redaction and can adjust my behavior.

#### Acceptance Criteria

1. WHEN the Redaction_Engine redacts one or more PII entities from a message, THE Notification_Service SHALL send a notification to the user listing each redacted PII type and the count of redactions per type.
2. WHEN the Ethics_Logic_Gate blocks a message, THE Notification_Service SHALL send a notification to the user explaining that the message was blocked due to a privacy rule violation and listing the PII types that caused the block.
3. THE Notification_Service SHALL deliver notifications synchronously as part of the response to the user's original chat submission.
4. WHEN no PII is detected in a message, THE Notification_Service SHALL not send any PII-related notification.

### Requirement 5: Chat Proxy Middleware Integration

**User Story:** As a developer, I want the PII redaction filter to operate as a transparent middleware layer, so that it can be integrated with any standard chat application without modifying the chat service itself.

#### Acceptance Criteria

1. THE Chat_Proxy SHALL intercept each incoming user prompt before it reaches the downstream chat service.
2. THE Chat_Proxy SHALL invoke the PII_Scanner, then the Redaction_Engine, then the Ethics_Logic_Gate in sequence for each intercepted prompt. WHEN the prompt includes an attached PDF document, THE Chat_Proxy SHALL invoke the PDF_Text_Extractor before the PII_Scanner.
3. WHEN the Ethics_Logic_Gate allows a message to proceed, THE Chat_Proxy SHALL forward the redacted message to the downstream chat service and return the chat service response along with the Redaction_Report to the user.
4. WHEN the Ethics_Logic_Gate blocks a message, THE Chat_Proxy SHALL return the block notification to the user without contacting the downstream chat service.
5. IF the downstream chat service is unavailable, THEN THE Chat_Proxy SHALL return an error response to the user and not retry automatically.

### Requirement 6: Redaction Report Generation

**User Story:** As a chat application operator, I want a structured report of all PII detections and actions for each message, so that I can audit redaction activity.

#### Acceptance Criteria

1. WHEN the Chat_Proxy processes a message, THE Chat_Proxy SHALL generate a Redaction_Report containing: the original message hash (not the original text), the count of PII entities detected per type, the action taken for each entity (redacted or blocked), and a timestamp.
2. THE Chat_Proxy SHALL include the Redaction_Report in the response returned to the calling application.
3. WHEN no PII is detected, THE Chat_Proxy SHALL generate a Redaction_Report with zero counts and an action of "none".

### Requirement 7: Privacy Rule Configuration

**User Story:** As a chat application operator, I want to configure which PII types are blocked versus redacted, so that I can tailor the filter to my organization's privacy policy.

#### Acceptance Criteria

1. THE Ethics_Logic_Gate SHALL accept a Privacy_Rule configuration that maps each supported PII type to an action of either "block" or "redact".
2. WHEN a PII type is not present in the Privacy_Rule configuration, THE Ethics_Logic_Gate SHALL default to "redact" for that PII type.
3. THE Ethics_Logic_Gate SHALL validate the Privacy_Rule configuration at startup and reject configurations that reference unsupported PII types.

### Requirement 8: PII Detection Pattern Accuracy

**User Story:** As a chat application operator, I want PII detection to be accurate and cover common formats, so that real PII is not missed and non-PII text is not falsely flagged.

#### Acceptance Criteria

1. THE PII_Scanner SHALL detect email addresses matching the RFC 5322 simplified format (local-part@domain).
2. THE PII_Scanner SHALL detect US phone numbers in common formats including (XXX) XXX-XXXX, XXX-XXX-XXXX, and +1XXXXXXXXXX.
3. THE PII_Scanner SHALL detect Social Security Numbers in the format XXX-XX-XXXX and XXXXXXXXX.
4. THE PII_Scanner SHALL detect credit card numbers of 13 to 19 digits with optional spaces or dashes between groups.
5. THE PII_Scanner SHALL not flag Redacted_Placeholder tokens as PII entities.

### Requirement 9: PII Detection in PDF Documents

**User Story:** As a chat application operator, I want uploaded PDF documents scanned for PII before their content reaches the chat service, so that sensitive data within document attachments is detected and handled through the same redaction pipeline as plain-text prompts.

#### Acceptance Criteria

1. WHEN a user submits a chat message with an attached PDF document, THE PDF_Text_Extractor SHALL extract all readable text content from the PDF before PII scanning begins.
2. THE PDF_Text_Extractor SHALL support PDF documents up to 50 pages in length.
3. WHEN a PDF document contains no extractable text (e.g., image-only scanned documents), THE PDF_Text_Extractor SHALL return an empty text result and THE Chat_Proxy SHALL flag the document as "unprocessable" in the Redaction_Report.
4. WHEN the PDF_Text_Extractor successfully extracts text, THE Chat_Proxy SHALL pass the extracted text to the PII_Scanner for PII detection using the same scanning logic applied to plain-text prompts.
5. WHEN PII entities are detected in extracted PDF text, THE Redaction_Engine SHALL redact the PII in the extracted text and THE Chat_Proxy SHALL forward the redacted text representation to the downstream chat service in place of the original PDF content.
6. IF the PDF_Text_Extractor encounters a corrupted or password-protected PDF, THEN THE Chat_Proxy SHALL reject the document, return an error response to the user describing the failure reason, and not forward the document content to the downstream chat service.
7. THE PDF_Text_Extractor SHALL process a single PDF document of up to 50 pages within 3 seconds.
8. WHEN a chat message includes both a text prompt and an attached PDF document, THE Chat_Proxy SHALL scan both the text prompt and the extracted PDF text independently and combine the results into a single Redaction_Report.

### Requirement 10: File System Path Detection and Redaction

**User Story:** As a chat application operator, I want file system paths detected and redacted from user messages, so that developers who paste terminal output into chat applications do not inadvertently leak their directory structure, usernames, or project layouts.

#### Acceptance Criteria

1. THE PII_Scanner SHALL detect Unix-style absolute paths starting with a forward slash followed by at least one directory or file component (e.g., `/home/user/project/src/main.ts`, `/var/log/app.log`).
2. THE PII_Scanner SHALL detect Unix-style home-relative paths starting with a tilde followed by a forward slash and at least one path component (e.g., `~/Documents/secret.pdf`, `~/projects/app`).
3. THE PII_Scanner SHALL detect Windows-style absolute paths starting with a drive letter followed by a colon and backslash (e.g., `C:\Users\john\Documents\file.txt`, `D:\projects\app`).
4. THE PII_Scanner SHALL detect Windows-style UNC paths starting with two backslashes followed by a server name and at least one share or folder component (e.g., `\\server\share\folder`, `\\192.168.1.1\data`).
5. WHEN a file system path appears within common terminal output formats such as error stack traces, build output, or directory listings, THE PII_Scanner SHALL detect the path.
6. THE PII_Scanner SHALL not flag single forward slashes, lone tildes, or common URL patterns (e.g., `https://example.com/path`) as file system paths.
7. WHEN a file system path is detected, THE Redaction_Engine SHALL replace the path with the `[FILE_PATH_REDACTED]` placeholder.
8. THE PII_Scanner SHALL detect file system paths that contain spaces, dots, hyphens, and underscores as valid path characters.
