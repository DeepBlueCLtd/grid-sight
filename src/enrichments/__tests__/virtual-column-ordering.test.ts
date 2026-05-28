import { describe, it, expect, beforeEach } from 'vitest';
import '../cumulative-column';
import '../sparkline-column';
import '../compare-column';
import {
  activateDirective,
  removeDirective,
  detachAll,
} from '../virtual-column';

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'order-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Region', 'Q1', 'Q4', 'Weight'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  t.appendChild(thead);
  const tbody = document.createElement('tbody');
  [
    ['North', '100', '190', '10'],
    ['South', '80', '110', '15'],
    ['East', '60', '90', '20'],
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

function appendedKinds(table: HTMLTableElement): string[] {
  return Array.from(
    table.querySelectorAll<HTMLTableCellElement>('thead th[data-gs-virtual-column]'),
  ).map((el) => el.getAttribute('data-gs-virtual-column') || '');
}

beforeEach(() => {
  detachAll();
  document.body.innerHTML = '';
});

describe('virtual-column canonical ordering (US6)', () => {
  it('places cumulatives by activation order, then compare, then sparkline regardless of activation sequence', () => {
    const table = makeTable();
    // Activate in a non-canonical order: sparkline → compare → cumulative → cumulative.
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    activateDirective({
      id: 'cmp-q1-q4',
      kind: 'compare',
      tableEl: table,
      colKeyA: 'q1',
      colKeyB: 'q4',
      mode: 'abs',
    });
    activateDirective({
      id: 'cum-weight',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'weight',
      mode: 'sum',
      activationIndex: 0,
    });
    activateDirective({
      id: 'cum-q1',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'q1',
      mode: 'sum',
      activationIndex: 0,
    });
    expect(appendedKinds(table)).toEqual([
      'cumulative',
      'cumulative',
      'compare',
      'sparkline',
    ]);
  });

  it('removing one cumulative leaves the remaining columns in the same relative order', () => {
    const table = makeTable();
    activateDirective({
      id: 'cum-weight',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'weight',
      mode: 'sum',
      activationIndex: 0,
    });
    activateDirective({
      id: 'cum-q1',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'q1',
      mode: 'sum',
      activationIndex: 0,
    });
    activateDirective({
      id: 'cmp-q1-q4',
      kind: 'compare',
      tableEl: table,
      colKeyA: 'q1',
      colKeyB: 'q4',
      mode: 'abs',
    });
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    expect(appendedKinds(table)).toEqual([
      'cumulative',
      'cumulative',
      'compare',
      'sparkline',
    ]);
    removeDirective('cum-weight');
    expect(appendedKinds(table)).toEqual([
      'cumulative',
      'compare',
      'sparkline',
    ]);
  });

  it('cumulative activation order is preserved across removes and re-adds', () => {
    const table = makeTable();
    activateDirective({
      id: 'cum-weight',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'weight',
      mode: 'sum',
      activationIndex: 0,
    });
    activateDirective({
      id: 'cum-q1',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'q1',
      mode: 'sum',
      activationIndex: 0,
    });
    // Each header should keep its column-source label after detach + re-add.
    const headerLabels = (): string[] =>
      Array.from(
        table.querySelectorAll<HTMLTableCellElement>(
          'thead th[data-gs-virtual-column="cumulative"]',
        ),
      ).map((c) => c.textContent || '');
    expect(headerLabels()).toEqual(['Σ Weight', 'Σ Q1']);
    removeDirective('cum-weight');
    expect(headerLabels()).toEqual(['Σ Q1']);
    activateDirective({
      id: 'cum-weight',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'weight',
      mode: 'sum',
      activationIndex: 0,
    });
    // Re-added cumulative gets a fresh activationIndex → goes to the right of cum-q1.
    expect(headerLabels()).toEqual(['Σ Q1', 'Σ Weight']);
  });
});
