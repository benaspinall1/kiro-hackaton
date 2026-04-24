# Product Overview

PII Redaction Filter is a TypeScript/Node.js middleware that intercepts chat messages and scans them for Personally Identifiable Information (PII) before they reach a downstream chat service. Detected PII is either redacted with type-specific placeholders or blocked entirely, based on configurable privacy rules.

## Supported PII Types

- EMAIL — RFC 5322 simplified
- PHONE — US formats: `(XXX) XXX-XXXX`, `XXX-XXX-XXXX`, `+1XXXXXXXXXX`
- SSN — `XXX-XX-XXXX` or 9 consecutive digits
- CREDIT_CARD — 13–19 digits, optional spaces/dashes
- ADDRESS — US street addresses with optional city/state/zip
- FILE_PATH — Unix absolute, home-relative (`~/`), Windows drive (`C:\`), UNC (`\\server\share`)

## Pipeline

```
ChatRequest → PDF Extraction (optional) → PII Scan → Redaction → Ethics Logic Gate → Downstream Service
```

- Messages containing "block"-configured PII types are rejected entirely and never forwarded.
- Messages with "redact"-configured PII types have entities replaced with placeholders like `[EMAIL_REDACTED]`.
- Every request produces a `RedactionReport` audit trail with SHA-256 message hash, detected counts, and actions taken.
- PDF attachments are extracted via `pdf-parse` with a 50-page limit and 3-second timeout.
