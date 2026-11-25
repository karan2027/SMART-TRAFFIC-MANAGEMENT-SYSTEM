import { describe, expect, it } from 'vitest';
import {
  BoundedCache,
  clampInt,
  classifyIncident,
  sanitizeText,
  validateIncidentNote
} from '../src/utils.js';

describe('utils', () => {
  it('sanitizes control characters and angle brackets safely', () => {
    const dirty = '  <script>alert(1)</script>  Ambulance\u0007 at   Main\nSt  ';
    expect(sanitizeText(dirty)).toBe('scriptalert(1)/script Ambulance at Main St');
    expect(sanitizeText(null)).toBe('');
  });

  it('validates incident note length and types', () => {
    expect(validateIncidentNote('')).toEqual({ valid: true, sanitized: '' });
    expect(validateIncidentNote(123).valid).toBe(false);
    const tooLong = 'a'.repeat(450);
    const res = validateIncidentNote(tooLong);
    expect(res.valid).toBe(false);
    expect(res.sanitized.length).toBe(400);
  });

  it('clamps integers within bounds', () => {
    expect(clampInt(150, 0, 100, 10)).toBe(100);
    expect(clampInt(-5, 0, 100, 10)).toBe(0);
    expect(clampInt('abc', 0, 100, 10)).toBe(10);
    expect(clampInt(24.6, 0, 100, 10)).toBe(25);
  });

  it('classifies incidents deterministically', () => {
    expect(classifyIncident('Ambulance approaching Civic Square')).toBe('emergency');
    expect(classifyIncident('Two-car collision blocking lane 2')).toBe('accident');
    expect(classifyIncident('Heavy rain and fog reducing visibility')).toBe('weather');
    expect(classifyIncident('Loop sensor fault at junction 2')).toBe('fault');
    expect(classifyIncident('Evening rush gridlock on bypass')).toBe('congestion');
    expect(classifyIncident('Routine patrol')).toBe('normal');
    expect(classifyIncident('')).toBe('normal');
  });

  it('evicts least-recently-used entries in BoundedCache', () => {
    const cache = new BoundedCache(2);
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    expect(cache.get('k1')).toBe('v1'); // promotes k1, so k2 is oldest
    cache.set('k3', 'v3');
    expect(cache.has('k2')).toBe(false);
    expect(cache.has('k1')).toBe(true);
    expect(cache.has('k3')).toBe(true);
    expect(cache.evictions).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
