/**
 * @fileoverview Central configuration constants, thresholds, intersection presets,
 * and routing policies for the Smart Traffic Management System.
 */

export const POLICY_MODES = Object.freeze({
  AUTO: 'auto',
  EDGE: 'edge',
  CLOUD: 'cloud'
});

export const SIGNAL_PHASES = Object.freeze({
  NS_GREEN: 'NS_GREEN',
  EW_GREEN: 'EW_GREEN',
  EMERGENCY_CORRIDOR: 'EMERGENCY_CORRIDOR',
  SAFE_FLASH: 'SAFE_FLASH'
});

export const TIMING_BOUNDS = Object.freeze({
  MIN_GREEN_SEC: 15,
  MAX_GREEN_SEC: 75,
  BASE_CYCLE_SEC: 90,
  YELLOW_SEC: 4,
  ALL_RED_SEC: 2,
  EMERGENCY_GREEN_SEC: 60
});

export const ROUTER_THRESHOLDS = Object.freeze({
  HIGH_QUEUE_VEHICLES: 22,
  COMPLEXITY_CONGESTION_COUNT: 2,
  MIN_NOTE_CHARS_FOR_CLOUD: 15,
  CLOUD_TIMEOUT_MS: 8000,
  CACHE_MAX_ENTRIES: 24,
  MAX_NOTE_LENGTH: 400
});

/**
 * Default 4-intersection urban arterial corridor.
 * @type {ReadonlyArray<{ id: string, name: string, nsQueue: number, ewQueue: number, speedKmh: number, hasEmergency: boolean, fault: boolean }>}
 */
export const DEFAULT_INTERSECTIONS = Object.freeze([
  {
    id: 'int-1',
    name: 'MG Road & 1st Ave',
    nsQueue: 12,
    ewQueue: 9,
    speedKmh: 38,
    hasEmergency: false,
    fault: false
  },
  {
    id: 'int-2',
    name: 'Central Civic Square',
    nsQueue: 16,
    ewQueue: 14,
    speedKmh: 32,
    hasEmergency: false,
    fault: false
  },
  {
    id: 'int-3',
    name: 'Tech Park Junction',
    nsQueue: 11,
    ewQueue: 10,
    speedKmh: 40,
    hasEmergency: false,
    fault: false
  },
  {
    id: 'int-4',
    name: 'Ring Road Bypass',
    nsQueue: 14,
    ewQueue: 8,
    speedKmh: 45,
    hasEmergency: false,
    fault: false
  }
]);
