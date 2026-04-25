import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanForPII, redactText, sendMessage, APIError } from '../src/frontend/api-service';
import type { PIIEntity, ChatRequest, ChatResponse, RedactionResult } from '../src/frontend/types';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
  } as Response;
}

function errorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({ error: statusText }),
  } as Response;
}

describe('APIError', () => {
  it('stores status and statusText', () => {
    const err = new APIError(404, 'Not Found');
    expect(err.name).toBe('APIError');
    expect(err.status).toBe(404);
    expect(err.statusText).toBe('Not Found');
    expect(err.message).toBe('API request failed: 404 Not Found');
  });

  it('accepts a custom message', () => {
    const err = new APIError(500, 'Internal Server Error', 'Something broke');
    expect(err.message).toBe('Something broke');
    expect(err.status).toBe(500);
  });
});

describe('scanForPII', () => {
  it('returns PIIEntity[] on success', async () => {
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'test@example.com', startIndex: 0, endIndex: 16 },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(entities));

    const result = await scanForPII('Contact test@example.com');

    expect(mockFetch).toHaveBeenCalledWith('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Contact test@example.com' }),
    });
    expect(result).toEqual(entities);
  });

  it('returns empty array when no PII detected', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const result = await scanForPII('Hello world');
    expect(result).toEqual([]);
  });

  it('throws APIError on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));

    await expect(scanForPII('test')).rejects.toThrow(APIError);
    await mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));
    try {
      await scanForPII('test');
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).status).toBe(500);
    }
  });
});

describe('redactText', () => {
  it('returns RedactionResult on success', async () => {
    const redactionResult: RedactionResult = {
      redactedText: 'Contact [EMAIL_REDACTED]',
      redactions: [
        {
          entityType: 'EMAIL',
          originalText: 'test@example.com',
          placeholder: '[EMAIL_REDACTED]',
          startIndex: 8,
          endIndex: 24,
        },
      ],
    };
    const entities: PIIEntity[] = [
      { type: 'EMAIL', matchedText: 'test@example.com', startIndex: 8, endIndex: 24 },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(redactionResult));

    const result = await redactText('Contact test@example.com', entities);

    expect(mockFetch).toHaveBeenCalledWith('/api/redact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Contact test@example.com', entities }),
    });
    expect(result).toEqual(redactionResult);
  });

  it('throws APIError on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400, 'Bad Request'));

    await expect(redactText('text', [])).rejects.toThrow(APIError);
    await mockFetch.mockResolvedValueOnce(errorResponse(400, 'Bad Request'));
    try {
      await redactText('text', []);
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).status).toBe(400);
    }
  });
});

describe('sendMessage', () => {
  it('returns ChatResponse on success', async () => {
    const chatResponse: ChatResponse = {
      reply: 'Hello!',
      redactionReport: {
        messageHash: 'abc123',
        detectedCounts: { EMAIL: 0, PHONE: 0, SSN: 0, CREDIT_CARD: 0, ADDRESS: 0, FILE_PATH: 0 },
        actions: [],
        timestamp: new Date().toISOString(),
      },
      notification: null,
      blocked: false,
    };
    const request: ChatRequest = { prompt: 'Hi there' };
    mockFetch.mockResolvedValueOnce(jsonResponse(chatResponse));

    const result = await sendMessage(request);

    expect(mockFetch).toHaveBeenCalledWith('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    expect(result).toEqual(chatResponse);
  });

  it('throws APIError on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(503, 'Service Unavailable'));

    await expect(sendMessage({ prompt: 'test' })).rejects.toThrow(APIError);
    await mockFetch.mockResolvedValueOnce(errorResponse(503, 'Service Unavailable'));
    try {
      await sendMessage({ prompt: 'test' });
    } catch (e) {
      expect(e).toBeInstanceOf(APIError);
      expect((e as APIError).status).toBe(503);
    }
  });

  it('throws on network error (fetch rejection)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(sendMessage({ prompt: 'test' })).rejects.toThrow(TypeError);
  });
});
