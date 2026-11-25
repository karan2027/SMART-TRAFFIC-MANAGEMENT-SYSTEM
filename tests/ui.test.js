// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../src/main.js';
import { renderAdvisory } from '../src/ui.js';

const htmlContent = readFileSync(
  path.resolve(process.cwd(), 'index.html'),
  'utf-8'
);

describe('UI & Accessibility (jsdom)', () => {
  beforeEach(() => {
    globalThis.__VITEST__ = true;
    document.documentElement.innerHTML = htmlContent;
  });

  it('includes semantic landmarks and aria-live regions', () => {
    expect(document.querySelector('header')).not.toBeNull();
    expect(document.querySelector('nav')).not.toBeNull();
    expect(document.querySelector('main')).not.toBeNull();
    expect(document.querySelector('footer')).not.toBeNull();
    expect(document.querySelectorAll('[aria-live="polite"]').length).toBeGreaterThanOrEqual(3);
  });

  it('renders advisory text safely via textContent (never executes HTML/XSS)', () => {
    renderAdvisory(document, {
      advisory: '<img src=x onerror=alert(1)> • Safe advisory line',
      source: 'edge'
    });

    const list = document.getElementById('advisory-list');
    expect(list.querySelector('img')).toBeNull();
    expect(list.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('initializes dashboard, renders 4 intersections, and switches scenarios', async () => {
    const app = initApp(document);
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelectorAll('.junction-card').length).toBe(4);
    expect(document.getElementById('route-badge').textContent).toContain('Edge');

    app.applyScenario('ambulance-corridor');
    await new Promise((r) => setTimeout(r, 20));

    expect(document.getElementById('decision-title').textContent).toBe(
      'EMERGENCY_PREEMPTION'
    );
    expect(document.querySelector('.phase-ems')).not.toBeNull();
  });

  it('handles interactive junction buttons, policy select, offline toggle, and form validation', async () => {
    initApp(document);
    await new Promise((r) => setTimeout(r, 20));

    // Click +5 NS Queue, Trigger EMS, and Signal Fault on first junction
    const firstCard = document.querySelector('.junction-card');
    const buttons = firstCard.querySelectorAll('button');
    buttons[0].click();
    await new Promise((r) => setTimeout(r, 15));
    buttons[1].click();
    await new Promise((r) => setTimeout(r, 15));
    buttons[2].click();
    await new Promise((r) => setTimeout(r, 15));
    expect(document.querySelector('.phase-fault')).not.toBeNull();

    // Toggle offline checkbox
    const offlineToggle = document.getElementById('offline-toggle');
    offlineToggle.checked = true;
    offlineToggle.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 15));
    expect(document.getElementById('connectivity-badge').textContent).toContain('Offline');

    // Change policy select
    const policySelect = document.getElementById('policy-select');
    policySelect.value = 'edge';
    policySelect.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 15));

    // Submit form with valid note
    const noteInput = document.getElementById('incident-notes');
    noteInput.value = 'Minor stall cleared';
    document.getElementById('control-form').dispatchEvent(new Event('submit'));
    await new Promise((r) => setTimeout(r, 15));
    expect(document.getElementById('input-error').hidden).toBe(true);
  });
});
