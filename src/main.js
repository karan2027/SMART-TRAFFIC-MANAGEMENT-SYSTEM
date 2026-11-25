/**
 * @fileoverview Application bootstrap and event wiring for CorridorFlow AI.
 */

import { POLICY_MODES } from './config.js';
import { decideRoute } from './router.js';
import { computeTelemetry, getScenarioPreset } from './simulator.js';
import { computeSignalPlan, resolveTrafficAdvisory } from './trafficEngine.js';
import {
  renderAdvisory,
  renderDecisionBanner,
  renderHeaderStatus,
  renderInputError,
  renderIntersections,
  renderScenarioButtons,
  renderTelemetry
} from './ui.js';
import { BoundedCache, clampInt, validateIncidentNote } from './utils.js';

/**
 * Initializes the interactive dashboard on the provided Document.
 * @param {Document} [doc=document]
 */
export function initApp(doc = document) {
  const cache = new BoundedCache();
  let currentPreset = getScenarioPreset('normal-flow');

  const state = {
    scenarioId: currentPreset.id,
    intersections: currentPreset.intersections,
    weatherPenalty: currentPreset.weatherPenalty,
    offlineSimulation: currentPreset.offlineSimulation,
    policy: POLICY_MODES.AUTO,
    incidentNotes: ''
  };

  const policySelect = doc.getElementById('policy-select');
  const offlineToggle = doc.getElementById('offline-toggle');
  const noteInput = doc.getElementById('incident-notes');
  const controlForm = doc.getElementById('control-form');
  const scenarioContainer = doc.getElementById('scenario-buttons');

  async function refreshDashboard() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    const signalPlan = computeSignalPlan(state.intersections, {
      weatherPenalty: state.weatherPenalty
    });

    const routeDecision = decideRoute({
      intersections: state.intersections,
      incidentNotes: state.incidentNotes,
      policy: state.policy,
      isOnline,
      offlineSimulation: state.offlineSimulation
    });

    renderHeaderStatus(doc, {
      isOnline,
      offlineSimulation: state.offlineSimulation,
      target: routeDecision.target
    });
    renderScenarioButtons(doc, state.scenarioId);
    renderDecisionBanner(doc, routeDecision);
    renderIntersections(doc, state.intersections, signalPlan, {
      onAdjustQueue(id, delta) {
        state.intersections = state.intersections.map((n) =>
          n.id === id ? { ...n, nsQueue: clampInt(n.nsQueue + delta, 0, 60, n.nsQueue) } : n
        );
        void refreshDashboard();
      },
      onToggleEms(id) {
        state.intersections = state.intersections.map((n) =>
          n.id === id ? { ...n, hasEmergency: !n.hasEmergency } : n
        );
        void refreshDashboard();
      },
      onToggleFault(id) {
        state.intersections = state.intersections.map((n) =>
          n.id === id ? { ...n, fault: !n.fault } : n
        );
        void refreshDashboard();
      }
    });

    const advisoryResult = await resolveTrafficAdvisory({
      intersections: state.intersections,
      signalPlan,
      routeDecision,
      incidentNotes: state.incidentNotes,
      scenarioId: state.scenarioId,
      cache
    });

    const telemetry = computeTelemetry(state.intersections, signalPlan, advisoryResult);
    renderTelemetry(doc, telemetry);
    renderAdvisory(doc, advisoryResult);
  }

  function applyScenario(scenarioId) {
    currentPreset = getScenarioPreset(scenarioId);
    state.scenarioId = currentPreset.id;
    state.intersections = currentPreset.intersections;
    state.weatherPenalty = currentPreset.weatherPenalty;
    state.offlineSimulation = currentPreset.offlineSimulation;
    state.incidentNotes = currentPreset.defaultNote;

    if (offlineToggle) offlineToggle.checked = state.offlineSimulation;
    if (noteInput) noteInput.value = state.incidentNotes;
    renderInputError(doc, null);
    void refreshDashboard();
  }

  scenarioContainer?.addEventListener('click', (event) => {
    const btn = event.target?.closest?.('.scenario-btn');
    if (!btn) return;
    const scenarioId = btn.getAttribute('data-scenario');
    if (scenarioId) applyScenario(scenarioId);
  });

  policySelect?.addEventListener('change', () => {
    state.policy = policySelect.value;
    void refreshDashboard();
  });

  offlineToggle?.addEventListener('change', () => {
    state.offlineSimulation = Boolean(offlineToggle.checked);
    void refreshDashboard();
  });

  controlForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawNote = noteInput ? noteInput.value : '';
    const validation = validateIncidentNote(rawNote);
    if (!validation.valid) {
      renderInputError(doc, validation.error || 'Invalid input.');
      return;
    }
    renderInputError(doc, null);
    state.incidentNotes = validation.sanitized;
    void refreshDashboard();
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void refreshDashboard());
    window.addEventListener('offline', () => void refreshDashboard());
  }

  void refreshDashboard();
  return { refreshDashboard, applyScenario };
}

if (typeof document !== 'undefined' && !globalThis.__VITEST__) {
  initApp(document);
}
