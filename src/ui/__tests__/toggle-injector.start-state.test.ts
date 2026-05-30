/**
 * spec 015 — programmatic GS-toggle start-state.
 *
 * `activateToggle`/`deactivateToggle` are the single shared path used by both a
 * manual GS click and the per-table start-state. This suite asserts the active
 * class + `aria-expanded` flip, that lozenges are injected on activate and
 * removed on deactivate, and — the key invariant — that activate→deactivate
 * restores byte-identical original markup (FR-024, INV-4).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { injectToggle, activateToggle, deactivateToggle } from '../toggle-injector';
import { setPageConfig, setVisitorOverride } from '../../core/enabled-set-state';

beforeEach(() => {
  document.body.innerHTML = '';
  setVisitorOverride(undefined);
  setPageConfig({ enrichments: undefined, showToggleUi: false, tables: [] });
});

function makeTable(id: string): HTMLTableElement {
  const t = document.createElement('table');
  t.id = id;
  t.innerHTML = `
    <tr><th></th><th>10</th><th>20</th></tr>
    <tr><th>1000</th><td>1</td><td>2</td></tr>
    <tr><th>2000</th><td>3</td><td>4</td></tr>
  `;
  document.body.appendChild(t);
  return t;
}

function toggleBtn(table: HTMLTableElement): HTMLElement {
  return table.querySelector('.grid-sight-toggle') as HTMLElement;
}

describe('activateToggle / deactivateToggle (spec 015)', () => {
  it('activate sets the active class and aria-expanded=true and injects lozenges', () => {
    const t = makeTable('t');
    injectToggle(t);
    const btn = toggleBtn(t);
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    activateToggle(t);

    expect(btn.classList.contains('grid-sight-toggle--active')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(t.querySelectorAll('[data-gs-lozenge-id]').length).toBeGreaterThan(0);
  });

  it('deactivate clears the active state and removes lozenges', () => {
    const t = makeTable('t');
    injectToggle(t);
    activateToggle(t);
    expect(t.querySelectorAll('[data-gs-lozenge-id]').length).toBeGreaterThan(0);

    deactivateToggle(t);

    const btn = toggleBtn(t);
    expect(btn.classList.contains('grid-sight-toggle--active')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(t.querySelectorAll('[data-gs-lozenge-id]').length).toBe(0);
  });

  it('activate → deactivate restores byte-identical markup (FR-024 / INV-4)', () => {
    const t = makeTable('t');
    injectToggle(t);
    // Snapshot AFTER injectToggle (the GS corner button is the baseline that
    // a global disable would itself remove); start-state must not perturb it.
    const baseline = t.innerHTML;

    activateToggle(t);
    deactivateToggle(t);

    expect(t.innerHTML).toBe(baseline);
  });

  it('dispatches gridsight:toggle with the active flag on each transition', () => {
    const t = makeTable('t');
    injectToggle(t);
    const events: boolean[] = [];
    t.addEventListener('gridsight:toggle', (e) => {
      events.push((e as CustomEvent).detail.active);
    });

    activateToggle(t);
    deactivateToggle(t);

    expect(events).toEqual([true, false]);
  });
});
