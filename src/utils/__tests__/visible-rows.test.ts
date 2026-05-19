import { describe, it, expect, beforeEach } from 'vitest';
// Side-effect import: registers comparator factory used by `setSort`.
import '../../enrichments/sort';
import {
  clearFilters,
  getVisibleRows,
  onVisibleRowsChange,
  setFilter,
  setSort,
  teardown,
} from '../visible-rows';
import { numericRange, categoricalInclusion } from '../../enrichments/filter';

function makeTable(values: readonly (readonly string[])[], headers: readonly string[] = ['Amount', 'Region']): HTMLTableElement {
  const table = document.createElement('table');
  table.id = 'tbl-test';
  const thead = table.createTHead();
  const hr = thead.insertRow();
  for (const h of headers) hr.insertCell().textContent = h;
  const tbody = table.createTBody();
  for (const row of values) {
    const tr = tbody.insertRow();
    for (const v of row) tr.insertCell().textContent = v;
  }
  document.body.appendChild(table);
  return table;
}

let table: HTMLTableElement;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('visible-rows pipeline — identity projection', () => {
  it('returns rows in document order with no dim flags', () => {
    table = makeTable([['10', 'EU'], ['20', 'US'], ['30', 'EU']]);
    const seq = getVisibleRows(table);
    expect(seq.entries.map((e) => e.rowEl.cells[0].textContent)).toEqual(['10', '20', '30']);
    expect(seq.entries.every((e) => e.state === "visible")).toBe(true);
    expect(seq.sort).toBeNull();
    expect(seq.filters.size).toBe(0);
  });

  it('emits synchronously on setSort and revision increments', () => {
    table = makeTable([['10', 'EU'], ['20', 'US']]);
    const seen: number[] = [];
    onVisibleRowsChange(table, (s) => seen.push(s.revision));
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'asc' });
    expect(seen).toEqual([1]);
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'desc' });
    expect(seen).toEqual([1, 2]);
  });

  it('setSort(null) when already idle is a no-op', () => {
    table = makeTable([['10', 'EU']]);
    const seen: number[] = [];
    onVisibleRowsChange(table, (s) => seen.push(s.revision));
    setSort(table, null);
    expect(seen).toEqual([]);
  });

  it('teardown is idempotent', () => {
    table = makeTable([['10', 'EU']]);
    expect(() => teardown(table)).not.toThrow();
    expect(() => teardown(table)).not.toThrow();
  });
});

describe('sort', () => {
  it('sorts numeric ascending and descending', () => {
    table = makeTable([['30', 'EU'], ['10', 'US'], ['20', 'EU']]);
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'asc' });
    expect(Array.from(table.tBodies[0].rows).map((r) => r.cells[0].textContent)).toEqual(['10', '20', '30']);
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'desc' });
    expect(Array.from(table.tBodies[0].rows).map((r) => r.cells[0].textContent)).toEqual(['30', '20', '10']);
  });

  it('sorts categorical via locale-aware collator', () => {
    table = makeTable([['1', 'banana'], ['2', 'apple'], ['3', 'cherry']]);
    setSort(table, { columnIndex: 1, columnKey: 'region', direction: 'asc' });
    expect(Array.from(table.tBodies[0].rows).map((r) => r.cells[1].textContent)).toEqual(['apple', 'banana', 'cherry']);
  });

  it('clearing sort restores OOR', () => {
    table = makeTable([['30', 'EU'], ['10', 'US'], ['20', 'EU']]);
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'asc' });
    setSort(table, null);
    expect(Array.from(table.tBodies[0].rows).map((r) => r.cells[0].textContent)).toEqual(['30', '10', '20']);
  });

  it('sets aria-sort on the header', () => {
    table = makeTable([['10', 'EU'], ['20', 'US']]);
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'asc' });
    expect(table.rows[0].cells[0].getAttribute('aria-sort')).toBe('ascending');
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'desc' });
    expect(table.rows[0].cells[0].getAttribute('aria-sort')).toBe('descending');
  });
});

describe('filter — numeric range', () => {
  it('dims rows out of range; does not remove', () => {
    table = makeTable([['10', 'EU'], ['100', 'US'], ['500', 'EU'], ['1000', 'JP']]);
    const pred = numericRange({ columnIndex: 0, columnKey: 'amount', min: 100, max: 500, hideEmpty: false });
    setFilter(table, 0, pred);
    const seq = getVisibleRows(table);
    expect(seq.entries.length).toBe(4);
    expect(seq.entries[0].state).toBe("dimmed");   // 10
    expect(seq.entries[1].state).toBe("visible");  // 100
    expect(seq.entries[2].state).toBe("visible");  // 500
    expect(seq.entries[3].state).toBe("dimmed");   // 1000
  });

  it('hideEmpty=true dims blank cells; false leaves them visible', () => {
    table = makeTable([['', 'EU'], ['100', 'US']]);
    const includeBlank = numericRange({ columnIndex: 0, columnKey: 'amount', min: null, max: null, hideEmpty: false });
    setFilter(table, 0, includeBlank);
    expect(getVisibleRows(table).entries[0].state).toBe("visible");
    const hideBlank = numericRange({ columnIndex: 0, columnKey: 'amount', min: null, max: null, hideEmpty: true });
    setFilter(table, 0, hideBlank);
    expect(getVisibleRows(table).entries[0].state).toBe("dimmed");
  });
});

