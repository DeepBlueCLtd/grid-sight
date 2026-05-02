import { describe, it, expect, beforeEach } from 'vitest';
import { addSlider, removeAllSliders } from '../slider';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', location.pathname);
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1; };
  (globalThis as any).cancelAnimationFrame = () => undefined;
  removeAllSliders();
});

function makeMatchingTables(): [HTMLTableElement, HTMLTableElement] {
  const html = `
    <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
    <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
    <tr><th>2000</th><td>4</td><td>5</td><td>6</td></tr>
    <tr><th>3000</th><td>7</td><td>8</td><td>9</td></tr>
  `;
  const a = document.createElement('table'); a.id = 'A'; a.innerHTML = html;
  const b = document.createElement('table'); b.id = 'B'; b.innerHTML = html;
  document.body.appendChild(a);
  document.body.appendChild(b);
  return [a, b];
}

function makeMismatchedTable(id: string): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.id = id;
  tbl.innerHTML = `
    <tr><th></th><th>10</th><th>20</th></tr>
    <tr><th>500</th><td>1</td><td>2</td></tr>
    <tr><th>1500</th><td>3</td><td>4</td></tr>
  `;
  document.body.appendChild(tbl);
  return tbl;
}

describe('slider sync', () => {
  it('two tables with matching headers auto-sync', () => {
    const [a, b] = makeMatchingTables();
    const sA = addSlider(a, 'row');
    const sB = addSlider(b, 'row');
    expect(sA.syncKey).toBe(sB.syncKey);
    sA.setPosition(2000);
    expect(sB.position).toBeCloseTo(2000, 5);
  });

  it('mismatched headers stay independent', () => {
    const [a] = makeMatchingTables();
    const c = makeMismatchedTable('C');
    const sA = addSlider(a, 'row');
    const sC = addSlider(c, 'row');
    expect(sA.syncKey).not.toBe(sC.syncKey);
    sA.setPosition(2500);
    // sC's position must NOT have been moved by sA's drag.
    expect(sC.position).not.toBe(2500);
  });

  it('data-gs-no-sync suppresses broadcast', () => {
    const [a, b] = makeMatchingTables();
    b.setAttribute('data-gs-no-sync', '');
    const sA = addSlider(a, 'row');
    const sB = addSlider(b, 'row');
    const initialB = sB.position;
    sA.setPosition(2750);
    expect(sB.position).toBe(initialB);
  });

  it('mid-drag broadcast does not feedback-loop', () => {
    const [a, b] = makeMatchingTables();
    const sA = addSlider(a, 'row');
    const sB = addSlider(b, 'row');
    // Rapid back-and-forth — should converge to the latest input on both sides.
    sA.setPosition(2000);
    sB.setPosition(2500);
    sA.setPosition(2300);
    expect(sA.position).toBe(2300);
    expect(sB.position).toBeCloseTo(2300, 5);
  });
});
