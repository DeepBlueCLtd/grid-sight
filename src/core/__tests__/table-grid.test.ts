/**
 * Unit tests for the canonical table-grid addressing layer (spec 013).
 *
 * Covers the foundational primitives (classification, row/cell views, counts,
 * cellValue), bidirectional translation (cellAt/columnCells/headerCellFor/
 * logicalColIndexOf), logical row identity, and value purity — asserting the
 * INV-1..INV-8 invariants from data-model.md.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SCAFFOLD_ATTR,
  VIRTUAL_COL_ATTR,
  isScaffold,
  isVirtualColumn,
  gridRows,
  headerRow,
  bodyRows,
  gridCells,
  sourceCells,
  sourceColumnCount,
  gridColumnCount,
  cellAt,
  columnCells,
  headerCellFor,
  logicalColIndexOf,
  logicalRowIndexOf,
  cellValue,
} from '../table-grid';
import { removeAllSliders } from '../../enrichments/slider';
import {
  buildNumericGrid,
  captureIdentity,
  enableRowSlider,
  enableColSlider,
  addCumulativeColumn,
  applySort,
} from './helpers/grid-fixture';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  removeAllSliders();
  document.body.innerHTML = '';
});

/* ── Classification (INV-4 markers) ─────────────────────────────────── */

describe('classification', () => {
  it('isScaffold reflects the data-gs-injected attribute', () => {
    const td = document.createElement('td');
    expect(isScaffold(td)).toBe(false);
    td.setAttribute(SCAFFOLD_ATTR, '');
    expect(isScaffold(td)).toBe(true);
  });

  it('isVirtualColumn reflects the data-gs-virtual-column attribute', () => {
    const td = document.createElement('td');
    expect(isVirtualColumn(td)).toBe(false);
    td.setAttribute(VIRTUAL_COL_ATTR, 'cumulative');
    expect(isVirtualColumn(td)).toBe(true);
  });
});

/* ── Rows ───────────────────────────────────────────────────────────── */

describe('row access', () => {
  it('headerRow/bodyRows with an explicit <thead>', () => {
    const { table } = buildNumericGrid();
    const head = headerRow(table)!;
    expect(head.cells[0].textContent).toBe('GS');
    const body = bodyRows(table);
    expect(body).toHaveLength(3);
    expect(body[0].cells[0].textContent).toBe('1000');
  });

  it('headerRow/bodyRows with an implicit header (no <thead>)', () => {
    const table = document.createElement('table');
    table.innerHTML = `
      <tr><th>Name</th><th>Age</th></tr>
      <tr><td>Ann</td><td>30</td></tr>
      <tr><td>Bob</td><td>40</td></tr>
    `;
    document.body.appendChild(table);
    expect(headerRow(table)!.cells[0].textContent).toBe('Name');
    const body = bodyRows(table);
    expect(body).toHaveLength(2);
    expect(body.map((r) => r.cells[0].textContent)).toEqual(['Ann', 'Bob']);
  });

  it('excludes <tfoot> rows from the body set (and from gridRows)', () => {
    const table = document.createElement('table');
    table.innerHTML = `
      <thead><tr><th>Name</th><th>N</th></tr></thead>
      <tbody><tr><td>Ann</td><td>1</td></tr><tr><td>Bob</td><td>2</td></tr></tbody>
      <tfoot><tr><td>Total</td><td>3</td></tr></tfoot>
    `;
    document.body.appendChild(table);
    expect(bodyRows(table)).toHaveLength(2);
    const footRow = table.tFoot!.rows[0];
    expect(gridRows(table)).not.toContain(footRow);
    expect(bodyRows(table)).not.toContain(footRow);
  });

  it('keeps dimmed (filtered) rows in the body set (INV-5 support)', () => {
    const { table } = buildNumericGrid();
    const body0 = bodyRows(table);
    body0[1].classList.add('gs-row--dimmed');
    body0[1].setAttribute('data-gs-dimmed', 'true');
    expect(bodyRows(table)).toContain(body0[1]);
    expect(bodyRows(table)).toHaveLength(3);
  });

  it('excludes scaffold rows even when injected ahead of the real header (INV-2 prep)', () => {
    const { table } = buildNumericGrid();
    enableColSlider(table); // injects a scaffold top row
    enableRowSlider(table); // injects a scaffold leading header + body cell
    expect(table.querySelectorAll(`[${SCAFFOLD_ATTR}]`).length).toBeGreaterThan(0);
    expect(gridCells(headerRow(table)!)[0].textContent).toBe('GS');
    expect(bodyRows(table)).toHaveLength(3);
    for (const r of gridRows(table)) expect(isScaffold(r)).toBe(false);
  });
});

