# Tech Stack

## Language & Runtime

- TypeScript (strict mode) targeting ES2020
- Node.js with CommonJS modules

## Dependencies

- `pdf-parse` — PDF text extraction

## Dev Dependencies

- `vitest` — test runner (globals enabled)
- `fast-check` — property-based testing
- `typescript` — compiler

## Common Commands

| Action | Command |
|---|---|
| Build | `npm run build` |
| Run tests (single run) | `npm test` |
| Run tests (watch mode) | `npm run test:watch` |

## TypeScript Configuration

- `strict: true` — all strict checks enabled
- `declaration: true` with `declarationMap` and `sourceMap`
- Source in `src/`, output in `dist/`
- Test files (`**/*.test.ts`) excluded from compilation

## Testing Conventions

- Unit tests: `*.test.ts` — standard describe/it/expect with vitest
- Property tests: `*.property.test.ts` — use `fast-check` with `fc.assert` and `fc.property`
- Property tests typically run with `{ numRuns: 100 }`
- Tests use vitest globals (`describe`, `it`, `expect` imported from `vitest`)
