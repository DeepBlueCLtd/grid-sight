import { describe, it, expect, beforeEach } from 'vitest';
import { sparklineHelpers } from '../sparkline-column';
import {
  activateDirective,
  mutateDirective,
  detachAll,
} from '../virtual-column';
import type { VisibleRowEntry } from '../../types/virtual-column';

const { computeSharedMax } = sparklineHelpers;

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'spark-scale-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Region', 'M1', 'M2', 'M3'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  t.appendChild(thead);
  const tbody = document.createElement('tbody');
  [
    ['A', '1', '2', '3'],
    ['B', '10', '20', '30'],
    ['C', '5', '5', '5'],
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

function getSparklineRects(table: HTMLTableElement): SVGRectElement[][] {
  return Array.from(
    table.querySelectorAll<HTMLTableCellElement>('td[data-gs-virtual-column="sparkline"]'),
  ).map((td) =>
    Array.from(td.querySelectorAll<SVGRectElement>('rect')),
  );
}

beforeEach(() => {
  detachAll();
  document.body.innerHTML = '';
});

describe('sparkline scale (US5)', () => {
  it('per-row scale uses each row\'s own max', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const rects = getSparklineRects(table);
    // Row A max 3 → tallest rect height equals full svg height
    const rowAHeights = rects[0].map((r) => parseFloat(r.getAttribute('height') || '0'));
    const rowBHeights = rects[1].map((r) => parseFloat(r.getAttribute('height') || '0'));
    // In per-row mode, both rows' tallest bars (their respective max) end up at
    // similar height (full SVG height), even though row B values are much larger.
    expect(Math.max(...rowAHeights)).toBeCloseTo(Math.max(...rowBHeights), 1);
  });

  it('shared scale uses the global max across visible rows', () => {
    const table = makeTable();
    const sequence: VisibleRowEntry[] = Array.from(table.tBodies[0].rows).map((r) => ({
      rowEl: r,
      state: 'visible',
    }));
    // Across visible rows the absolute max is 30 (row B M3).
    expect(computeSharedMax(sequence, [1, 2, 3])).toBe(30);
  });

  it('computeSharedMax ignores dimmed rows', () => {
    const table = makeTable();
    const rows = Array.from(table.tBodies[0].rows);
    const sequence: VisibleRowEntry[] = [
      { rowEl: rows[0], state: 'visible' },
      { rowEl: rows[1], state: 'dimmed' }, // 10/20/30 row excluded
      { rowEl: rows[2], state: 'visible' },
    ];
    // Largest visible value across A (max 3) and C (max 5) is 5.
    expect(computeSharedMax(sequence, [1, 2, 3])).toBe(5);
  });

  it('flipping mode mutates the directive and updates <rect> attributes in place', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const beforeRects = getSparklineRects(table);
    // Capture SVG identities so we can confirm the SVGs themselves are reused.
    const svgsBefore = Array.from(
      table.querySelectorAll<HTMLTableCellElement>('td[data-gs-virtual-column="sparkline"] svg'),
    );
    mutateDirective('spark', { scale: 'shared' });
    const svgsAfter = Array.from(
      table.querySelectorAll<HTMLTableCellElement>('td[data-gs-virtual-column="sparkline"] svg'),
    );
    // No full re-render: the <svg> elements are the same nodes.
    expect(svgsAfter.length).toBe(svgsBefore.length);
    for (let i = 0; i < svgsAfter.length; i++) {
      expect(svgsAfter[i]).toBe(svgsBefore[i]);
    }
    // Row A's tallest bar should now be shorter than the SVG height (since
    // row B's max 30 dominates the shared scale).
    const rowAHeightsAfter = Array.from(
      svgsAfter[0].querySelectorAll<SVGRectElement>('rect'),
    ).map((r) => parseFloat(r.getAttribute('height') || '0'));
    const svgHeight = parseFloat(svgsAfter[0].getAttribute('height') || '0');
    expect(Math.max(...rowAHeightsAfter)).toBeLessThan(svgHeight);
    // The <rect> count didn't change either.
    const afterRects = getSparklineRects(table);
    expect(afterRects[0].length).toBe(beforeRects[0].length);
  });

  it('toggle button renders next to the Trend header', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const header = table.querySelector('th[data-gs-virtual-column="sparkline"]')!;
    const btn = header.querySelector<HTMLButtonElement>('.gs-vc-scale-toggle');
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute('aria-pressed')).toBe('false');
    btn!.click();
    // After flipping, the new button reflects shared state.
    const btnAfter = header.querySelector<HTMLButtonElement>('.gs-vc-scale-toggle');
    expect(btnAfter!.getAttribute('aria-pressed')).toBe('true');
  });
});
