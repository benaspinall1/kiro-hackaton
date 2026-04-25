# Implementation Plan: PII Redaction Filter

## Overview

Implement a TypeScript/Node.js middleware pipeline that scans chat messages (text and PDF attachments) for PII, redacts or blocks based on configurable privacy rules, notifies users, and generates audit reports. The implementation proceeds component-by-component, wiring everything together at the end through the Chat_Proxy orchestrator.

## Tasks

- [x] 1. Set up project structure, shared types, and dependencies
  - Initialize the TypeScript project with `tsconfig.json`, `package.json`
  - Install dependencies: `pdf-parse`, `fast-check` (dev), a test runner (e.g., `vitest`)
  - Create `src/types.ts` with all shared interfaces and types: `PIIType` (including `FILE_PATH`), `PIIEntity`, `RedactionAction`, `RedactionResult`, `GateResult`, `PrivacyRuleConfig`, `PrivacyAction`, `PIINotification`, `PDFExtractionResult`, `ChatRequest`, `ChatResponse`, `RedactionReport`, `ReportAction`, and the `PLACEHOLDER_MAP` constant (including `FILE_PATH: '[FILE_PATH_REDACTED]'`)
  - Create custom error classes: `InvalidEntityError`, `PDFCorruptedError`, `PDFPasswordProtectedError`, `PDFPageLimitError`, `PDFTimeoutError`
  - _Requirements: 2.2, 7.1, 9.6, 10.7_

