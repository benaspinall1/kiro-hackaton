# Project Structure

```
src/
├── types.ts                        # Shared types, interfaces, and constants (PIIType, PIIEntity, PLACEHOLDER_MAP, etc.)
├── errors.ts                       # Custom error classes (InvalidEntityError, PDF-related errors)
├── pii-scanner.ts                  # Regex-based PII detection — exports `scan(text): PIIEntity[]`
├── redaction-engine.ts             # Replaces PII entities with placeholders — exports `redact(text, entities): RedactionResult`
├── ethics-logic-gate.ts            # Evaluates privacy rules (block/redact) — exports `evaluate()` and `validateConfig()`
├── notification-service.ts         # Builds user-facing notifications — exports `createRedactionNotification()` and `createBlockNotification()`
├── pdf-text-extractor.ts           # PDF text extraction via pdf-parse — exports `PDFTextExtractorImpl` class
├── chat-proxy.ts                   # Pipeline orchestrator — exports `ChatProxyImpl` class
├── *.test.ts                       # Unit tests (vitest)
└── *.property.test.ts              # Property-based tests (fast-check)
```

## Architecture

Each component is a single file with pure functions or a single class. The `ChatProxyImpl` orchestrates the pipeline by calling the other modules in sequence.

## Conventions

- One module per concern, co-located with its tests
- Shared types live in `types.ts`; custom errors in `errors.ts`
- Functions are exported directly (not wrapped in classes) except for stateful components (`ChatProxyImpl`, `PDFTextExtractorImpl`)
- Test files sit alongside source files in `src/`, not in a separate directory
- Property test files use the `.property.test.ts` suffix to distinguish them from unit tests
