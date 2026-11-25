/**
 * @fileoverview Adaptive Signal Timing Engine & Hybrid Advisory Resolver.
 * Computes deterministic green-wave / queue-weighted signal plans locally,
 * and resolves corridor advisories via:
 * Local Cache -> Edge Rules -> /api/analyze Cloud Gemini -> Offline Fallback.
 */

import { ROUTER_THRESHOLDS, SIGNAL_PHASES, TIMING_BOUNDS } from './config.js';
import { BoundedCache, clampInt, sanitizeText } from './utils.js';

/**
 * Computes an adaptive signal plan for a single intersection.
 * @param {{ id: string, name: string, nsQueue: number, ewQueue: number, speedKmh: number, hasEmergency?: boolean, fault?: boolean }} node
 * @param {number} index
 * @param {number} weatherPenalty
 * @returns {{ id: string, name: string, activePhase: string, nsGreenSec: number, ewGreenSec: number, cycleSec: number, offsetSec: number, priority: string }}
 */
function computeSingleJunctionPlan(node, index, weatherPenalty) {
  const ns = clampInt(node.nsQueue, 0, 120, 0);
  const ew = clampInt(node.ewQueue, 0, 120, 0);

  if (node.fault) {
    return {
      id: node.id,
      name: node.name,
      activePhase: SIGNAL_PHASES.SAFE_FLASH,
      nsGreenSec: 0,
      ewGreenSec: 0,
      cycleSec: 0,
      offsetSec: 0,
      priority: 'FAULT_SAFE_FLASH'
    };
  }

  if (node.hasEmergency) {
    return {
      id: node.id,
      name: node.name,
      activePhase: SIGNAL_PHASES.EMERGENCY_CORRIDOR,
      nsGreenSec: TIMING_BOUNDS.EMERGENCY_GREEN_SEC,
      ewGreenSec: TIMING_BOUNDS.MIN_GREEN_SEC,
      cycleSec:
        TIMING_BOUNDS.EMERGENCY_GREEN_SEC +
        TIMING_BOUNDS.MIN_GREEN_SEC +
        (TIMING_BOUNDS.YELLOW_SEC + TIMING_BOUNDS.ALL_RED_SEC) * 2,
      offsetSec: index * 6,
      priority: 'EMS_PREEMPTION'
    };
  }

  const totalQueue = Math.max(1, ns + ew);
  const availableGreen =
    TIMING_BOUNDS.BASE_CYCLE_SEC -
    (TIMING_BOUNDS.YELLOW_SEC + TIMING_BOUNDS.ALL_RED_SEC) * 2;
  const rawNsGreen = Math.round((ns / totalQueue) * availableGreen);
  const nsGreenSec = clampInt(
    Math.round(rawNsGreen * (1 + weatherPenalty * 0.25)),
    TIMING_BOUNDS.MIN_GREEN_SEC,
    TIMING_BOUNDS.MAX_GREEN_SEC,
    35
  );
  const ewGreenSec = clampInt(
    availableGreen - nsGreenSec,
    TIMING_BOUNDS.MIN_GREEN_SEC,
    TIMING_BOUNDS.MAX_GREEN_SEC,
    35
  );

  const speedMs = Math.max(4, (clampInt(node.speedKmh, 10, 90, 35) * 1000) / 3600);
  return {
    id: node.id,
    name: node.name,
    activePhase: ns >= ew ? SIGNAL_PHASES.NS_GREEN : SIGNAL_PHASES.EW_GREEN,
    nsGreenSec,
    ewGreenSec,
    cycleSec:
      nsGreenSec +
      ewGreenSec +
      (TIMING_BOUNDS.YELLOW_SEC + TIMING_BOUNDS.ALL_RED_SEC) * 2,
    offsetSec: Math.round((index * 320) / speedMs) % 45,
    priority:
      Math.max(ns, ew) >= ROUTER_THRESHOLDS.HIGH_QUEUE_VEHICLES
        ? 'HIGH_DEMAND'
        : 'NORMAL'
  };
}

/**
 * Computes an adaptive signal plan for every intersection in the corridor.
 * Runs 100% deterministically on the edge in < 1 ms.
 *
 * @param {Array<{ id: string, name: string, nsQueue: number, ewQueue: number, speedKmh: number, hasEmergency?: boolean, fault?: boolean }>} intersections
 * @param {{ weatherPenalty?: number }} [options={}]
 * @returns {Array<{ id: string, name: string, activePhase: string, nsGreenSec: number, ewGreenSec: number, cycleSec: number, offsetSec: number, priority: string }>}
 */
export function computeSignalPlan(intersections, options = {}) {
  const weatherPenalty = Number.isFinite(options.weatherPenalty)
    ? Math.max(0, Math.min(0.4, options.weatherPenalty))
    : 0;
  return intersections.map((node, index) =>
    computeSingleJunctionPlan(node, index, weatherPenalty)
  );
}

/**
 * Generates a deterministic Edge advisory without any network call.
 * @param {Object} params
 * @param {Array<any>} params.signalPlan
 * @param {import('./router.js').RouteDecision} params.routeDecision
 * @param {string} [params.incidentNotes='']
 * @returns {string}
 */
