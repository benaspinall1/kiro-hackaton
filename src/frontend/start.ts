/**
 * Entry point to start the Chat Frontend PII Panel HTTP server.
 *
 * Usage: npx tsx src/frontend/start.ts
 */

import { createServer } from './server';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = createServer();

server.listen(PORT, () => {
  console.log(`PII Redaction Filter API running at http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST http://localhost:${PORT}/api/scan    — Scan text for PII`);
  console.log(`  POST http://localhost:${PORT}/api/redact  — Redact PII from text`);
  console.log(`  POST http://localhost:${PORT}/api/chat    — Send chat message through pipeline`);
});
