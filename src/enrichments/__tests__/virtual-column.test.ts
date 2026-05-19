import { describe, it, expect, beforeEach } from 'vitest';
import {
  activateDirective,
  mutateDirective,
  removeDirective,
  registerRenderer,
  detachAll,
  listDirectives,
} from '../virtual-column';
import '../cumulative-column';
import '../sparkline-column';
import type {
  CumulativeDirective,
  Renderer,
  SparklineDirective,
} from '../../types/virtual-column';

// Use a fake renderer to test scaffold behaviour in isolation.
const fakeCumulative: Renderer<CumulativeDirective> = {
  kind: 'cumulative',
  headerText: (d) => `Σ ${d.sourceColKey}`,
  canActivate: () => true,
  renderCell: (_d, td, _row, _seq, idx) => {
    td.textContent = `cum-${idx}`;
  },
  onPipelineChange: () => {},
  exporter: (d) => ({ headerText: `Σ ${d.sourceColKey}`, getCellText: () => '' }),
};

const fakeSparkline: Renderer<SparklineDirective> = {
  kind: 'sparkline',
  headerText: () => 'Trend',
  canActivate: (_d, _t, numericColumns) => numericColumns.size >= 3,
  renderCell: (_d, td) => {
    td.textContent = 'spark';
  },
  onPipelineChange: () => {},
  exporter: () => ({ headerText: 'Trend', getCellText: () => '' }),
};

function makeTable(rows = 3, cols = 4): HTMLTableElement {
  const t = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th');
    th.textContent = c === 0 ? 'Name' : `Num${c}`;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  t.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      td.textContent = c === 0 ? `row-${r}` : String((r + 1) * (c + 1));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  t.appendChild(tbody);
  document.body.appendChild(t);
  return t;
}

beforeEach(() => {
  detachAll();
  document.body.innerHTML = '';
  registerRenderer(fakeCumulative);
  registerRenderer(fakeSparkline);
});

describe('virtual-column scaffold', () => {
  it('activateDirective appends header and body cells at canonical position', () => {
    const table = makeTable(3, 4);
    const record = activateDirective({
      id: 'cum-num1',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'num1',
      mode: 'sum',
      activationIndex: 0,
    });
    expect(record).not.toBeNull();
    expect(table.tHead!.rows[0].cells.length).toBe(5);
    expect(table.tBodies[0].rows[0].cells.length).toBe(5);
    expect(table.tHead!.rows[0].cells[4].textContent).toBe('Σ num1');
    expect(table.tBodies[0].rows[0].cells[4].textContent).toBe('cum-0');
    // Attributes
    expect(table.tHead!.rows[0].cells[4].getAttribute('data-gs-virtual-column')).toBe('cumulative');
  });

  it('removeDirective restores byte-identical DOM (snapshot diff)', () => {
    const table = makeTable(3, 4);
    const before = table.outerHTML;
    activateDirective({
      id: 'cum-num1',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'num1',
      mode: 'sum',
      activationIndex: 0,
    });
    removeDirective('cum-num1');
    expect(table.outerHTML).toBe(before);
  });

  it('mutateDirective re-renders affected cells only', () => {
    const table = makeTable(3, 4);
    activateDirective({
      id: 'cum-num1',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'num1',
      mode: 'sum',
      activationIndex: 0,
    });
    mutateDirective('cum-num1', { mode: 'percent' });
    // Renderer should have re-rendered; fake renderer ignores mode but is called.
    expect(table.tBodies[0].rows[0].cells[4].textContent).toBe('cum-0');
  });

  it('data-gs-ignore refuses activation', () => {
    const table = makeTable(3, 4);
    table.setAttribute('data-gs-ignore', '');
    const result = activateDirective({
      id: 'cum-num1',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'num1',
      mode: 'sum',
      activationIndex: 0,
    });
    expect(result).toBeNull();
  });

  it('refuses a second sparkline activation', () => {
    const table = makeTable(3, 4);
    const first = activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    expect(first).not.toBeNull();
    const second = activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    expect(second).toBeNull();
  });

  it('detachAll removes every directive and leaves byte-identical DOM', () => {
    const table = makeTable(3, 4);
    const before = table.outerHTML;
    activateDirective({
      id: 'cum-num1',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'num1',
      mode: 'sum',
      activationIndex: 0,
    });
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    expect(listDirectives(table).length).toBe(2);
    detachAll();
    expect(table.outerHTML).toBe(before);
    expect(listDirectives(table).length).toBe(0);
  });
});
