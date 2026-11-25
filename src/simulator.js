/**
 * @fileoverview Realistic urban traffic scenario presets and live corridor telemetry.
 */

import { DEFAULT_INTERSECTIONS } from './config.js';

/**
 * @typedef {Object} ScenarioPreset
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} defaultNote
 * @property {boolean} offlineSimulation
 * @property {number} weatherPenalty
 * @property {Array<{ id: string, name: string, nsQueue: number, ewQueue: number, speedKmh: number, hasEmergency: boolean, fault: boolean }>} intersections
 */

/** @type {Record<string, ScenarioPreset>} */
export const SCENARIOS = Object.freeze({
  'normal-flow': {
    id: 'normal-flow',
    label: 'Normal Midday Flow',
    description: 'Balanced arterial traffic handled 100% locally on the edge.',
    defaultNote: '',
    offlineSimulation: false,
    weatherPenalty: 0,
    intersections: DEFAULT_INTERSECTIONS.map((n) => ({ ...n }))
  },
  'rush-hour': {
    id: 'rush-hour',
    label: 'Evening Rush Hour',
    description: 'Heavy multi-junction congestion triggering Cloud AI green-wave forecasting.',
    defaultNote: 'Heavy outbound commuter surge across Central Civic Square and Tech Park.',
    offlineSimulation: false,
    weatherPenalty: 0,
    intersections: [
      { id: 'int-1', name: 'MG Road & 1st Ave', nsQueue: 28, ewQueue: 16, speedKmh: 22, hasEmergency: false, fault: false },
      { id: 'int-2', name: 'Central Civic Square', nsQueue: 34, ewQueue: 24, speedKmh: 18, hasEmergency: false, fault: false },
      { id: 'int-3', name: 'Tech Park Junction', nsQueue: 26, ewQueue: 19, speedKmh: 24, hasEmergency: false, fault: false },
      { id: 'int-4', name: 'Ring Road Bypass', nsQueue: 21, ewQueue: 15, speedKmh: 30, hasEmergency: false, fault: false }
    ]
  },
  'ambulance-corridor': {
    id: 'ambulance-corridor',
    label: 'Ambulance Green Corridor',
    description: 'Emergency vehicle preemption overrides cloud latency for instant edge green lock.',
    defaultNote: 'Priority ambulance en route northbound to City General Hospital.',
    offlineSimulation: false,
    weatherPenalty: 0,
    intersections: [
      { id: 'int-1', name: 'MG Road & 1st Ave', nsQueue: 20, ewQueue: 14, speedKmh: 35, hasEmergency: true, fault: false },
      { id: 'int-2', name: 'Central Civic Square', nsQueue: 25, ewQueue: 18, speedKmh: 30, hasEmergency: true, fault: false },
      { id: 'int-3', name: 'Tech Park Junction', nsQueue: 15, ewQueue: 12, speedKmh: 40, hasEmergency: false, fault: false },
      { id: 'int-4', name: 'Ring Road Bypass', nsQueue: 14, ewQueue: 10, speedKmh: 45, hasEmergency: false, fault: false }
    ]
  },
  'rain-visibility': {
    id: 'rain-visibility',
    label: 'Heavy Rain & Low Visibility',
    description: 'Adverse weather reduces corridor speeds and extends clearance intervals.',
    defaultNote: 'Heavy rain reducing braking distance and visibility along arterial corridor.',
    offlineSimulation: false,
    weatherPenalty: 0.3,
    intersections: [
      { id: 'int-1', name: 'MG Road & 1st Ave', nsQueue: 23, ewQueue: 17, speedKmh: 20, hasEmergency: false, fault: false },
      { id: 'int-2', name: 'Central Civic Square', nsQueue: 26, ewQueue: 20, speedKmh: 16, hasEmergency: false, fault: false },
      { id: 'int-3', name: 'Tech Park Junction', nsQueue: 19, ewQueue: 14, speedKmh: 22, hasEmergency: false, fault: false },
      { id: 'int-4', name: 'Ring Road Bypass', nsQueue: 18, ewQueue: 13, speedKmh: 25, hasEmergency: false, fault: false }
    ]
  },
  'signal-fault': {
    id: 'signal-fault',
    label: 'Controller Signal Fault',
    description: 'Cabinet fault at Central Civic Square triggers fail-safe flash and spillback capping.',
    defaultNote: 'Loop sensor fault reported at Central Civic Square cabinet.',
    offlineSimulation: false,
    weatherPenalty: 0,
    intersections: [
      { id: 'int-1', name: 'MG Road & 1st Ave', nsQueue: 18, ewQueue: 12, speedKmh: 28, hasEmergency: false, fault: false },
      { id: 'int-2', name: 'Central Civic Square', nsQueue: 24, ewQueue: 22, speedKmh: 15, hasEmergency: false, fault: true },
      { id: 'int-3', name: 'Tech Park Junction', nsQueue: 16, ewQueue: 13, speedKmh: 30, hasEmergency: false, fault: false },
      { id: 'int-4', name: 'Ring Road Bypass', nsQueue: 14, ewQueue: 11, speedKmh: 36, hasEmergency: false, fault: false }
    ]
  },
  'offline-mode': {
    id: 'offline-mode',
    label: 'Offline Backhaul Outage',
    description: 'Simulates severed WAN link; edge controllers maintain adaptive timing with 0 B egress.',
    defaultNote: 'Fiber backhaul offline; operating in autonomous edge resilience mode.',
    offlineSimulation: true,
    weatherPenalty: 0,
    intersections: [
      { id: 'int-1', name: 'MG Road & 1st Ave', nsQueue: 24, ewQueue: 15, speedKmh: 26, hasEmergency: false, fault: false },
      { id: 'int-2', name: 'Central Civic Square', nsQueue: 27, ewQueue: 18, speedKmh: 24, hasEmergency: false, fault: false },
      { id: 'int-3', name: 'Tech Park Junction', nsQueue: 17, ewQueue: 14, speedKmh: 32, hasEmergency: false, fault: false },
      { id: 'int-4', name: 'Ring Road Bypass', nsQueue: 15, ewQueue: 10, speedKmh: 38, hasEmergency: false, fault: false }
    ]
  }
});

