import { describe, expect, it } from 'vitest';
import { POLICY_MODES } from '../src/config.js';
import { decideRoute } from '../src/router.js';

const normalNodes = [
  { nsQueue: 10, ewQueue: 8, hasEmergency: false, fault: false },
  { nsQueue: 12, ewQueue: 9, hasEmergency: false, fault: false }
];

const congestedNodes = [
  { nsQueue: 28, ewQueue: 16, hasEmergency: false, fault: false },
  { nsQueue: 30, ewQueue: 20, hasEmergency: false, fault: false }
];

describe('router decideRoute', () => {
  it('forces Edge when offline or offlineSimulation is active', () => {
    const offlineNet = decideRoute({
      intersections: congestedNodes,
      policy: POLICY_MODES.CLOUD,
      isOnline: false
    });
    expect(offlineNet.target).toBe('edge');
    expect(offlineNet.reasonCode).toBe('OFFLINE_EDGE');

    const simOffline = decideRoute({
      intersections: congestedNodes,
      policy: POLICY_MODES.AUTO,
      isOnline: true,
      offlineSimulation: true
    });
    expect(simOffline.target).toBe('edge');
    expect(simOffline.reasonCode).toBe('OFFLINE_EDGE');
  });

  it('overrides to Edge immediately for emergency vehicles', () => {
    const byFlag = decideRoute({
      intersections: [{ nsQueue: 30, ewQueue: 20, hasEmergency: true }],
      policy: POLICY_MODES.CLOUD,
      isOnline: true
    });
    expect(byFlag.target).toBe('edge');
    expect(byFlag.reasonCode).toBe('EMERGENCY_PREEMPTION');

    const byNote = decideRoute({
      intersections: normalNodes,
      incidentNotes: 'Fire truck responding eastbound',
      policy: POLICY_MODES.AUTO,
      isOnline: true
    });
    expect(byNote.target).toBe('edge');
    expect(byNote.emergencyActive).toBe(true);
  });

  it('respects explicit user policy overrides when online and non-emergency', () => {
    const forceEdge = decideRoute({
      intersections: congestedNodes,
      policy: POLICY_MODES.EDGE,
      isOnline: true
    });
    expect(forceEdge.target).toBe('edge');
    expect(forceEdge.reasonCode).toBe('POLICY_FORCE_EDGE');

    const forceCloud = decideRoute({
      intersections: normalNodes,
      policy: POLICY_MODES.CLOUD,
      isOnline: true
    });
    expect(forceCloud.target).toBe('cloud');
    expect(forceCloud.reasonCode).toBe('POLICY_FORCE_CLOUD');
  });

  it('escalates to Cloud only on multi-corridor complexity in Auto Hybrid mode', () => {
    const lowLoad = decideRoute({
      intersections: normalNodes,
      policy: POLICY_MODES.AUTO,
      isOnline: true
    });
    expect(lowLoad.target).toBe('edge');
    expect(lowLoad.reasonCode).toBe('LOCAL_OPTIMAL_EDGE');

    const highLoad = decideRoute({
      intersections: congestedNodes,
      policy: POLICY_MODES.AUTO,
      isOnline: true
    });
    expect(highLoad.target).toBe('cloud');
    expect(highLoad.reasonCode).toBe('MULTI_CORRIDOR_COMPLEXITY');
  });
});
