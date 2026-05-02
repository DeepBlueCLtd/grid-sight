import { describe, it, expect, beforeEach } from 'vitest';
import { addSlider, removeAllSliders } from '../../enrichments/slider';
import { ensureHeatmapMarkerListener, refreshHeatmapMarkers } from '../heatmap-marker';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', location.pathname);
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1; };
  (globalThis as any).cancelAnimationFrame = () => undefined;
  removeAllSliders();
  ensureHeatmapMarkerListener();
});

function buildTable(): HTMLTableElement {
  const wrap = document.createElement('div');
  document.body.appendChild(wrap);
  const tbl = document.createElement('table');
  tbl.id = 'M';
  tbl.innerHTML = `
    <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
    <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
    <tr><th>2000</th><td>4</td><td>5</td><td>6</td></tr>
    <tr><th>3000</th><td>7</td><td>8</td><td>9</td></tr>
  `;
  wrap.appendChild(tbl);
  return tbl;
}

describe('heatmap marker', () => {
  it('marker appears only when both axis sliders are present', () => {
    const tbl = buildTable();
    addSlider(tbl, 'row');
    refreshHeatmapMarkers();
    expect(tbl.parentElement!.querySelector('[data-gs-marker]')).toBeNull();

    addSlider(tbl, 'col');
    refreshHeatmapMarkers();
    expect(tbl.parentElement!.querySelector('[data-gs-marker]')).not.toBeNull();
  });

  it('removes the marker when one axis slider is destroyed', () => {
    const tbl = buildTable();
    const sR = addSlider(tbl, 'row');
    addSlider(tbl, 'col');
    refreshHeatmapMarkers();
    expect(tbl.parentElement!.querySelector('[data-gs-marker]')).not.toBeNull();
    sR.destroy();
    refreshHeatmapMarkers();
    expect(tbl.parentElement!.querySelector('[data-gs-marker]')).toBeNull();
  });
});