- [-] 2. Implement PII_Scanner
  - [x] 2.1 Implement the PII_Scanner module
    - Create `src/pii-scanner.ts` implementing the `PIIScanner` interface
    - Implement regex patterns for each PII type: email (RFC 5322 simplified), US phone numbers ((XXX) XXX-XXXX, XXX-XXX-XXXX, +1XXXXXXXXXX), SSN (XXX-XX-XXXX and XXXXXXXXX), credit card (13-19 digits with optional spaces/dashes), addresses, and file system paths
    - Implement file path regex patterns for: Unix absolute paths (`/dir/file`), Unix home-relative paths (`~/dir/file`), Windows drive paths (`C:\dir\file`), and Windows UNC paths (`\\server\share\folder`)
    - File path patterns must support path characters including letters, digits, dots, hyphens, underscores, and spaces
    - File path patterns must exclude single forward slashes, lone tildes, and URL patterns (preceded by `://`)
    - Ensure the scanner skips matches that overlap with `[*_REDACTED]` placeholder tokens (including `[FILE_PATH_REDACTED]`)
    - Return entities sorted by `startIndex`
    - Handle internal regex errors by logging and returning an empty entity list
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 2.2 Write property test: PII Detection Accuracy
    - **Property 1: PII Detection Accuracy**
    - Generate random valid PII values per type (including file paths of all four styles) embedded in random surrounding text, assert scanner detects them with correct type and positions
    - **Validates: Requirements 1.2, 1.3, 8.1, 8.2, 8.3, 8.4, 10.1, 10.2, 10.3, 10.4**

  - [x] 2.3 Write property test: No False Positives on Clean Text
    - **Property 2: No False Positives on Clean Text**
    - Generate random alphanumeric/word strings that avoid PII patterns, assert scanner returns empty list
    - **Validates: Requirements 1.4**

  - [x] 2.4 Write property test: File System Path Detection Accuracy
    - **Property 13: File System Path Detection Accuracy**
    - Generate random valid file paths of all four styles (Unix absolute, Unix home-relative, Windows drive, Windows UNC) with valid path characters (letters, digits, dots, hyphens, underscores, spaces) embedded in arbitrary surrounding text, assert scanner detects them with type FILE_PATH and correct positions
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.8**

  - [x] 2.5 Write property test: No False Positives on Non-Path Patterns
    - **Property 14: No False Positives on Non-Path Patterns**
    - Generate single forward slashes, lone tildes, URL patterns (https://example.com/path), and plain words, assert scanner returns no FILE_PATH entities
    - **Validates: Requirements 10.6**

  - [x] 2.6 Write property test: File Path Redaction Round-Trip
    - **Property 15: File Path Redaction Round-Trip**
    - Generate text with file paths of all styles, scan → redact → scan again, assert zero FILE_PATH entities on second scan
    - **Validates: Requirements 10.7, 2.5**

- [x] 3. Implement Redaction_Engine
  - [x] 3.1 Implement the Redaction_Engine module
    - Create `src/redaction-engine.ts` implementing the `RedactionEngine` interface
    - Replace each detected PII entity with its type-specific placeholder from `PLACEHOLDER_MAP`
    - Process entities in reverse `startIndex` order to preserve positions during replacement
    - Throw `InvalidEntityError` if entity positions are out of bounds
    - Preserve all non-PII text unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Write property test: Correct Redaction with Type-Specific Placeholders
    - **Property 3: Correct Redaction with Type-Specific Placeholders**
    - Generate text with 1-5 embedded PII entities of mixed types, verify placeholder counts match entity counts per type
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [x] 3.3 Write property test: Non-PII Text Preservation
    - **Property 4: Non-PII Text Preservation**
    - Generate text with known PII positions, verify all non-PII segments remain unchanged after redaction
    - **Validates: Requirements 2.3**

  - [x] 3.4 Write property test: Redaction Round-Trip
    - **Property 5: Redaction Round-Trip**
    - Generate arbitrary text with PII, scan → redact → scan again, assert zero entities on second scan
    - **Validates: Requirements 2.5, 8.5**

- [x] 4. Implement Ethics_Logic_Gate
  - [x] 4.1 Implement the Ethics_Logic_Gate module
    - Create `src/ethics-logic-gate.ts` implementing the `EthicsLogicGate` interface
    - If any entity matches a "block" rule, return `allowed: false` with the blocked types and a reason
    - If all entities match "redact" rules (or type is absent from config, defaulting to "redact"), return `allowed: true`
    - On internal error, default to blocking and log the error
    - Validate privacy rule config at startup: reject configs referencing unsupported PII types
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.3_

  - [x] 4.2 Write property test: Block Rule Enforcement
    - **Property 6: Block Rule Enforcement**
    - Generate random PII entity lists + rule configs with ≥1 "block" rule, verify gate returns `allowed: false` with correct `blockedTypes`
    - **Validates: Requirements 3.2, 3.3**

  - [x] 4.3 Write property test: Redact-Only Rules Allow Message
    - **Property 7: Redact-Only Rules Allow Message**
    - Generate random PII entity lists + rule configs with all "redact" or empty config, verify gate returns `allowed: true`
    - **Validates: Requirements 3.4, 3.5, 7.2**

  - [x] 4.4 Write property test: Privacy Rule Configuration Validation
    - **Property 12: Privacy Rule Configuration Validation**
    - Generate configs with valid and invalid PII type keys, verify accept/reject behavior
    - **Validates: Requirements 7.1, 7.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Notification_Service
  - [x] 6.1 Implement the Notification_Service module
    - Create `src/notification-service.ts` implementing the `NotificationService` interface
    - `createRedactionNotification`: produce a notification of type `'redaction'` with per-type counts from the redaction actions list
    - `createBlockNotification`: produce a notification of type `'block'` listing the blocked PII types and reason
    - Return `null` when no PII entities are detected (no notification generated)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Write property test: Redaction Notification Correctness
    - **Property 8: Redaction Notification Correctness**
    - Generate random non-empty RedactionAction lists, verify notification type is `'redaction'` and `details` counts are correct
    - **Validates: Requirements 4.1**

  - [x] 6.3 Write property test: Block Notification Correctness
    - **Property 9: Block Notification Correctness**
    - Generate random GateResult with `allowed: false`, verify notification type is `'block'` and lists exactly the blocked types
    - **Validates: Requirements 4.2**

  - [x] 6.4 Write property test: No Notification for Clean Messages
    - **Property 10: No Notification for Clean Messages**
    - Generate non-PII text, process through pipeline, verify null notification
    - **Validates: Requirements 4.4**

- [x] 7. Implement PDF_Text_Extractor
  - [x] 7.1 Implement the PDF_Text_Extractor module
    - Create `src/pdf-text-extractor.ts` implementing the `PDFTextExtractor` interface using `pdf-parse`
    - Support up to 50 pages; throw `PDFPageLimitError` for documents exceeding this limit
    - Return `extractable: false` with empty text for image-only PDFs
    - Throw `PDFCorruptedError` for corrupted PDFs and `PDFPasswordProtectedError` for password-protected PDFs
    - Wrap extraction in a 3-second timeout; throw `PDFTimeoutError` if exceeded
    - _Requirements: 9.1, 9.2, 9.3, 9.6, 9.7_

  - [x] 7.2 Write unit tests for PDF_Text_Extractor
    - Test corrupted PDF → `PDFCorruptedError`
    - Test password-protected PDF → `PDFPasswordProtectedError`
    - Test image-only PDF → `extractable: false`, empty text
    - Test PDF exceeding 50 pages → `PDFPageLimitError`
    - _Requirements: 9.2, 9.3, 9.6_

- [x] 8. Implement Chat_Proxy and Redaction_Report generation
  - [x] 8.1 Implement the Chat_Proxy module
    - Create `src/chat-proxy.ts` implementing the `ChatProxy` interface
    - Orchestrate the pipeline: PDF extraction (if PDF attached) → PII scan → redaction → Ethics_Logic_Gate → forward or block
    - When allowed, forward redacted message to downstream chat service and return response
    - When blocked, return block notification without contacting downstream service
    - On downstream service unavailability, return error response without retry
    - On any unhandled pipeline component failure, block the message (fail-safe) and return error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.2 Implement Redaction_Report generation
    - Generate SHA-256 hash of the original message (never store raw text)
    - Populate `detectedCounts` with per-type entity counts
    - Populate `actions` with the action taken for each entity
    - Include ISO 8601 timestamp
    - When no PII detected, generate report with zero counts and `'none'` action
    - Set `pdfStatus` appropriately: `'processed'`, `'unprocessable'`, `'error'`, or `'none'`
    - Combine text prompt and PDF scan results into a single report when both are present
    - _Requirements: 6.1, 6.2, 6.3, 9.3, 9.8_

  - [x] 8.3 Write property test: Redaction Report Structure
    - **Property 11: Redaction Report Structure**
    - Generate random messages, process through pipeline, verify `messageHash` is valid SHA-256 hex, `detectedCounts` match actual counts, `actions` match actions taken, and `timestamp` is valid ISO 8601
    - **Validates: Requirements 6.1**

  - [x] 8.4 Write unit tests for Chat_Proxy error handling
    - Test Ethics_Logic_Gate internal error → message blocked
    - Test downstream service unavailable → error response, no retry
    - Test no PII detected → report with zero counts and `'none'` action
    - _Requirements: 3.6, 5.5, 6.3_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Integration wiring and end-to-end tests
  - [x] 10.1 Wire all components together and create entry point
    - Create `src/index.ts` that exports the Chat_Proxy with all dependencies wired together
    - Ensure the full pipeline is functional: request → PDF extraction → scan → redact → gate → notify → respond
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.4, 9.5_

  - [~] 10.2 Write integration tests
    - Test pipeline ordering: Scanner → Redaction_Engine → Ethics_Logic_Gate
    - Test PDF extraction runs before scanning when PDF is attached
    - Test blocked message does not contact downstream service
    - Test allowed message forwards redacted text and returns response + report
    - Test combined text + PDF scanning produces single merged report
    - Test performance: Scanner processes 10,000 chars in < 500ms
    - Test performance: PDF extractor processes 50 pages in < 3 seconds
    - _Requirements: 1.5, 5.2, 5.3, 5.4, 9.7, 9.8_

- [~] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases
- All code is TypeScript targeting Node.js
