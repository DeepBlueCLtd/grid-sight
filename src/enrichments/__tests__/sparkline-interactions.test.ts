import { describe, it, expect, beforeEach } from 'vitest';
import '../sparkline-column';
import { activateDirective, detachAll, removeDirective } from '../virtual-column';

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'spark-interactions-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Region', 'M1', 'M2', 'M3', 'M4'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  t.appendChild(thead);
  const tbody = document.createElement('tbody');
  [
    ['A', '1', '2', '3', '4'],
    ['B', '4', '3', '2', '1'],
    ['C', '2', '2', '2', '2'],
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

function getSparklineCells(table: HTMLTableElement): HTMLTableCellElement[] {
  return Array.from(
    table.querySelectorAll<HTMLTableCellElement>('td[data-gs-virtual-column="sparkline"]'),
  );
}

function getTooltip(): HTMLDivElement | null {
  return document.querySelector<HTMLDivElement>('.gs-vc-tooltip');
}

function getHighlightedHeaders(table: HTMLTableElement): string[] {
  const head = table.tHead!.rows[0];
  return Array.from(head.cells)
    .filter((c) => c.classList.contains('gs-vc-source-highlight'))
    .map((c) => c.textContent || '');
}

beforeEach(() => {
  detachAll();
  document.body.innerHTML = '';
});

describe('sparkline interactions (US4)', () => {
  it('focus shows tooltip with the row min/max/last', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const cells = getSparklineCells(table);
    expect(cells.length).toBe(3);
    cells[0].dispatchEvent(new FocusEvent('focus'));
    const tooltip = getTooltip();
    expect(tooltip).not.toBeNull();
    // First row values: 1, 2, 3, 4 → min 1, max 4, last 4.
    expect(tooltip!.textContent).toBe('min 1, max 4, last 4');
  });

  it('blur hides the tooltip and clears highlight', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const cell = getSparklineCells(table)[0];
    cell.dispatchEvent(new FocusEvent('focus'));
    expect(getTooltip()!.style.visibility).not.toBe('hidden');
    cell.dispatchEvent(new FocusEvent('blur'));
    expect(getTooltip()!.style.visibility).toBe('hidden');
    expect(getHighlightedHeaders(table)).toEqual([]);
  });

  it('hover (mouseenter/mouseleave) toggles the tooltip', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const cell = getSparklineCells(table)[1];
    cell.dispatchEvent(new MouseEvent('mouseenter'));
    expect(getTooltip()!.textContent).toBe('min 1, max 4, last 1');
    cell.dispatchEvent(new MouseEvent('mouseleave'));
    expect(getTooltip()!.style.visibility).toBe('hidden');
  });

  it('focus highlights the source numeric column headers', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const cell = getSparklineCells(table)[0];
    cell.dispatchEvent(new FocusEvent('focus'));
    expect(getHighlightedHeaders(table)).toEqual(['M1', 'M2', 'M3', 'M4']);
  });

  it('Escape dismisses the tooltip without unfocusing the cell', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const cell = getSparklineCells(table)[0];
    cell.dispatchEvent(new FocusEvent('focus'));
    expect(getTooltip()!.style.visibility).not.toBe('hidden');
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(getTooltip()!.style.visibility).toBe('hidden');
    expect(getHighlightedHeaders(table)).toEqual([]);
  });

  it('arrow keys move focus to the next/previous sparkline cell', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const cells = getSparklineCells(table);
    cells[0].focus();
    expect(document.activeElement).toBe(cells[0]);
    cells[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(cells[1]);
    cells[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(cells[0]);
  });

  it('aria-describedby links the cell to the tooltip', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const cell = getSparklineCells(table)[0];
    const describedBy = cell.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tooltip = getTooltip();
    expect(tooltip!.id).toBe(describedBy);
  });

  it('removeDirective removes the tooltip element from document.body', () => {
    const table = makeTable();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    expect(getTooltip()).not.toBeNull();
    removeDirective('spark');
    expect(getTooltip()).toBeNull();
  });
});
