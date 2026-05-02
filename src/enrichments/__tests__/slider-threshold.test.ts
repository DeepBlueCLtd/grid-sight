import { describe, it, expect, beforeEach } from 'vitest';
import { addThresholdSlider } from '../slider-threshold';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', location.pathname);
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1; };
  (globalThis as any).cancelAnimationFrame = () => undefined;
});

function buildHeatmapTable(): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.id = 'TH';
  tbl.innerHTML = `
    <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
    <tr><th>1000</th><td class="gs-heatmap-cell">10</td><td class="gs-heatmap-cell">20</td><td class="gs-heatmap-cell">30</td></tr>
    <tr><th>2000</th><td class="gs-heatmap-cell">40</td><td class="gs-heatmap-cell">50</td><td class="gs-heatmap-cell">60</td></tr>
    <tr><th>3000</th><td class="gs-heatmap-cell">70</td><td class="gs-heatmap-cell">80</td><td class="gs-heatmap-cell">90</td></tr>
  `;
  document.body.appendChild(tbl);
  return tbl;
}

describe('threshold slider (Story 4)', () => {
  it('throws when heatmap is not enabled', () => {
    const tbl = document.createElement('table');
    tbl.innerHTML = `<tr><th></th><th>1</th></tr><tr><th>1</th><td>1</td></tr>`;
    document.body.appendChild(tbl);
    expect(() => addThresholdSlider(tbl)).toThrow('Heatmap not enabled');
  });

  it('threshold below all values → no cell faded', () => {
    const tbl = buildHeatmapTable();
    const s = addThresholdSlider(tbl);
    s.setPosition(0); // below min (10)
    const faded = tbl.querySelectorAll('[data-gs-cell-fade]');
    expect(faded.length).toBe(0);
  });

  it('threshold at slider max → only the topmost cells stay unfaded', () => {
    const tbl = buildHeatmapTable();
    const s = addThresholdSlider(tbl);
    s.setPosition(100); // clamps to max (90); cell with value 90 stays, others fade
    const faded = tbl.querySelectorAll('[data-gs-cell-fade]');
    expect(faded.length).toBe(8);
  });

  it('mid threshold partitions cells correctly', () => {
    const tbl = buildHeatmapTable();
    const s = addThresholdSlider(tbl);
    s.setPosition(50);
    const faded = tbl.querySelectorAll('[data-gs-cell-fade]');
    // values 10, 20, 30, 40 are < 50 → faded (4 cells)
    expect(faded.length).toBe(4);
  });

  it('removal restores cells and removes the slider DOM', () => {
    const tbl = buildHeatmapTable();
    const s = addThresholdSlider(tbl);
    s.setPosition(50);
    s.destroy();
    expect(tbl.querySelectorAll('[data-gs-cell-fade]').length).toBe(0);
    expect(document.querySelector('[data-gs-slider-axis="threshold"]')).toBeNull();
  });
});
