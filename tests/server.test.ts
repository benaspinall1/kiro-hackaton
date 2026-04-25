import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import { createServer } from '../src/frontend/server';

let server: http.Server;
let baseUrl: string;

/**
 * Helper to make HTTP requests to the test server.
 */
function request(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqBody = options.body !== undefined ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      url,
      {
        method: options.method ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(reqBody ? { 'Content-Length': Buffer.byteLength(reqBody).toString() } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let data: unknown;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode ?? 0, data });
        });
      },
    );
    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createServer();
      server.listen(0, () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

describe('POST /api/scan', () => {
  it('returns PIIEntity array for text with PII', async () => {
    const res = await request('/api/scan', {
      body: { text: 'Email me at test@example.com' },
    });
    expect(res.status).toBe(200);
    const entities = res.data as Array<{ type: string; matchedText: string }>;
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBeGreaterThan(0);
    expect(entities[0].type).toBe('EMAIL');
    expect(entities[0].matchedText).toBe('test@example.com');
  });

  it('returns empty array for clean text', async () => {
    const res = await request('/api/scan', {
      body: { text: 'Hello world' },
    });
    expect(res.status).toBe(200);
    expect(res.data).toEqual([]);
  });

  it('returns 400 for missing text field', async () => {
    const res = await request('/api/scan', { body: {} });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/redact', () => {
  it('returns RedactionResult with correct redacted text', async () => {
    const text = 'Email me at test@example.com';
    const entities = [
      {
        type: 'EMAIL',
        matchedText: 'test@example.com',
        startIndex: 12,
        endIndex: 28,
      },
    ];
    const res = await request('/api/redact', { body: { text, entities } });
    expect(res.status).toBe(200);
    const result = res.data as { redactedText: string; redactions: unknown[] };
    expect(result.redactedText).toBe('Email me at [EMAIL_REDACTED]');
    expect(result.redactions.length).toBe(1);
  });

  it('returns 400 for missing entities field', async () => {
    const res = await request('/api/redact', {
      body: { text: 'hello' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing text field', async () => {
    const res = await request('/api/redact', {
      body: { entities: [] },
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/chat', () => {
  it('returns ChatResponse for valid request', async () => {
    const res = await request('/api/chat', {
      body: { prompt: 'Hello there' },
    });
    expect(res.status).toBe(200);
    const data = res.data as {
      reply: string | null;
      redactionReport: unknown;
      blocked: boolean;
    };
    expect(data.reply).toBe('Hello there');
    expect(data.blocked).toBe(false);
    expect(data.redactionReport).toBeDefined();
  });

  it('returns 400 for missing prompt field', async () => {
    const res = await request('/api/chat', { body: {} });
    expect(res.status).toBe(400);
  });
});

describe('Error handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request('/api/unknown', { body: {} });
    expect(res.status).toBe(404);
  });

  it('returns 405 for non-POST methods on API routes', async () => {
    const res = await request('/api/scan', { method: 'GET' });
    expect(res.status).toBe(405);
  });

  it('returns 400 for invalid JSON body', async () => {
    return new Promise<void>((resolve, reject) => {
      const url = new URL('/api/scan', baseUrl);
      const req = http.request(
        url,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            expect(res.statusCode).toBe(400);
            resolve();
          });
        },
      );
      req.on('error', reject);
      req.write('not valid json{{{');
      req.end();
    });
  });

  it('returns 500 for internal errors', async () => {
    // Send entities with out-of-bounds positions to trigger InvalidEntityError
    const res = await request('/api/redact', {
      body: {
        text: 'hi',
        entities: [
          { type: 'EMAIL', matchedText: 'x', startIndex: 0, endIndex: 999 },
        ],
      },
    });
    expect(res.status).toBe(500);
  });

  it('all responses have Content-Type application/json', async () => {
    return new Promise<void>((resolve, reject) => {
      const url = new URL('/api/scan', baseUrl);
      const body = JSON.stringify({ text: 'hello' });
      const req = http.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
          },
        },
        (res) => {
          expect(res.headers['content-type']).toBe('application/json');
          res.resume();
          res.on('end', () => resolve());
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  });
});
