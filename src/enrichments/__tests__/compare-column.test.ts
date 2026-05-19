import { describe, it, expect, beforeEach } from 'vitest';
import { compareHelpers } from '../compare-column';
import { activateDirective, detachAll } from '../virtual-column';

const { computeDelta, directionGlyph } = compareHelpers;

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'compare-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Region', 'Q1', 'Q4'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  t.appendChild(thead);
  const tbody = document.createElement('tbody');
  [
    ['North', '100', '190'],
    ['South', '50', '50'],
    ['East', '20', '0'],
  ].forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((v) => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  t.appendChild(tbody);
  document.body.appendChild(t);
  return t;
}

beforeEach(() => {
  detachAll();
  document.body.innerHTML = '';
});

describe('compare math', () => {
  it('absolute delta = B − A', () => {
    expect(computeDelta(100, 190, 'abs').value).toBe(90);
  });

  it('relative delta = (B − A) / A', () => {
    expect(computeDelta(100, 190, 'rel').value).toBeCloseTo(0.9);
  });

  it('percent = ((B − A) / A) * 100', () => {
    expect(computeDelta(100, 190, 'percent').value).toBeCloseTo(90);
  });

  it('zero divisor produces placeholder', () => {
    expect(computeDelta(0, 5, 'percent').placeholder).toBe(true);
    expect(computeDelta(0, 5, 'rel').placeholder).toBe(true);
  });

  it('non-numeric operand produces placeholder', () => {
    expect(computeDelta(null, 5, 'abs').placeholder).toBe(true);
    expect(computeDelta(5, null, 'abs').placeholder).toBe(true);
  });

  it('direction glyph matches sign', () => {
    expect(directionGlyph(10)).toBe('▲');
    expect(directionGlyph(-10)).toBe('▼');
    expect(directionGlyph(0)).toBe('=');
  });
});

describe('compare integration', () => {
  it('renders Δ <colB> − <colA> header and per-row deltas', () => {
    const table = makeTable();
    activateDirective({
      id: 'cmp-q1-q4',
      kind: 'compare',
      tableEl: table,
      colKeyA: 'q1',
      colKeyB: 'q4',
      mode: 'abs',
    });
    const headerCell = table.tHead!.rows[0].cells[3];
    expect(headerCell.textContent).toBe('Δ Q4 − Q1');
    const bodyText = Array.from(table.tBodies[0].rows).map((r) => r.cells[3].textContent);
    expect(bodyText[0]).toMatch(/▲/);
    expect(bodyText[1]).toMatch(/=/);
    expect(bodyText[2]).toMatch(/▼/);
  });
});