/* ── Cells + counts ─────────────────────────────────────────────────── */

describe('cell views and counts', () => {
  it('gridCells == sourceCells with no virtual columns; counts agree (INV-1/INV-4)', () => {
    const { table } = buildNumericGrid();
    const head = headerRow(table)!;
    expect(gridCells(head)).toEqual(sourceCells(head));
    expect(sourceColumnCount(table)).toBe(4);
    expect(gridColumnCount(table)).toBe(4);
  });

  it('orders virtual columns after source columns; source ⊆ grid (INV-4)', () => {
    const { table } = buildNumericGrid();
    addCumulativeColumn(table, 1);
    expect(gridColumnCount(table)).toBe(5);
    expect(sourceColumnCount(table)).toBe(4);
    const head = headerRow(table)!;
    const grid = gridCells(head);
    const source = sourceCells(head);
    // source is a prefix of grid
    expect(grid.slice(0, source.length)).toEqual(source);
    // the trailing grid cell is the virtual one
    expect(isVirtualColumn(grid[grid.length - 1])).toBe(true);
  });

  it('filters scaffold cells from both views', () => {
    const { table } = buildNumericGrid();
    enableRowSlider(table);
    for (const row of bodyRows(table)) {
      for (const c of gridCells(row)) expect(isScaffold(c)).toBe(false);
      for (const c of sourceCells(row)) expect(isScaffold(c)).toBe(false);
    }
  });
});

/* ── cellValue (INV-1 / INV-8) ──────────────────────────────────────── */

describe('cellValue', () => {
  it('returns trimmed identity text for a clean cell', () => {
    const td = document.createElement('td');
    td.textContent = '  4.2  ';
    expect(cellValue(td)).toBe('4.2');
  });

  it('strips a lozenge cluster injected into a header', () => {
    const th = document.createElement('th');
    th.textContent = '10';
    const cluster = document.createElement('span');
    cluster.className = 'gs-lozenge-cluster';
    cluster.innerHTML = '<button class="gs-lozenge" data-gs-lozenge-id="sort">↕</button>';
    th.appendChild(cluster);
    expect(cellValue(th)).toBe('10');
  });

  it('strips a slider readout injected into a cell', () => {
    const td = document.createElement('td');
    td.textContent = 'Region A';
    const readout = document.createElement('div');
    readout.setAttribute('data-gs-slider-readout', 'interpolated');
    readout.textContent = '—';
    td.appendChild(readout);
    expect(cellValue(td)).toBe('Region A');
  });

  it('does not mutate the cell it reads (INV-6)', () => {
    const th = document.createElement('th');
    th.innerHTML = '10<span class="gs-lozenge-cluster"><button class="gs-lozenge">x</button></span>';
    const before = th.innerHTML;
    cellValue(th);
    expect(th.innerHTML).toBe(before);
  });
});

/* ── Translation: cellAt / columnCells / headerCellFor / logicalColIndexOf ─ */

