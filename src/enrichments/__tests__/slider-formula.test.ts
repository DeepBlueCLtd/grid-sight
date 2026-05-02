import { describe, it, expect, beforeEach } from 'vitest';
import { addSlider, registerFormula, clearFormula, removeAllSliders } from '../slider';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', location.pathname);
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1; };
  (globalThis as any).cancelAnimationFrame = () => undefined;
  removeAllSliders();
});

function buildTable(id = 'tF'): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.id = id;
  tbl.innerHTML = `
    <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
    <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
    <tr><th>2000</th><td>4</td><td>5</td><td>6</td></tr>
    <tr><th>3000</th><td>7</td><td>8</td><td>9</td></tr>
  `;
  document.body.appendChild(tbl);
  return tbl;
}

describe('formula readout (Story 2)', () => {
  it('register → readout appears alongside interpolated', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    expect(tbl.parentElement!.querySelector('[data-gs-slider-readout="equation"]')).toBeNull();
    registerFormula(tbl, (r) => r * 2);
    s.setPosition(2000);
    const readouts = tbl.parentElement!.querySelectorAll('[data-gs-slider-readout="equation"]');
    expect(readouts.length).toBeGreaterThan(0);
    // 2 * 2000 = 4000 — formatted by defaultFormat ≥ 1000 → toFixed(0) = "4000"
    expect(readouts[0].textContent).toContain('4000');
  });

  it('clear → readout disappears', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    registerFormula(tbl, (r) => r);
    expect(tbl.parentElement!.querySelector('[data-gs-slider-readout="equation"]')).not.toBeNull();
    clearFormula(tbl);
    expect(tbl.parentElement!.querySelector('[data-gs-slider-readout="equation"]')).toBeNull();
    void s;
  });

  it('formula throwing → "—" and slider stays usable', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    registerFormula(tbl, () => { throw new Error('boom'); });
    expect(s.handle.readoutEquation?.textContent).toBe('—');
    // slider still works
    s.setPosition(2500);
    expect(s.position).toBe(2500);
  });

  it('formula non-finite → "—"', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    registerFormula(tbl, () => Infinity);
    expect(s.handle.readoutEquation?.textContent).toBe('—');
  });

  it('two synced tables both show the equation readout', () => {
    const a = buildTable('tA');
    const b = buildTable('tB');
    const sA = addSlider(a, 'row');
    const sB = addSlider(b, 'row');
    registerFormula(a, (r) => r + 1);
    registerFormula(b, (r) => r + 2);
    sA.setPosition(2000);
    const tableA = document.getElementById('tA')!;
    const tableB = document.getElementById('tB')!;
    expect(tableA.querySelector('[data-gs-slider-readout="equation"]')!.textContent).toContain('2001');
    expect(tableB.querySelector('[data-gs-slider-readout="equation"]')!.textContent).toContain('2002');
    void sB;
  });
});