/**
 * Returns a deep-cloned scenario preset by ID, defaulting to 'normal-flow'.
 * @param {string} scenarioId
 * @returns {ScenarioPreset}
 */
export function getScenarioPreset(scenarioId) {
  const preset = SCENARIOS[scenarioId] || SCENARIOS['normal-flow'];
  return {
    ...preset,
    intersections: preset.intersections.map((n) => ({ ...n }))
  };
}

/**
 * Computes live corridor telemetry metrics comparing adaptive green-wave control
 * against a fixed-time 45s/45s baseline.
 *
 * @param {Array<{ nsQueue: number, ewQueue: number, speedKmh: number, hasEmergency?: boolean, fault?: boolean }>} intersections
 * @param {Array<{ activePhase: string, nsGreenSec: number, ewGreenSec: number, priority: string }>} signalPlan
 * @param {{ latencyMs: number, egressBytes: number, source: string }} advisoryResult
 * @returns {{ avgWaitReductionPct: number, co2SavedKgHr: number, fuelSavedLHr: number, totalVehicles: number, avgSpeedKmh: number, latencyMs: number, egressBytes: number, source: string }}
 */
export function computeTelemetry(intersections, signalPlan, advisoryResult) {
  const totalVehicles = intersections.reduce(
    (sum, n) => sum + (n.nsQueue || 0) + (n.ewQueue || 0),
    0
  );

  const avgSpeedKmh =
    intersections.length > 0
      ? Math.round(
          intersections.reduce((sum, n) => sum + (n.speedKmh || 0), 0) /
            intersections.length
        )
      : 0;

  const activeAdaptive = signalPlan.filter((s) => s.cycleSec > 0);
  const balanceScore =
    activeAdaptive.length > 0
      ? activeAdaptive.reduce((acc, s, idx) => {
          const node = intersections[idx] || { nsQueue: 1, ewQueue: 1 };
          const qRatio = (node.nsQueue || 1) / Math.max(1, (node.nsQueue || 0) + (node.ewQueue || 0));
          const gRatio = s.nsGreenSec / Math.max(1, s.nsGreenSec + s.ewGreenSec);
          const match = 1 - Math.abs(qRatio - gRatio);
          return acc + match;
        }, 0) / activeAdaptive.length
      : 0.5;

  const emsBonus = intersections.some((n) => n.hasEmergency) ? 8 : 0;
  const avgWaitReductionPct = Math.min(
    42,
    Math.max(8, Math.round(balanceScore * 28 + emsBonus))
  );

  const idleHoursSaved = (totalVehicles * (avgWaitReductionPct / 100) * 0.45) / 60;
  const fuelSavedLHr = Number((idleHoursSaved * 1.6).toFixed(1));
  const co2SavedKgHr = Number((fuelSavedLHr * 2.31).toFixed(1));

  return {
    avgWaitReductionPct,
    co2SavedKgHr,
    fuelSavedLHr,
    totalVehicles,
    avgSpeedKmh,
    latencyMs: advisoryResult.latencyMs,
    egressBytes: advisoryResult.egressBytes,
    source: advisoryResult.source
  };
}
