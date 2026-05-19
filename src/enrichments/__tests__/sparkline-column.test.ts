import { describe, it, expect, beforeEach } from 'vitest';
import { sparklineRenderer } from '../sparkline-column';
import { activateDirective, detachAll } from '../virtual-column';

function makeTable(numCols = 4): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'spark-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const headers = ['Name', ...Array.from({ length: numCols }, (_, i) => `M${i + 1}`)];
  headers.forEach((h) => {
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
  ].forEach((row) => {
    const tr = document.createElement('tr');
    row.slice(0, numCols + 1).forEach((v) => {
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

describe('sparkline-column', () => {
  it('headerText is "Trend"', () => {
    expect(sparklineRenderer.headerText({
      id: 'spark',
      kind: 'sparkline',
      tableEl: document.createElement('table'),
      scale: 'per-row',
      style: 'bar',
    })).toBe('Trend');
  });

  it('canActivate refuses tables with < 3 numeric columns', () => {
    const numericColumns = new Set<string>(['a', 'b']);
    const ok = sparklineRenderer.canActivate?.(
      {
        id: 'spark',
        kind: 'sparkline',
        tableEl: document.createElement('table'),
        scale: 'per-row',
        style: 'bar',
      },
      document.createElement('table'),
      numericColumns,
    );
    expect(ok).toBe(false);
  });

  it('appends an <svg role="img" aria-label="..."> with non-empty label', () => {
    const table = makeTable(4);
    const r = activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    expect(r).not.toBeNull();
    const cell = table.tBodies[0].rows[0].cells[5];
    const svg = cell.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('role')).toBe('img');
    expect(svg!.getAttribute('aria-label')).toMatch(/min|max|last/);
  });

  it('exporter returns min/max/last triple', () => {
    const table = makeTable(4);
    const directive = {
      id: 'spark',
      kind: 'sparkline' as const,
      tableEl: table,
      scale: 'per-row' as const,
      style: 'bar' as const,
    };
    const exporter = sparklineRenderer.exporter(directive);
    const text = exporter.getCellText(table.tBodies[0].rows[0]);
    expect(text).toMatch(/^min:.*max:.*last:.*$/);
  });
});
