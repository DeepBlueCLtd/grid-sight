import { describe, it, expect, beforeEach } from 'vitest';
import {
  setOutlierThreshold,
  getOutlierThreshold,
  getOutlierMarks,
  tearDownOutliers,
  qualifiesForOutliers,
  isColumnInert,
} from '../outlier';
import {
  getEnrichmentDescriptor,
  type AffordanceContext,
} from '../../core/enrichment-registry';
// Side-effect: registers the `outlier` behavior (appliesTo/mount/isActive).
import '../../ui/header-utils';
import { headerRow, gridCells } from '../../core/table-grid';

function buildTable(vals: string[], opts: { id?: string } = {}): HTMLTableElement {
  const table = document.createElement('table');
  table.id = opts.id ?? `o-${Math.random().toString(36).slice(2, 8)}`;
  const body = vals.map((v, i) => `<tr><th>r${i}</th><td>${v}</td></tr>`).join('');
  table.innerHTML = `<thead><tr><th>Label</th><th>Val</th></tr></thead><tbody>${body}</tbody>`;
  document.body.appendChild(table);
  return table;
}

function ctxFor(table: HTMLTableElement, colIndex: number): AffordanceContext {
  const header = gridCells(headerRow(table)!)[colIndex] as HTMLTableCellElement;
  return { table, header, headerType: 'column', colIndex, columnType: 'numeric' };
}

function valCell(table: HTMLTableElement, value: string): HTMLTableCellElement {
  return Array.from(table.querySelectorAll('tbody td')).find(
    (c) => (c.textContent ?? '').trim() === value,
  ) as HTMLTableCellElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  history.replaceState(null, '', '/');
});

describe('setOutlierThreshold — paint at 2σ (US1)', () => {
  it('marks only the cells beyond 2σ and exposes a tooltip with value/mean/σ', () => {
    // mean 15, σ 11.25; at 2σ (cutoff 22.5) only 40 (|25|) qualifies.
    const table = buildTable(['8', '9', '10', '11', '12', '40']);
    setOutlierThreshold(table, 1, 2);

    const marks = getOutlierMarks(table, 1);
    expect(marks.map((m) => m.value)).toEqual([40]);

    const outlierCell = valCell(table, '40');
    expect(outlierCell.classList.contains('gs-outlier-cell')).toBe(true);
    expect(outlierCell.getAttribute('data-gs-outlier')).toBe('+2.2');
    expect(outlierCell.getAttribute('tabindex')).toBe('0');
    const describedBy = outlierCell.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tip = document.getElementById(describedBy!.split(' ')[0]);
    expect(tip?.textContent).toBe('value 40, mean 15.0, +2.2σ');

    // A non-outlier cell carries no marker.
    expect(valCell(table, '12').classList.contains('gs-outlier-cell')).toBe(false);
  });

  it('getOutlierThreshold reflects the active threshold', () => {
    const table = buildTable(['8', '9', '10', '11', '12', '40']);
    expect(getOutlierThreshold(table, 1)).toBeNull();
    setOutlierThreshold(table, 1, 2);
    expect(getOutlierThreshold(table, 1)).toBe(2);
    setOutlierThreshold(table, 1, null);
    expect(getOutlierThreshold(table, 1)).toBeNull();
  });
});

describe('tearDownOutliers — byte-identical DOM (SC-005)', () => {
  it('removes every class/attr/tabindex/tooltip, restoring the original markup', () => {
    const table = buildTable(['8', '9', '10', '11', '12', '40']);
    const before = table.outerHTML;

    setOutlierThreshold(table, 1, 1); // mark aggressively
    expect(table.querySelectorAll('.gs-outlier-cell').length).toBeGreaterThan(0);

    tearDownOutliers(table);
    expect(table.outerHTML).toBe(before);
    // No tooltip nodes leak into the body either.
    expect(document.querySelectorAll('.gs-outlier-tooltip').length).toBe(0);
  });
});

describe('σ = 0 (all-equal) — inert (FR-009)', () => {
  it('isColumnInert true and no cells mark', () => {
    const table = buildTable(['5', '5', '5', '5']);
    expect(qualifiesForOutliers(table, 1)).toBe(true); // ≥ 3 numeric → lozenge renders
    expect(isColumnInert(table, 1)).toBe(true);
    setOutlierThreshold(table, 1, 2); // would be a no-op via UI; defensively yields no marks
    expect(getOutlierMarks(table, 1)).toEqual([]);
    expect(table.querySelectorAll('.gs-outlier-cell').length).toBe(0);
  });
});

describe('appliesTo gate (FR-002/FR-010/FR-022)', () => {
  const appliesTo = (table: HTMLTableElement, colIndex: number) =>
    getEnrichmentDescriptor('outlier')!.behavior!.appliesTo(ctxFor(table, colIndex));

  it('true for a numeric column with ≥ 3 numeric cells', () => {
    const table = buildTable(['8', '9', '10', '11', '12', '40']);
    expect(appliesTo(table, 1)).toBe(true);
  });

  it('false for a column with < 3 numeric cells (FR-010)', () => {
    const table = buildTable(['8', 'x', 'y']);
    expect(appliesTo(table, 1)).toBe(false);
  });

  it('false when a body cell uses rowspan (FR-002)', () => {
    const table = buildTable(['8', '9', '10', '11']);
    (table.querySelector('tbody td') as HTMLTableCellElement).rowSpan = 2;
    expect(appliesTo(table, 1)).toBe(false);
  });

  it('false when the table has data-gs-no-outlier (FR-022)', () => {
    const table = buildTable(['8', '9', '10', '11']);
    table.setAttribute('data-gs-no-outlier', '');
    expect(appliesTo(table, 1)).toBe(false);
  });
});
