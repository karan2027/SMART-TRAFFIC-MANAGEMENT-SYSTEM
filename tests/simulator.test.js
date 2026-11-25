import { describe, expect, it } from 'vitest';
import { computeTelemetry, getScenarioPreset, SCENARIOS } from '../src/simulator.js';
import { computeSignalPlan } from '../src/trafficEngine.js';

describe('simulator', () => {
  it('returns deep-cloned scenario presets and defaults unknown IDs to normal-flow', () => {
    const rush = getScenarioPreset('rush-hour');
    rush.intersections[0].nsQueue = 99;
    expect(SCENARIOS['rush-hour'].intersections[0].nsQueue).not.toBe(99);

    const fallback = getScenarioPreset('non-existent');
    expect(fallback.id).toBe('normal-flow');
  });

  it('computes bounded telemetry metrics', () => {
    const preset = getScenarioPreset('ambulance-corridor');
    const plan = computeSignalPlan(preset.intersections);
    const telemetry = computeTelemetry(preset.intersections, plan, {
      latencyMs: 0.4,
      egressBytes: 0,
      source: 'edge'
    });

    expect(telemetry.avgWaitReductionPct).toBeGreaterThanOrEqual(8);
    expect(telemetry.avgWaitReductionPct).toBeLessThanOrEqual(42);
    expect(telemetry.co2SavedKgHr).toBeGreaterThan(0);
    expect(telemetry.fuelSavedLHr).toBeGreaterThan(0);
    expect(telemetry.egressBytes).toBe(0);
  });
});
