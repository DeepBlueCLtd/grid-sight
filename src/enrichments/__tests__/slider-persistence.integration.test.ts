import { describe, it, expect, beforeEach } from 'vitest';
import { addSlider, removeAllSliders } from '../slider';
import { writeToStorage, readFromStorage } from '../../utils/slider-persistence';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', location.pathname);
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1; };
  (globalThis as any).cancelAnimationFrame = () => undefined;
  removeAllSliders();
});

function makeTable(id = 'T'): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.id = id;
  tbl.innerHTML = `
    <tr><th></th><th>10</th><th>20</th></tr>
    <tr><th>1000</th><td>1</td><td>2</td></tr>
    <tr><th>2000</th><td>3</td><td>4</td></tr>
    <tr><th>3000</th><td>5</td><td>6</td></tr>
  `;
  document.body.appendChild(tbl);
  return tbl;
}

describe('slider persistence integration', () => {
  it('URL fragment present → restores slider position', () => {
    history.replaceState(null, '', location.pathname + '#gs.s=T#row:0.5');
    const tbl = makeTable('T');
    const s = addSlider(tbl, 'row');
    // 0.5 → midpoint of [1000..3000] = 2000
    expect(s.position).toBeCloseTo(2000, 5);
  });

  it('URL absent + localStorage present → restores from storage', () => {
    writeToStorage({ 'T#row': 0.25 });
    const tbl = makeTable('T');
    const s = addSlider(tbl, 'row');
    // 0.25 of [1000..3000] = 1500
    expect(s.position).toBeCloseTo(1500, 5);
  });

  it('Both absent → midpoint default', () => {
    const tbl = makeTable('T');
    const s = addSlider(tbl, 'row');
    expect(s.position).toBeCloseTo(2000, 5);
  });

  it('removing a slider prunes the URL and storage entries', () => {
    const tbl = makeTable('T');
    const s = addSlider(tbl, 'row');
    s.setPosition(2500);
    expect(location.hash).toContain('T#row');
    expect(readFromStorage()['T#row']).toBeDefined();
    s.destroy();
    expect(location.hash).not.toContain('T#row');
    expect(readFromStorage()['T#row']).toBeUndefined();
  });
});
