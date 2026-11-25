import { describe, expect, it, vi } from 'vitest';
import { SIGNAL_PHASES, TIMING_BOUNDS } from '../src/config.js';
import { computeSignalPlan, resolveTrafficAdvisory } from '../src/trafficEngine.js';
import { BoundedCache } from '../src/utils.js';

describe('trafficEngine', () => {
  it('computes adaptive queue-weighted signal plans, EMS lock, and fault safe-flash', () => {
    const plan = computeSignalPlan([
      { id: '1', name: 'J1', nsQueue: 30, ewQueue: 10, speedKmh: 36, hasEmergency: false, fault: false },
      { id: '2', name: 'J2', nsQueue: 15, ewQueue: 15, speedKmh: 36, hasEmergency: true, fault: false },
      { id: '3', name: 'J3', nsQueue: 10, ewQueue: 10, speedKmh: 36, hasEmergency: false, fault: true }
    ]);

    expect(plan[0].activePhase).toBe(SIGNAL_PHASES.NS_GREEN);
    expect(plan[0].nsGreenSec).toBeGreaterThan(plan[0].ewGreenSec);

    expect(plan[1].activePhase).toBe(SIGNAL_PHASES.EMERGENCY_CORRIDOR);
    expect(plan[1].nsGreenSec).toBe(TIMING_BOUNDS.EMERGENCY_GREEN_SEC);

    expect(plan[2].activePhase).toBe(SIGNAL_PHASES.SAFE_FLASH);
    expect(plan[2].cycleSec).toBe(0);
  });

  it('runs Edge advisory with zero network egress', async () => {
    const fetchSpy = vi.fn();
    const intersections = [{ id: '1', name: 'J1', nsQueue: 10, ewQueue: 8, speedKmh: 40 }];
    const signalPlan = computeSignalPlan(intersections);

    const res = await resolveTrafficAdvisory({
      intersections,
      signalPlan,
      routeDecision: {
        target: 'edge',
        reasonCode: 'LOCAL_OPTIMAL_EDGE',
        explanation: 'Local',
        incidentClass: 'normal',
        congestedCount: 0,
        emergencyActive: false
      },
      fetchImpl: fetchSpy
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.source).toBe('edge');
    expect(res.egressBytes).toBe(0);
  });

  it('calls Cloud API once and serves subsequent identical requests from BoundedCache', async () => {
    const cache = new BoundedCache(5);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ advisory: '• Shift offset +6s at Civic Square.' })
    });

    const intersections = [{ id: '1', name: 'Civic Square', nsQueue: 28, ewQueue: 18, speedKmh: 20 }];
    const signalPlan = computeSignalPlan(intersections);
    const routeDecision = {
      target: 'cloud',
      reasonCode: 'MULTI_CORRIDOR_COMPLEXITY',
      explanation: 'Cloud',
      incidentClass: 'congestion',
      congestedCount: 2,
      emergencyActive: false
    };

    const first = await resolveTrafficAdvisory({
      intersections,
      signalPlan,
      routeDecision,
      scenarioId: 'rush-hour',
      cache,
      fetchImpl: fetchMock
    });
    expect(first.source).toBe('cloud');
    expect(first.egressBytes).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await resolveTrafficAdvisory({
      intersections,
      signalPlan,
      routeDecision,
      scenarioId: 'rush-hour',
      cache,
      fetchImpl: fetchMock
    });
    expect(second.source).toBe('cache');
    expect(second.egressBytes).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Edge advisory when Cloud API fails or aborts', async () => {
    const fetchFail = vi.fn().mockRejectedValue(new Error('Network down'));
    const intersections = [{ id: '1', name: 'Civic Square', nsQueue: 28, ewQueue: 18, speedKmh: 20 }];
    const signalPlan = computeSignalPlan(intersections);

    const res = await resolveTrafficAdvisory({
      intersections,
      signalPlan,
      routeDecision: {
        target: 'cloud',
        reasonCode: 'MULTI_CORRIDOR_COMPLEXITY',
        explanation: 'Cloud',
        incidentClass: 'congestion',
        congestedCount: 2,
        emergencyActive: false
      },
      fetchImpl: fetchFail
    });

    expect(res.source).toBe('fallback');
    expect(res.advisory).toContain('edge fallback');
  });

  it('generates fault edge advisory and falls back on HTTP 500 or empty advisory', async () => {
    const intersections = [{ id: '1', name: 'J1', nsQueue: 10, ewQueue: 20, speedKmh: 30, fault: true }];
    const signalPlan = computeSignalPlan(intersections);

    const faultRes = await resolveTrafficAdvisory({
      intersections,
      signalPlan,
      routeDecision: {
        target: 'edge',
        reasonCode: 'OFFLINE_EDGE',
        explanation: 'Offline',
        incidentClass: 'fault',
        congestedCount: 0,
        emergencyActive: false
      }
    });
    expect(faultRes.advisory).toContain('fail-safe');

    const httpErrFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const httpFallback = await resolveTrafficAdvisory({
      intersections,
      signalPlan,
      routeDecision: {
        target: 'cloud',
        reasonCode: 'POLICY_FORCE_CLOUD',
        explanation: 'Cloud',
        incidentClass: 'normal',
        congestedCount: 0,
        emergencyActive: false
      },
      fetchImpl: httpErrFetch
    });
    expect(httpFallback.source).toBe('fallback');
  });
});
