/**
 * Merged-header interpolation: a table with a banner/grouping header row (speed
 * vs length matrix) must still be recognised as suitable and offer the slider
 * (interpolation) enrichment through the real activation path.
 *
 * Two author permutations are covered:
 *   1. A full-width `<th colspan="N">` banner above the numeric column headers;
 *      the leaf header row carries the "Speed Knots" corner + length headers.
 *   2. A `<th rowspan="2">Speed Knots</th>` corner beside a `<th colspan="N">`
 *      banner; the leaf header row is ALL length headers (no corner cell), with
 *      its cells shifted right by the rowspan.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { injectToggle, activateToggle, deactivateToggle } from '../toggle-injector';
import { setPageConfig, setVisitorOverride } from '../../core/enabled-set-state';
import { removeAllSliders } from '../../enrichments/slider';

beforeEach(() => {
  document.body.innerHTML = '';
  setVisitorOverride(undefined);
  setPageConfig({ enrichments: undefined, showToggleUi: false, tables: [] });
});

afterEach(() => {
  const t = document.querySelector('table');
  if (t) removeAllSliders(t);
});

function bannerColspanTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'perm1';
  t.innerHTML = `
    <thead>
      <tr><th colspan="4">Length Overall (m)</th></tr>
      <tr><th>Speed Knots</th><th>10</th><th>20</th><th>30</th></tr>
    </thead>
    <tbody>
      <tr><th>10</th><td>1</td><td>2</td><td>3</td></tr>
      <tr><th>20</th><td>4</td><td>5</td><td>6</td></tr>
      <tr><th>30</th><td>7</td><td>8</td><td>9</td></tr>
    </tbody>`;
  document.body.appendChild(t);
  return t;
}

function rowspanCornerTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'perm2';
  t.innerHTML = `
    <thead>
      <tr><th rowspan="2">Speed Knots</th><th colspan="3">Length Overall (m)</th></tr>
      <tr><th>10</th><th>20</th><th>30</th></tr>
    </thead>
    <tbody>
      <tr><th>10</th><td>1</td><td>2</td><td>3</td></tr>
      <tr><th>20</th><td>4</td><td>5</td><td>6</td></tr>
      <tr><th>30</th><td>7</td><td>8</td><td>9</td></tr>
    </tbody>`;
  document.body.appendChild(t);
  return t;
}

function sliderLozenge(t: HTMLTableElement): HTMLElement | null {
  return t.querySelector('[data-gs-lozenge-id="sliders"]');
}

describe('interpolation on merged-header tables', () => {
  it('offers the slider lozenge for a full-width banner header (permutation 1)', () => {
    const t = bannerColspanTable();
    injectToggle(t);
    activateToggle(t);
    const slider = sliderLozenge(t);
    expect(slider).not.toBeNull();
    // Enabled (not the "no numeric axis" disabled state).
    expect(slider!.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('offers the slider lozenge for a rowspan corner + banner header (permutation 2)', () => {
    const t = rowspanCornerTable();
    injectToggle(t);
    activateToggle(t);
    const slider = sliderLozenge(t);
    expect(slider).not.toBeNull();
    expect(slider!.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('activate → deactivate restores byte-identical markup (INV-4)', () => {
    const t = rowspanCornerTable();
    injectToggle(t);
    const baseline = t.innerHTML;
    activateToggle(t);
    deactivateToggle(t);
    expect(t.innerHTML).toBe(baseline);
  });
});
