/**
 * @fileoverview Vercel Serverless Proxy for Gemini Cloud AI Traffic Advisory.
 * Enforces POST-only access, per-IP rate limiting, strict input validation,
 * AbortController timeout, and zero secret/stack-trace leakage.
 */

export const MAX_INPUT_CHARS = 1500;
export const RATE_LIMIT_MAX = 30;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const TIMEOUT_MS = 8_000;
const MAX_TRACKED_IPS = 1000;

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimitStore = new Map();

/**
 * Clears the in-memory rate-limit store (used in unit tests).
 */
export function resetRateLimiter() {
  rateLimitStore.clear();
}

/**
 * Extracts a normalized client IP from request headers or socket.
 * @param {import('http').IncomingMessage & { headers?: Record<string, string | string[]> }} req
 * @returns {string}
 */
export function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || 'unknown';
}

/**
 * Checks and updates per-IP sliding/fixed window rate limit.
 * @param {string} ip
 * @param {number} [now=Date.now()]
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
export function checkRateLimit(ip, now = Date.now()) {
  if (rateLimitStore.size >= MAX_TRACKED_IPS) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now >= entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
    if (rateLimitStore.size >= MAX_TRACKED_IPS) {
      const oldestKey = rateLimitStore.keys().next().value;
      if (oldestKey !== undefined) rateLimitStore.delete(oldestKey);
    }
  }

  const current = rateLimitStore.get(ip);
  if (!current || now >= current.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      retryAfterSec: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    };
  }

  if (current.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - current.count,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}

/**
 * Strips ASCII control characters while preserving normal whitespace.
 * @param {string} text
 * @returns {string}
 */
function stripControlChars(text) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

/**
 * Validates and normalizes the incoming request payload.
 * @param {unknown} body
 * @returns {{ valid: true, data: { corridorSummary: string, incidentNotes: string, activeScenario: string } } | { valid: false, error: string }}
 */
export function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const { corridorSummary, incidentNotes = '', activeScenario = 'custom' } = body;

  if (typeof corridorSummary !== 'string' || !corridorSummary.trim()) {
    return { valid: false, error: 'corridorSummary is required and must be a non-empty string.' };
  }

  if (typeof incidentNotes !== 'string' || typeof activeScenario !== 'string') {
    return { valid: false, error: 'incidentNotes and activeScenario must be strings.' };
  }

  const cleanSummary = stripControlChars(corridorSummary);
  const cleanNotes = stripControlChars(incidentNotes);
  const cleanScenario = stripControlChars(activeScenario).slice(0, 80) || 'custom';

  if (cleanSummary.length + cleanNotes.length > MAX_INPUT_CHARS) {
    return {
      valid: false,
      error: `Combined input exceeds maximum length of ${MAX_INPUT_CHARS} characters.`
    };
  }

  return {
    valid: true,
    data: {
      corridorSummary: cleanSummary,
      incidentNotes: cleanNotes,
      activeScenario: cleanScenario
    }
  };
}

/**
 * Builds the system-constrained prompt for Gemini corridor forecasting.
 * @param {{ corridorSummary: string, incidentNotes: string, activeScenario: string }} data
 * @returns {string}
 */
function buildPrompt(data) {
  return [
    'You are an urban traffic operations advisor for a Smart Traffic Management System.',
    'Provide a concise, actionable 3-bullet corridor advisory (signal offset, bottleneck mitigation, commuter/EMS routing).',
    'Do not output HTML or markdown scripts. Keep response under 120 words.',
    `Scenario: ${data.activeScenario}`,
    `Corridor Telemetry: ${data.corridorSummary}`,
    data.incidentNotes ? `Operator Notes: ${data.incidentNotes}` : 'Operator Notes: None'
  ].join('\n');
}

/**
 * Calls the Gemini REST API with an AbortController timeout.
 * @param {{ corridorSummary: string, incidentNotes: string, activeScenario: string }} data
 * @param {string} apiKey
 * @returns {Promise<{ status: number, payload: Record<string, any> }>}
 */
async function callGeminiApi(data, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(data) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 256 }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        status: 502,
        payload: {
          error: 'Upstream AI service returned an error; edge fallback recommended.',
          fallback: true
        }
      };
    }

    const body = await response.json();
    const candidateText = body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!candidateText.trim()) {
      return {
        status: 502,
        payload: { error: 'Upstream AI returned an empty advisory.', fallback: true }
      };
    }

    return {
      status: 200,
      payload: {
        advisory: stripControlChars(candidateText),
        source: 'cloud',
        model: 'gemini-2.5-flash',
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    const isTimeout = Boolean(err && err.name === 'AbortError');
    return {
      status: isTimeout ? 504 : 502,
      payload: {
        error: isTimeout
          ? 'Cloud AI request timed out; edge fallback recommended.'
          : 'Cloud AI request failed; edge fallback recommended.',
        fallback: true
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Vercel Serverless Function handler.
 * @param {any} req
 * @param {any} res
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const rate = checkRateLimit(getClientIp(req));
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSec));
    return res.status(429).json({
      error: 'Rate limit exceeded. Please retry later.',
      retryAfterSec: rate.retryAfterSec
    });
  }

  let parsedBody = req.body;
  if (typeof parsedBody === 'string') {
    try {
      parsedBody = JSON.parse(parsedBody);
    } catch {
      return res.status(400).json({ error: 'Malformed JSON body.' });
    }
  }

  const validation = validatePayload(parsedBody);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Cloud AI advisory is unavailable; using deterministic edge fallback.',
      fallback: true
    });
  }

  const result = await callGeminiApi(validation.data, apiKey);
  return res.status(result.status).json(result.payload);
}
