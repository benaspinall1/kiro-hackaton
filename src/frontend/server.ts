/**
 * HTTP server for the Chat Frontend PII Panel REST API.
 *
 * Uses Node.js built-in `http` module — no Express dependency.
 * Exposes three POST endpoints wrapping existing backend functions:
 *   POST /api/scan   — PII scanning
 *   POST /api/redact — PII redaction
 *   POST /api/chat   — Chat proxy pipeline
 *
 * Validates: Requirements 9.1, 9.2, 9.3
 */

import * as http from 'node:http';
import { scan } from '../pii-scanner';
import { redact } from '../redaction-engine';
import { ChatProxyImpl } from '../chat-proxy';
import type { ChatRequest, PrivacyRuleConfig } from '../types';

/**
 * Read the full request body as a string.
 */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Send a JSON response with the given status code.
 */
function sendJSON(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(body);
}

/**
 * Send a JSON error response.
 */
function sendError(res: http.ServerResponse, statusCode: number, message: string): void {
  sendJSON(res, statusCode, { error: message });
}

/**
 * Parse JSON body, returning the parsed object or null on failure.
 */
function parseJSON(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Default echo downstream service for the chat endpoint. */
const echoDownstream = async (message: string): Promise<string> => message;

/** Default privacy rules (redact all types). */
const defaultRules: PrivacyRuleConfig = { rules: {} };

/**
 * Handle POST /api/scan
 * Accepts { text: string }, returns PIIEntity[].
 */
async function handleScan(body: unknown, res: http.ServerResponse): Promise<void> {
  const obj = body as Record<string, unknown>;
  if (typeof obj.text !== 'string') {
    sendError(res, 400, 'Missing or invalid "text" field');
    return;
  }
  const entities = scan(obj.text);
  sendJSON(res, 200, entities);
}

/**
 * Handle POST /api/redact
 * Accepts { text: string, entities: PIIEntity[] }, returns RedactionResult.
 */
async function handleRedact(body: unknown, res: http.ServerResponse): Promise<void> {
  const obj = body as Record<string, unknown>;
  if (typeof obj.text !== 'string') {
    sendError(res, 400, 'Missing or invalid "text" field');
    return;
  }
  if (!Array.isArray(obj.entities)) {
    sendError(res, 400, 'Missing or invalid "entities" field');
    return;
  }
  const result = redact(obj.text, obj.entities);
  sendJSON(res, 200, result);
}

/**
 * Handle POST /api/chat
 * Accepts ChatRequest body, returns ChatResponse.
 */
async function handleChat(body: unknown, res: http.ServerResponse): Promise<void> {
  const obj = body as Record<string, unknown>;
  if (typeof obj.prompt !== 'string') {
    sendError(res, 400, 'Missing or invalid "prompt" field');
    return;
  }
  const request: ChatRequest = { prompt: obj.prompt };
  if (obj.pdfAttachment !== undefined) {
    request.pdfAttachment = obj.pdfAttachment as Buffer;
  }
  const proxy = new ChatProxyImpl(echoDownstream);
  const response = await proxy.processRequest(request, defaultRules);
  sendJSON(res, 200, response);
}

/** Known API routes and their handlers. */
const ROUTES: Record<string, (body: unknown, res: http.ServerResponse) => Promise<void>> = {
  '/api/scan': handleScan,
  '/api/redact': handleRedact,
  '/api/chat': handleChat,
};

/**
 * Main request handler. Exported for testability.
 */
export async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = req.url ?? '';
  const method = (req.method ?? '').toUpperCase();

  // Check if this is a known API route
  const handler = ROUTES[url];

  if (!handler) {
    sendError(res, 404, `Not found: ${url}`);
    return;
  }

  if (method !== 'POST') {
    sendError(res, 405, `Method ${method} not allowed. Use POST.`);
    return;
  }

  try {
    const raw = await readBody(req);
    const body = parseJSON(raw);
    if (body === null) {
      sendError(res, 400, 'Invalid JSON body');
      return;
    }
    await handler(body, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    sendError(res, 500, message);
  }
}

/**
 * Create an HTTP server (not auto-listening) for testability.
 */
export function createServer(): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      if (!res.headersSent) {
        sendError(res, 500, 'Internal server error');
      }
    });
  });
}
