/**
 * @fileoverview XSS-safe DOM rendering layer using strictly textContent and
 * document.createElement (never innerHTML). Maintains WCAG 2.1 AA live regions.
 */

import { SIGNAL_PHASES } from './config.js';

/**
 * Maps a signal phase constant to a human-readable label and CSS class.
 * @param {string} phase
 * @returns {{ label: string, className: string }}
 */
function getPhaseBadgeInfo(phase) {
  switch (phase) {
    case SIGNAL_PHASES.EMERGENCY_CORRIDOR:
      return { label: 'EMS CORRIDOR', className: 'phase-ems' };
    case SIGNAL_PHASES.SAFE_FLASH:
      return { label: 'SAFE FLASH', className: 'phase-fault' };
    case SIGNAL_PHASES.EW_GREEN:
      return { label: 'EW GREEN', className: 'phase-ew' };
    case SIGNAL_PHASES.NS_GREEN:
    default:
      return { label: 'NS GREEN', className: 'phase-ns' };
  }
}

/**
 * Updates header connectivity and routing engine status pills.
 * @param {Document} doc
 * @param {{ isOnline: boolean, offlineSimulation: boolean, target: 'edge' | 'cloud' }} state
 */
export function renderHeaderStatus(doc, { isOnline, offlineSimulation, target }) {
  const connBadge = doc.getElementById('connectivity-badge');
  const routeBadge = doc.getElementById('route-badge');

  if (connBadge) {
    const effectiveOnline = isOnline && !offlineSimulation;
    connBadge.textContent = effectiveOnline ? 'Link: Online' : 'Link: Offline (Edge Safe)';
    connBadge.className = `status-pill ${effectiveOnline ? 'status-online' : 'status-offline'}`;
  }

  if (routeBadge) {
    const isCloud = target === 'cloud';
    routeBadge.textContent = isCloud ? 'Engine: Cloud AI' : 'Engine: Edge';
    routeBadge.className = `status-pill ${isCloud ? 'status-cloud' : 'status-edge'}`;
  }
}

/**
 * Updates the active scenario button pressed states.
 * @param {Document} doc
 * @param {string} activeScenarioId
 */
export function renderScenarioButtons(doc, activeScenarioId) {
  const buttons = doc.querySelectorAll('.scenario-btn');
  buttons.forEach((btn) => {
    const isMatch = btn.getAttribute('data-scenario') === activeScenarioId;
    btn.classList.toggle('is-active', isMatch);
    btn.setAttribute('aria-pressed', String(isMatch));
  });
}

/**
 * Renders the hybrid decision engine banner.
 * @param {Document} doc
 * @param {import('./router.js').RouteDecision} decision
 */
export function renderDecisionBanner(doc, decision) {
  const titleEl = doc.getElementById('decision-title');
  const explEl = doc.getElementById('decision-explanation');
  const bannerEl = titleEl?.closest?.('.decision-banner');
  if (bannerEl) {
    bannerEl.setAttribute(
      'aria-live',
      decision.emergencyActive ? 'assertive' : 'polite'
    );
  }
  if (titleEl) titleEl.textContent = decision.reasonCode;
  if (explEl) explEl.textContent = decision.explanation;
}

/**
 * Renders live telemetry KPI cards.
 * @param {Document} doc
 * @param {ReturnType<import('./simulator.js').computeTelemetry>} telemetry
 */
export function renderTelemetry(doc, telemetry) {
  const map = {
    'kpi-wait': `${telemetry.avgWaitReductionPct}%`,
    'kpi-co2': `${telemetry.co2SavedKgHr} kg/hr`,
    'kpi-fuel': `${telemetry.fuelSavedLHr} L/hr`,
    'kpi-latency': `${telemetry.latencyMs} ms`,
    'kpi-egress': `${telemetry.egressBytes} B`,
    'kpi-vehicles': String(telemetry.totalVehicles)
  };

  for (const [id, value] of Object.entries(map)) {
    const el = doc.getElementById(id);
    if (el) el.textContent = value;
  }
}

/**
 * Builds a single accessible junction card element.
 * @param {Document} doc
 * @param {any} node
 * @param {any} plan
 * @param {{ onAdjustQueue: (id: string, delta: number) => void, onToggleEms: (id: string) => void, onToggleFault: (id: string) => void }} handlers
 * @returns {HTMLElement}
 */
