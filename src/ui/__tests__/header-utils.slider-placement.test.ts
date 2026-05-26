/**
 * Regression: enabling a slider must not displace the lozenge trigger buttons.
 *
 * The slider enrichment injects extra rows/cells (marked `data-gs-injected`)
 * into the host table. When the lozenge cluster is rebuilt afterwards (e.g. the
 * refresh path that runs when an enrichment checkbox is toggled), the buttons
 * used to land on the injected slider cells because `injectPlusIcons` indexed
 * the live DOM. They must instead land on the original header cells.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { injectPlusIcons } from '../header-utils';
import { addSlider, removeAllSliders } from '../../enrichments/slider';
import { setPageConfig, setVisitorOverride } from '../../core/enabled-set-state';

beforeEach(() => {
  document.body.innerHTML = '';
  setVisitorOverride(undefined);
  setPageConfig({ enrichments: undefined, showToggleUi: false });
});

afterEach(() => {
  const t = document.querySelector('table');
  if (t) removeAllSliders(t);
});

/** A monotonic numeric grid (both axes) — sliders are applicable. */
function makeNumericGrid(): HTMLTableElement {
  const t = document.createElement('table');
  t.innerHTML = `
    <tr><th>GS</th><th>10</th><th>20</th><th>30</th></tr>
    <tr><th>1000</th><td>4.2</td><td>5.1</td><td>5.9</td></tr>
    <tr><th>2000</th><td>3.6</td><td>4.4</td><td>5.0</td></tr>
    <tr><th>3000</th><td>3.0</td><td>3.7</td><td>4.2</td></tr>
  `;
  t.classList.add('grid-sight-enabled');
  document.body.appendChild(t);
  return t;
}

const types: Array<'numeric'> = ['numeric', 'numeric', 'numeric', 'numeric'];

describe('lozenge placement with an active slider', () => {
  it('never attaches a lozenge inside a slider-injected cell', () => {
    const t = makeNumericGrid();
    injectPlusIcons(t, types);

    // Turn on both axis sliders — this injects rows/cells into the table.
    addSlider(t, 'row');
    addSlider(t, 'col');
    expect(t.querySelectorAll('[data-gs-injected]').length).toBeGreaterThan(0);

    // Rebuild lozenges (mirrors the checkbox-refresh path).
    injectPlusIcons(t, types);

    const lozenges = t.querySelectorAll<HTMLElement>('[data-gs-lozenge-id]');
    expect(lozenges.length).toBeGreaterThan(0);
    for (const loz of Array.from(lozenges)) {
      const host = loz.closest('th, td');
      expect(host).not.toBeNull();
      expect(host!.hasAttribute('data-gs-injected')).toBe(false);
    }
  });

  it('places the statistics (#) lozenge on the real column headers', () => {
    const t = makeNumericGrid();
    addSlider(t, 'row');
    addSlider(t, 'col');
    injectPlusIcons(t, types);

    // Identify the original header row + its real cells (skip injected ones).
    const headerRow = Array.from(t.rows).find(r => !r.hasAttribute('data-gs-injected'))!;
    const realHeaderCells = Array.from(headerRow.cells).filter(
      c => !c.hasAttribute('data-gs-injected')
    );

    // Each real column header (GS top-left + 10/20/30) owns a # lozenge.
    for (const cell of realHeaderCells) {
      expect(cell.querySelector('[data-gs-lozenge-id="statistics"]')).not.toBeNull();
    }

    // The injected slider cells own none.
    for (const injected of Array.from(t.querySelectorAll('[data-gs-injected]'))) {
      expect(injected.querySelector('[data-gs-lozenge-id]')).toBeNull();
    }
  });
});
