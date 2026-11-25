/**
 * @fileoverview Input sanitization, validation, bounded LRU cache,
 * and deterministic incident/intent classification utilities.
 */

import { ROUTER_THRESHOLDS } from './config.js';

/**
 * Sanitizes untrusted text by stripping control characters and collapsing
 * excessive whitespace. Never produces HTML; safe for textContent rendering.
 * @param {unknown} value
 * @param {number} [maxLen=ROUTER_THRESHOLDS.MAX_NOTE_LENGTH]
 * @returns {string}
 */
export function sanitizeText(value, maxLen = ROUTER_THRESHOLDS.MAX_NOTE_LENGTH) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLen);
}

/**
 * Validates an operator incident note.
 * @param {unknown} note
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validateIncidentNote(note) {
  if (note === undefined || note === null || note === '') {
    return { valid: true, sanitized: '' };
  }
  if (typeof note !== 'string') {
    return { valid: false, sanitized: '', error: 'Incident note must be text.' };
  }
  const rawTrimmed = note.trim();
  if (rawTrimmed.length > ROUTER_THRESHOLDS.MAX_NOTE_LENGTH) {
    return {
      valid: false,
      sanitized: sanitizeText(rawTrimmed),
      error: `Incident note must be ${ROUTER_THRESHOLDS.MAX_NOTE_LENGTH} characters or fewer.`
    };
  }
  return { valid: true, sanitized: sanitizeText(rawTrimmed) };
}

/**
 * Clamps a numeric queue or speed value to safe integer bounds.
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/**
 * Deterministic keyword-based incident classifier for zero-latency edge triage.
 * @param {string} note
 * @returns {'emergency' | 'accident' | 'weather' | 'fault' | 'congestion' | 'normal'}
 */
export function classifyIncident(note) {
  const text = sanitizeText(note).toLowerCase();
  if (!text) return 'normal';

  if (/\b(ambulance|ems|fire\s*truck|police|emergency|siren|paramedic)\b/.test(text)) {
    return 'emergency';
  }
  if (/\b(accident|crash|collision|stalled|breakdown|pileup|blocked)\b/.test(text)) {
    return 'accident';
  }
  if (/\b(rain|fog|storm|flood|visibility|wet|slippery|weather)\b/.test(text)) {
    return 'weather';
  }
  if (/\b(fault|outage|blackout|malfunction|sensor\s*down|offline)\b/.test(text)) {
    return 'fault';
  }
  if (/\b(gridlock|jam|rush|bottleneck|heavy|congestion|queue|delay)\b/.test(text)) {
    return 'congestion';
  }
  return 'normal';
}

/**
 * Bounded LRU-style Map cache that evicts the least-recently-used entry
 * when capacity is reached.
 */
export class BoundedCache {
  /**
   * @param {number} [maxEntries=ROUTER_THRESHOLDS.CACHE_MAX_ENTRIES]
   */
  constructor(maxEntries = ROUTER_THRESHOLDS.CACHE_MAX_ENTRIES) {
    this.maxEntries = Math.max(1, maxEntries);
    /** @type {Map<string, any>} */
    this.store = new Map();
    this.evictions = 0;
  }

  /**
   * Retrieves an entry and marks it most-recently-used.
   * @param {string} key
   * @returns {any | undefined}
   */
  get(key) {
    if (!this.store.has(key)) return undefined;
    const value = this.store.get(key);
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  /**
   * Stores an entry, evicting the oldest entry if at capacity.
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.evictions += 1;
      }
    }
    this.store.set(key, value);
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.store.has(key);
  }

  /** @returns {number} */
  get size() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
    this.evictions = 0;
  }
}
