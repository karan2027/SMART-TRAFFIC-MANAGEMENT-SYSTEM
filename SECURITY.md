# Security Architecture (`CorridorFlow AI`)

## 1. API Key & Secret Management
- `GEMINI_API_KEY` is stored **exclusively** in server-side environment variables (`.env.local` locally, Vercel Environment Variables in production).
- Zero secrets are referenced or bundled in `index.html`, `src/*`, or any client-side asset.
- `.env` and `.env*.local` are excluded in `.gitignore`. `.env.example` contains only a placeholder.
- The server-side proxy (`api/analyze.js`) transmits the key via the `x-goog-api-key` HTTP header rather than URL query parameters, preventing key exposure in access logs.

## 2. Input Validation & XSS Prevention
- **Server-side (`api/analyze.js`)**: Validates that the request body is a JSON object, `corridorSummary` is a non-empty string, `incidentNotes` and `activeScenario` are strings, strips ASCII control characters, and enforces `MAX_INPUT_CHARS = 1500` (returning HTTP `400` on violations).
- **Client-side (`src/utils.js`, `src/ui.js`)**: `sanitizeText()` strips control characters and angle brackets (`<`, `>`). All DOM updates in `src/ui.js` use `document.createElement()` and `textContent` — **`innerHTML` is never used anywhere**.

## 3. Rate Limiting & Resource Protection
- `api/analyze.js` enforces:
  - `POST`-only access (returns `405` with `Allow: POST` for other methods).
  - Per-IP in-memory rate limiting (`30` requests per `60s` window, returning `429` with `Retry-After` and `X-RateLimit-Remaining` headers) with bounded IP map eviction (`MAX_TRACKED_IPS = 1000`).
  - `AbortController` upstream timeout (`8000ms`), returning `504` with `{ fallback: true }` and never leaking stack traces or internal errors.

## 4. HTTP Security Headers (`vercel.json`)
- `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
