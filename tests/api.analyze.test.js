import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, {
  MAX_INPUT_CHARS,
  RATE_LIMIT_MAX,
  resetRateLimiter
} from '../api/analyze.js';

function createMockRes() {
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: null,
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('api/analyze serverless proxy', () => {
  const originalEnv = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetRateLimiter();
    process.env.GEMINI_API_KEY = 'test-secret-key';
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('rejects non-POST requests with 405', async () => {
    const res = createMockRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
  });

  it('validates payload and rejects oversized input with 400', async () => {
    const res = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '1.2.3.4' },
        body: { corridorSummary: 'x'.repeat(MAX_INPUT_CHARS + 5) }
      },
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('enforces per-IP rate limiting with 429', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '• Advisory OK' }] } }]
      })
    });

    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      const res = createMockRes();
      await handler(
        {
          method: 'POST',
          headers: { 'x-forwarded-for': '9.9.9.9' },
          body: { corridorSummary: 'MG Road NS:20 EW:10' }
        },
        res
      );
      expect(res.statusCode).toBe(200);
    }

    const blockedRes = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '9.9.9.9' },
        body: { corridorSummary: 'MG Road NS:20 EW:10' }
      },
      blockedRes
    );
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedRes.headers['Retry-After']).toBeDefined();
  });

  it('returns 503 with fallback flag when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '2.2.2.2' },
        body: { corridorSummary: 'MG Road NS:20 EW:10' }
      },
      res
    );
    expect(res.statusCode).toBe(503);
    expect(res.body.fallback).toBe(true);
  });

  it('returns 504 when upstream Gemini request times out (AbortError)', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    globalThis.fetch = vi.fn().mockRejectedValue(abortErr);

    const res = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '3.3.3.3' },
        body: { corridorSummary: 'MG Road NS:20 EW:10' }
      },
      res
    );
    expect(res.statusCode).toBe(504);
    expect(res.body.fallback).toBe(true);
  });

  it('rejects malformed JSON strings, non-object bodies, and non-string notes with 400', async () => {
    const badJsonRes = createMockRes();
    await handler(
      { method: 'POST', headers: { 'x-forwarded-for': ['4.4.4.4'] }, body: '{bad json' },
      badJsonRes
    );
    expect(badJsonRes.statusCode).toBe(400);

    const arrayBodyRes = createMockRes();
    await handler(
      { method: 'POST', headers: {}, body: ['not-an-object'] },
      arrayBodyRes
    );
    expect(arrayBodyRes.statusCode).toBe(400);

    const badNotesRes = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: {},
        body: { corridorSummary: 'MG Road NS:10', incidentNotes: 123 }
      },
      badNotesRes
    );
    expect(badNotesRes.statusCode).toBe(400);
  });

  it('returns 502 when upstream returns non-OK or empty candidate text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const errRes = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '5.5.5.5' },
        body: { corridorSummary: 'MG Road NS:20 EW:10' }
      },
      errRes
    );
    expect(errRes.statusCode).toBe(502);
    expect(errRes.body.fallback).toBe(true);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '   ' }] } }] })
    });
    const emptyRes = createMockRes();
    await handler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '6.6.6.6' },
        body: { corridorSummary: 'MG Road NS:20 EW:10' }
      },
      emptyRes
    );
    expect(emptyRes.statusCode).toBe(502);
    expect(emptyRes.body.fallback).toBe(true);
  });
});
