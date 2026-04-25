/**
 * API service layer for the Chat Frontend PII Panel.
 *
 * Wraps fetch calls to the backend REST endpoints for PII scanning,
 * redaction, and chat message processing.
 *
 * Validates: Requirements 9.1, 9.2, 9.3
 */

import type { PIIEntity, RedactionResult, ChatRequest, ChatResponse } from './types';

/**
 * Custom error class for non-200 API responses.
 */
export class APIError extends Error {
  public readonly status: number;
  public readonly statusText: string;

  constructor(status: number, statusText: string, message?: string) {
    super(message ?? `API request failed: ${status} ${statusText}`);
    this.name = 'APIError';
    this.status = status;
    this.statusText = statusText;
  }
}

/**
 * Scans text for PII entities via the backend scanner API.
 *
 * @param text - The text to scan for PII
 * @returns Array of detected PII entities
 * @throws {APIError} on non-200 response
 * Validates: Requirement 9.1
 */
export async function scanForPII(text: string): Promise<PIIEntity[]> {
  const response = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new APIError(response.status, response.statusText);
  }

  return response.json() as Promise<PIIEntity[]>;
}

/**
 * Redacts specified PII entities from text via the backend redaction API.
 *
 * @param text - The original text containing PII
 * @param entities - The PII entities to redact
 * @returns The redaction result with redacted text and action details
 * @throws {APIError} on non-200 response
 * Validates: Requirement 9.2
 */
export async function redactText(text: string, entities: PIIEntity[]): Promise<RedactionResult> {
  const response = await fetch('/api/redact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, entities }),
  });

  if (!response.ok) {
    throw new APIError(response.status, response.statusText);
  }

  return response.json() as Promise<RedactionResult>;
}

/**
 * Sends a chat message through the backend chat proxy API.
 *
 * @param request - The chat request containing prompt and optional PDF attachment
 * @returns The chat response with reply, redaction report, and notification
 * @throws {APIError} on non-200 response
 * Validates: Requirement 9.3
 */
export async function sendMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new APIError(response.status, response.statusText);
  }

  return response.json() as Promise<ChatResponse>;
}