function createJunctionCard(doc, node, plan, handlers) {
  const badgeInfo = getPhaseBadgeInfo(plan.activePhase);
  const card = doc.createElement('article');
  card.className = 'junction-card';

  const header = doc.createElement('div');
  header.className = 'junction-header';

  const title = doc.createElement('h3');
  title.className = 'junction-title';
  title.textContent = node.name;

  const badge = doc.createElement('span');
  badge.className = `phase-badge ${badgeInfo.className}`;
  badge.textContent = badgeInfo.label;
  header.append(title, badge);

  const queueLine = doc.createElement('p');
  queueLine.className = 'junction-metrics';
  queueLine.textContent = `Queues: NS ${node.nsQueue} veh | EW ${node.ewQueue} veh | Speed ${node.speedKmh} km/h`;

  const timingLine = doc.createElement('p');
  timingLine.className = 'junction-metrics';
  timingLine.textContent =
    plan.cycleSec > 0
      ? `Timing: NS ${plan.nsGreenSec}s / EW ${plan.ewGreenSec}s (Offset ${plan.offsetSec}s)`
      : 'Timing: Fail-safe 4-way flash active';

  const actions = doc.createElement('div');
  actions.className = 'junction-actions';

  const addBtn = doc.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'junction-btn';
  addBtn.textContent = '+5 NS Queue';
  addBtn.setAttribute('aria-label', `Add 5 vehicles to ${node.name} North-South queue`);
  addBtn.addEventListener('click', () => handlers.onAdjustQueue(node.id, 5));

  const emsBtn = doc.createElement('button');
  emsBtn.type = 'button';
  emsBtn.className = `junction-btn${node.hasEmergency ? ' is-active' : ''}`;
  emsBtn.textContent = node.hasEmergency ? 'Clear EMS' : 'Trigger EMS';
  emsBtn.setAttribute('aria-pressed', String(Boolean(node.hasEmergency)));
  emsBtn.addEventListener('click', () => handlers.onToggleEms(node.id));

  const faultBtn = doc.createElement('button');
  faultBtn.type = 'button';
  faultBtn.className = `junction-btn${node.fault ? ' is-active' : ''}`;
  faultBtn.textContent = node.fault ? 'Clear Fault' : 'Signal Fault';
  faultBtn.setAttribute('aria-pressed', String(Boolean(node.fault)));
  faultBtn.addEventListener('click', () => handlers.onToggleFault(node.id));

  actions.append(addBtn, emsBtn, faultBtn);
  card.append(header, queueLine, timingLine, actions);
  return card;
}

/**
 * Renders the 4-junction adaptive signal grid using safe DOM construction.
 * @param {Document} doc
 * @param {Array<any>} intersections
 * @param {Array<any>} signalPlan
 * @param {{ onAdjustQueue: (id: string, delta: number) => void, onToggleEms: (id: string) => void, onToggleFault: (id: string) => void }} handlers
 */
export function renderIntersections(doc, intersections, signalPlan, handlers) {
  const container = doc.getElementById('intersections-grid');
  if (!container) return;

  container.replaceChildren();
  intersections.forEach((node, idx) => {
    container.appendChild(createJunctionCard(doc, node, signalPlan[idx] || {}, handlers));
  });
}

/**
 * Renders the corridor advisory bullet list safely via textContent.
 * @param {Document} doc
 * @param {{ advisory: string, source: string }} result
 */
export function renderAdvisory(doc, result) {
  const sourceEl = doc.getElementById('advisory-source');
  const listEl = doc.getElementById('advisory-list');

  if (sourceEl) {
    const labelMap = {
      edge: 'Source: Edge Controller',
      cloud: 'Source: Cloud AI (Gemini)',
      cache: 'Source: Bounded LRU Cache',
      fallback: 'Source: Edge Fallback'
    };
    sourceEl.textContent = labelMap[result.source] || 'Source: Edge Controller';
  }

  if (!listEl) return;
  listEl.replaceChildren();

  const lines = result.advisory
    .split('\n')
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const li = doc.createElement('li');
    li.textContent = line;
    listEl.appendChild(li);
  });
}

/**
 * Shows or clears an accessible form validation error.
 * @param {Document} doc
 * @param {string | null} message
 */
export function renderInputError(doc, message) {
  const errEl = doc.getElementById('input-error');
  if (!errEl) return;
  if (!message) {
    errEl.hidden = true;
    errEl.textContent = '';
  } else {
    errEl.hidden = false;
    errEl.textContent = message;
  }
}