export function buildEdgeAdvisory({ signalPlan, routeDecision, incidentNotes = '' }) {
  const busiest = signalPlan.reduce(
    (best, cur) => (cur.nsGreenSec > best.nsGreenSec ? cur : best),
    signalPlan[0] || { name: 'Corridor', nsGreenSec: 35, offsetSec: 0 }
  );

  if (routeDecision.emergencyActive) {
    return [
      `• EMS Green Corridor active: ${TIMING_BOUNDS.EMERGENCY_GREEN_SEC}s NS green lock with 6s progressive offsets.`,
      `• Cross-street queues held at ${TIMING_BOUNDS.MIN_GREEN_SEC}s minimum phase until emergency clearance.`,
      '• Zero cloud latency: executed locally on edge controller.'
    ].join('\n');
  }

  if (routeDecision.incidentClass === 'fault') {
    return [
      '• Signal fault detected: affected junction placed in fail-safe 4-way red/amber flash.',
      `• Upstream ${busiest.name} capped to prevent spillback.`,
      '• Dispatch field maintenance unit; local edge controller maintaining safe intervals.'
    ].join('\n');
  }

  const noteSnippet = sanitizeText(incidentNotes, 80);
  return [
    `• Adaptive green-wave active: ${busiest.name} allocated ${busiest.nsGreenSec}s NS green (offset ${busiest.offsetSec}s).`,
    `• Edge mode (${routeDecision.reasonCode}): 0 B network egress, deterministic cycle control.`,
    noteSnippet
      ? `• Operator note logged locally: "${noteSnippet}".`
      : '• Corridor flow within nominal thresholds; no cloud escalation needed.'
  ].join('\n');
}

/**
 * Builds a compact cache key from corridor state and incident notes.
 * @param {Array<any>} intersections
 * @param {string} incidentNotes
 * @param {string} scenarioId
 * @returns {string}
 */
export function buildCacheKey(intersections, incidentNotes, scenarioId) {
  const queueSig = intersections
    .map((n) => `${n.id}:${n.nsQueue}-${n.ewQueue}-${n.hasEmergency ? 1 : 0}-${n.fault ? 1 : 0}`)
    .join('|');
  return `${scenarioId}::${queueSig}::${sanitizeText(incidentNotes, 120)}`;
}

/**
 * Resolves a corridor advisory using the hybrid fallback chain:
 * 1. Bounded LRU Cache (if Cloud-eligible and cached)
 * 2. Deterministic Edge Rules (if routeDecision.target === 'edge')
 * 3. Cloud Gemini via `/api/analyze` with AbortController timeout
 * 4. Graceful Edge Fallback if network/API fails
 *
 * @param {Object} params
 * @param {Array<any>} params.intersections
 * @param {Array<any>} params.signalPlan
 * @param {import('./router.js').RouteDecision} params.routeDecision
 * @param {string} [params.incidentNotes='']
 * @param {string} [params.scenarioId='custom']
 * @param {BoundedCache} [params.cache]
 * @param {typeof fetch} [params.fetchImpl=globalThis.fetch]
 * @returns {Promise<{ advisory: string, source: 'edge' | 'cloud' | 'cache' | 'fallback', latencyMs: number, egressBytes: number }>}
 */
export async function resolveTrafficAdvisory({
  intersections,
  signalPlan,
  routeDecision,
  incidentNotes = '',
  scenarioId = 'custom',
  cache = new BoundedCache(),
  fetchImpl = globalThis.fetch
}) {
  const start = performance.now();

  if (routeDecision.target === 'edge') {
    const advisory = buildEdgeAdvisory({ signalPlan, routeDecision, incidentNotes });
    return {
      advisory,
      source: 'edge',
      latencyMs: Math.max(0.2, Number((performance.now() - start).toFixed(2))),
      egressBytes: 0
    };
  }

  const cacheKey = buildCacheKey(intersections, incidentNotes, scenarioId);
  const cached = cache.get(cacheKey);
  if (cached) {
    return {
      advisory: cached,
      source: 'cache',
      latencyMs: Math.max(0.2, Number((performance.now() - start).toFixed(2))),
      egressBytes: 0
    };
  }

  const corridorSummary = intersections
    .map(
      (n) =>
        `${n.name} (NS:${n.nsQueue}, EW:${n.ewQueue}, ${n.speedKmh}km/h${n.hasEmergency ? ', EMS' : ''}${n.fault ? ', FAULT' : ''})`
    )
    .join('; ');

  const payloadBody = JSON.stringify({
    corridorSummary,
    incidentNotes: sanitizeText(incidentNotes),
    activeScenario: scenarioId
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ROUTER_THRESHOLDS.CLOUD_TIMEOUT_MS
  );

  try {
    const response = await fetchImpl('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadBody,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const data = await response.json();
    if (!data || typeof data.advisory !== 'string' || !data.advisory.trim()) {
      throw new Error('INVALID_ADVISORY_PAYLOAD');
    }

    const cleanAdvisory = sanitizeText(data.advisory, 900);
    cache.set(cacheKey, cleanAdvisory);

    return {
      advisory: cleanAdvisory,
      source: 'cloud',
      latencyMs: Math.max(1, Number((performance.now() - start).toFixed(1))),
      egressBytes: payloadBody.length
    };
  } catch {
    const fallbackAdvisory = buildEdgeAdvisory({
      signalPlan,
      routeDecision,
      incidentNotes
    });
    return {
      advisory: `${fallbackAdvisory}\n• Note: Cloud AI unreachable; edge fallback preserved uninterrupted control.`,
      source: 'fallback',
      latencyMs: Math.max(1, Number((performance.now() - start).toFixed(1))),
      egressBytes: payloadBody.length
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
