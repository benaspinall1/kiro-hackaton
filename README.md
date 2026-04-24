# PII Redaction Filter

A TypeScript/Node.js middleware that intercepts chat messages and scans them for Personally Identifiable Information (PII) before they reach a downstream chat service. Detected PII is redacted or blocked based on configurable privacy rules.

## Supported PII Types

- Email addresses (RFC 5322 simplified)
- US phone numbers — `(XXX) XXX-XXXX`, `XXX-XXX-XXXX`, `+1XXXXXXXXXX`
- Social Security Numbers — `XXX-XX-XXXX`, `XXXXXXXXX`
- Credit card numbers — 13–19 digits with optional spaces/dashes
- Physical mailing addresses
- File system paths — Unix absolute, home-relative (`~/`), Windows drive (`C:\`), and UNC (`\\server\share`)

## Architecture

The system is a synchronous pipeline orchestrated by a Chat Proxy:

```
Request → PDF Extraction (if attached) → PII Scan → Redaction → Ethics Logic Gate → Downstream Service
```

Components:

| Component | Responsibility |
|---|---|
| PII_Scanner | Regex-based detection of PII entities in text |
| Redaction_Engine | Replaces PII with type-specific placeholders (e.g. `[EMAIL_REDACTED]`) |
| Ethics_Logic_Gate | Evaluates privacy rules — blocks or allows messages |
| Notification_Service | Builds user-facing notifications about actions taken |
| PDF_Text_Extractor | Extracts text from PDF attachments (via `pdf-parse`) |
| Chat_Proxy | Orchestrates the pipeline and generates audit reports |

## Getting Started

```bash
npm install
npm run build
```

## Running Tests

```bash
npm test
```

Tests use [Vitest](https://vitest.dev/) with [fast-check](https://github.com/dubzzz/fast-check) for property-based testing.

## Privacy Rule Configuration

Map each PII type to `"block"` or `"redact"`. Types not listed default to `"redact"`.

```typescript
const rules: PrivacyRuleConfig = {
  rules: {
    SSN: 'block',
    CREDIT_CARD: 'block',
    EMAIL: 'redact',
    FILE_PATH: 'redact',
  },
};
```

When a blocked PII type is detected, the entire message is rejected and never forwarded downstream.
