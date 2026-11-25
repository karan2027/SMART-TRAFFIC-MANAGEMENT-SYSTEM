/**
 * @fileoverview Context-Aware Hybrid Decision Engine (Edge vs. Cloud AI).
 * Evaluates connectivity, emergency preemption, congestion complexity,
 * and user policy overrides in deterministic priority order.
 */

import { POLICY_MODES, ROUTER_THRESHOLDS } from './config.js';
import { classifyIncident } from './utils.js';

/**
 * @typedef {Object} RouteDecision
 * @property {'edge' | 'cloud'} target
 * @property {string} reasonCode
 * @property {string} explanation
 * @property {string} incidentClass
 * @property {number} congestedCount
 * @property {boolean} emergencyActive
 */

/**
 * Evaluates corridor telemetry and operator context to decide whether
 * signal optimization & advisory should run purely on the Edge or escalate to Cloud AI.
 *
 * Priority order:
 * 1. Connectivity (offline or simulated offline -> instant Edge)
 * 2. Emergency / Priority Preemption (ambulance/EMS -> instant Edge override)
 * 3. User Policy Override (Force Edge / Force Cloud when online)
 * 4. Congestion / Complexity Threshold (multi-corridor load or complex incident -> Cloud)
 *
 * @param {Object} context
 * @param {Array<{ nsQueue: number, ewQueue: number, hasEmergency?: boolean, fault?: boolean }>} context.intersections
 * @param {string} [context.incidentNotes='']
 * @param {string} [context.policy=POLICY_MODES.AUTO]
 * @param {boolean} [context.isOnline=true]
 * @param {boolean} [context.offlineSimulation=false]
 * @returns {RouteDecision}
 */
export function decideRoute({
  intersections = [],
  incidentNotes = '',
  policy = POLICY_MODES.AUTO,
  isOnline = true,
  offlineSimulation = false
}) {
  const incidentClass = classifyIncident(incidentNotes);
  const emergencyActive =
    incidentClass === 'emergency' ||
    intersections.some((item) => Boolean(item.hasEmergency));

  const congestedCount = intersections.filter(
    (item) =>
      Math.max(item.nsQueue || 0, item.ewQueue || 0) >=
      ROUTER_THRESHOLDS.HIGH_QUEUE_VEHICLES
  ).length;

  const hasFault =
    incidentClass === 'fault' || intersections.some((item) => Boolean(item.fault));

  // 1. Connectivity check: offline never attempts network egress
  if (!isOnline || offlineSimulation) {
    return {
      target: 'edge',
      reasonCode: 'OFFLINE_EDGE',
      explanation: 'Offline mode active: deterministic edge controller handling all signals with 0 B egress.',
      incidentClass,
      congestedCount,
      emergencyActive
    };
  }

  // 2. Emergency preemption: safety-critical latency requires instant edge override
  if (emergencyActive) {
    return {
      target: 'edge',
      reasonCode: 'EMERGENCY_PREEMPTION',
      explanation: 'Emergency vehicle detected: bypassing cloud round-trip for instant green-corridor preemption.',
      incidentClass,
      congestedCount,
      emergencyActive
    };
  }

  // 3. Explicit user policy overrides
  if (policy === POLICY_MODES.EDGE) {
    return {
      target: 'edge',
      reasonCode: 'POLICY_FORCE_EDGE',
      explanation: 'Operator policy locked to Edge-Only mode (0 ms cloud dependency).',
      incidentClass,
      congestedCount,
      emergencyActive
    };
  }

  if (policy === POLICY_MODES.CLOUD) {
    return {
      target: 'cloud',
      reasonCode: 'POLICY_FORCE_CLOUD',
      explanation: 'Operator policy requested Cloud AI corridor forecasting.',
      incidentClass,
      congestedCount,
      emergencyActive
    };
  }

  // 4. Auto Hybrid: escalate to Cloud AI only for multi-junction complexity or rich incidents
  const isComplexIncident =
    incidentClass === 'accident' ||
    incidentClass === 'weather' ||
    incidentNotes.trim().length >= ROUTER_THRESHOLDS.MIN_NOTE_CHARS_FOR_CLOUD;

  if (
    congestedCount >= ROUTER_THRESHOLDS.COMPLEXITY_CONGESTION_COUNT ||
    isComplexIncident ||
    hasFault
  ) {
    return {
      target: 'cloud',
      reasonCode: 'MULTI_CORRIDOR_COMPLEXITY',
      explanation: `Escalating to Cloud AI (${congestedCount} congested junctions, incident: ${incidentClass}) for corridor-wide offset forecasting.`,
      incidentClass,
      congestedCount,
      emergencyActive
    };
  }

  return {
    target: 'edge',
    reasonCode: 'LOCAL_OPTIMAL_EDGE',
    explanation: 'Normal corridor load: handled locally on the Edge with sub-millisecond adaptive timing.',
    incidentClass,
    congestedCount,
    emergencyActive
  };
}