describe('bidirectional translation', () => {
  it('columnCells(K) is rowspan-safe under a row slider (INV-2)', () => {
    const { table } = buildNumericGrid();
    const captured = captureIdentity(table);
    enableRowSlider(table);
    enableColSlider(table);
    for (let k = 0; k < captured.sourceCols; k++) {
      const cells = columnCells(table, k);
      expect(cells).toHaveLength(3);
      for (let ri = 0; ri < 3; ri++) {
        expect(cells[ri]).toBe(captured.cellByRC.get(`${ri}:${k}`));
      }
    }
  });

  it('cellAt resolves the same author cell with and without sliders', () => {
    const { table } = buildNumericGrid();
    const before = cellAt(table, 0, 1);
    enableRowSlider(table);
    expect(cellAt(table, 0, 1)).toBe(before);
  });

  it('virtual columns are addressable after the source columns', () => {
    const { table } = buildNumericGrid();
    addCumulativeColumn(table, 1);
    const virtualCol = gridColumnCount(table) - 1; // == 4
    const cells = columnCells(table, virtualCol);
    expect(cells).toHaveLength(3);
    for (const c of cells) expect(isVirtualColumn(c)).toBe(true);
    expect(headerCellFor(table, virtualCol)).not.toBeNull();
    expect(isVirtualColumn(headerCellFor(table, virtualCol)!)).toBe(true);
  });

  it('headerCellFor returns the author header for each source column', () => {
    const { table } = buildNumericGrid();
    expect(headerCellFor(table, 0)!.textContent).toBe('GS');
    expect(headerCellFor(table, 1)!.textContent).toBe('10');
    expect(headerCellFor(table, 3)!.textContent).toBe('30');
  });

  it('headerCellFor respects an author colspan header (R-6)', () => {
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr><th colspan="2">Span</th><th>C</th></tr>
      </thead>
      <tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody>
    `;
    document.body.appendChild(table);
    const span = headerRow(table)!.cells[0];
    expect(headerCellFor(table, 0)).toBe(span);
    expect(headerCellFor(table, 1)).toBe(span); // covered slot returns same header
    expect(headerCellFor(table, 2)!.textContent).toBe('C');
  });

  it('logicalColIndexOf is the inverse of header addressing', () => {
    const { table } = buildNumericGrid();
    enableRowSlider(table);
    for (let k = 0; k < 4; k++) {
      const header = headerCellFor(table, k)!;
      expect(logicalColIndexOf(header)).toBe(k);
    }
  });

  it('out-of-range coordinates yield null/[]/-1 (INV-7)', () => {
    const { table } = buildNumericGrid();
    expect(cellAt(table, 99, 0)).toBeNull();
    expect(cellAt(table, 0, 99)).toBeNull();
    expect(cellAt(table, -1, 0)).toBeNull();
    expect(columnCells(table, 99)).toEqual([]);
    expect(columnCells(table, -1)).toEqual([]);
    expect(headerCellFor(table, 99)).toBeNull();
    const detached = document.createElement('td');
    expect(logicalColIndexOf(detached)).toBe(-1);
  });
});

/* ── Logical row identity (INV-5) ───────────────────────────────────── */

describe('logical row identity', () => {
  it('is invariant under a sort that reverses visual order (INV-5)', () => {
    const { table } = buildNumericGrid();
    const before = bodyRows(table);
    const idxBefore = before.map((r) => logicalRowIndexOf(table, r));
    expect(idxBefore).toEqual([0, 1, 2]);

    applySort(table, 1, 'asc'); // values 4.2,3.6,3.0 asc → reverses DOM order

    // DOM order changed…
    const afterDom = bodyRows(table).map((r) => r.cells[0].textContent);
    expect(afterDom).toEqual(['3000', '2000', '1000']);
    // …but each original row keeps its logical identity.
    for (const row of before) {
      const idx = logicalRowIndexOf(table, row);
      expect(idx).toBe(idxBefore[before.indexOf(row)]);
    }
  });

  it('keeps dimmed rows addressable', () => {
    const { table } = buildNumericGrid();
    const body = bodyRows(table);
    body[1].classList.add('gs-row--dimmed');
    expect(logicalRowIndexOf(table, body[1])).toBe(1);
  });

  it('returns -1 for a non-body row', () => {
    const { table } = buildNumericGrid();
    expect(logicalRowIndexOf(table, headerRow(table)!)).toBe(-1);
    const orphan = document.createElement('tr');
    expect(logicalRowIndexOf(table, orphan)).toBe(-1);
  });
});

/* ── Value purity across consumers (US4 / INV-8) ────────────────────── */

describe('value purity under injected UI', () => {
  it('cellValue stays clean for numeric and categorical cells with lozenges', () => {
    const numeric = document.createElement('th');
    numeric.innerHTML = '42<span class="gs-lozenge-cluster"><button class="gs-lozenge" data-gs-lozenge-id="statistics">#</button></span>';
    expect(cellValue(numeric)).toBe('42');

    const categorical = document.createElement('th');
    categorical.innerHTML = 'North<span class="gs-lozenge-cluster"><button class="gs-lozenge" data-gs-lozenge-id="frequency">#</button></span>';
    expect(cellValue(categorical)).toBe('North');
  });
});