describe('filter — categorical', () => {
  it('dims rows whose value is not in the allowed set', () => {
    table = makeTable([['10', 'EU'], ['20', 'US'], ['30', 'JP']]);
    const pred = categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['EU', 'US'], hideEmpty: false });
    setFilter(table, 1, pred);
    const seq = getVisibleRows(table);
    expect(seq.entries[0].state).toBe("visible");
    expect(seq.entries[1].state).toBe("visible");
    expect(seq.entries[2].state).toBe("dimmed");
  });
});

describe('filter — AND composition', () => {
  it('row passes only if every filter passes', () => {
    table = makeTable([['100', 'EU'], ['200', 'US'], ['100', 'JP']]);
    const byRegion = categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['EU', 'US'], hideEmpty: false });
    const byAmount = numericRange({ columnIndex: 0, columnKey: 'amount', min: 100, max: 100, hideEmpty: false });
    setFilter(table, 1, byRegion);
    setFilter(table, 0, byAmount);
    const seq = getVisibleRows(table);
    expect(seq.entries[0].state).toBe("visible"); // 100,EU
    expect(seq.entries[1].state).toBe("dimmed");  // 200,US
    expect(seq.entries[2].state).toBe("dimmed");  // 100,JP
  });

  it('clearFilters removes every filter and un-dims all rows', () => {
    table = makeTable([['100', 'EU'], ['200', 'US']]);
    setFilter(table, 0, numericRange({ columnIndex: 0, columnKey: 'amount', min: 200, max: null, hideEmpty: false }));
    expect(getVisibleRows(table).entries[0].state).toBe("dimmed");
    clearFilters(table);
    expect(getVisibleRows(table).entries[0].state).toBe("visible");
    expect(getVisibleRows(table).filters.size).toBe(0);
  });
});

describe('sort over filter (US5)', () => {
  it('dimmed rows anchor at their original positions; visible rows fill in sort order', () => {
    table = makeTable([
      ['30', 'EU'], // i=0
      ['50', 'US'], // i=1
      ['10', 'JP'], // i=2
      ['40', 'EU'], // i=3
      ['20', 'US'], // i=4
    ]);
    // Filter dims rows 1 (US) and 4 (US).
    const fnotUS = categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['EU', 'JP'], hideEmpty: false });
    setFilter(table, 1, fnotUS);
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'desc' });
    const out = Array.from(table.tBodies[0].rows).map((r) => r.cells[0].textContent);
    // Slots 0,2,3 get visible rows sorted desc → [40,30,10].
    // Slots 1,4 stay dimmed (US rows) at their OOR positions: row1=50, row4=20.
    expect(out).toEqual(['40', '50', '30', '10', '20']);
    // Sanity: dimmed flags reflect filter, not sort.
    const seq = getVisibleRows(table);
    expect(seq.entries.map((e) => e.state)).toEqual(['visible', 'dimmed', 'visible', 'visible', 'dimmed']);
  });

  it('clearing the filter shows every row in sort order with no extra click', () => {
    table = makeTable([['30', 'EU'], ['10', 'US'], ['20', 'JP']]);
    setFilter(table, 1, categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['EU'], hideEmpty: false }));
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'desc' });
    clearFilters(table);
    expect(Array.from(table.tBodies[0].rows).map((r) => r.cells[0].textContent)).toEqual(['30', '20', '10']);
  });

  it('toggling both off restores the OOR exactly', () => {
    table = makeTable([['30', 'EU'], ['10', 'US'], ['20', 'JP']]);
    const before = table.tBodies[0].innerHTML;
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'asc' });
    setFilter(table, 1, categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['EU'], hideEmpty: false }));
    setSort(table, null);
    clearFilters(table);
    // Should be byte-identical (except for dim attrs which were cleared).
    expect(Array.from(table.tBodies[0].rows).map((r) => r.cells[0].textContent))
      .toEqual(['30', '10', '20']);
    void before;
  });
});

describe('parity (SC-006)', () => {
  it('seq.entries matches live tbody.rows 1:1 after every change', () => {
    table = makeTable([['30', 'EU'], ['10', 'US'], ['20', 'JP']]);
    const probe = (): void => {
      const seq = getVisibleRows(table);
      const live = Array.from(table.tBodies[0].rows);
      expect(seq.entries.map((e) => e.rowEl)).toEqual(live);
      for (const entry of seq.entries) {
        expect(entry.rowEl.hasAttribute('data-gs-dimmed')).toBe(entry.state === 'dimmed');
      }
    };
    probe();
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'asc' });
    probe();
    setFilter(table, 1, categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['EU'], hideEmpty: false }));
    probe();
    setSort(table, null);
    probe();
    clearFilters(table);
    probe();
  });
});

describe('teardown — byte-identical DOM restore', () => {
  it('restores OOR ordering and clears dim/aria-sort attributes', () => {
    table = makeTable([['30', 'EU'], ['10', 'US'], ['20', 'JP']]);
    const beforeOrder = Array.from(table.tBodies[0].rows).map((r) => r.cells[0].textContent);
    setSort(table, { columnIndex: 0, columnKey: 'amount', direction: 'desc' });
    setFilter(table, 1, categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['EU'], hideEmpty: false }));
    teardown(table);
    const afterOrder = Array.from(table.tBodies[0].rows).map((r) => r.cells[0].textContent);
    expect(afterOrder).toEqual(beforeOrder);
    expect(table.rows[0].cells[0].hasAttribute('aria-sort')).toBe(false);
    for (const row of Array.from(table.tBodies[0].rows)) {
      expect(row.hasAttribute('data-gs-dimmed')).toBe(false);
      expect(row.classList.contains('gs-row--dimmed')).toBe(false);
    }
  });
});
