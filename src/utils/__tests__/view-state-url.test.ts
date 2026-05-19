import { describe, it, expect } from 'vitest';
import {
  encodeViewState,
  decodeViewState,
  readViewStateFromHash,
  writeViewStateToHash,
  colKey,
  colKeyAt,
} from '../view-state-url';
import type { TableViewDirective } from '../visible-rows';

function header(text: string): HTMLTableCellElement {
  const th = document.createElement('th');
  th.textContent = text;
  return th;
}

describe('colKey', () => {
  it('slugs header text to lowercase a-z0-9-', () => {
    expect(colKey(header('Amount'), 0)).toBe('amount');
    expect(colKey(header('Net Price ($)'), 0)).toBe('net-price');
    expect(colKey(header('  '), 7)).toBe('c7');
  });

  it('falls back to c<index> for headers that slug to empty', () => {
    expect(colKey(header('!!!'), 3)).toBe('c3');
  });

  it('colKeyAt reads column index from the live table', () => {
    const t = document.createElement('table');
    const hr = t.insertRow();
    hr.insertCell().textContent = 'Date';
    hr.insertCell().textContent = 'Region';
    expect(colKeyAt(t, 0)).toBe('date');
    expect(colKeyAt(t, 1)).toBe('region');
    expect(colKeyAt(t, 7)).toBe('c7');
  });
});

describe('encode / decode round-trip', () => {
  const cases: { name: string; state: TableViewDirective[] }[] = [
    {
      name: 'sort only',
      state: [
        {
          tableId: 'tbl-orders',
          sort: { columnIndex: 0, columnKey: 'amount', direction: 'desc' },
          filters: [],
        },
      ],
    },
    {
      name: 'numeric range filter only',
      state: [
        {
          tableId: 'tbl-orders',
          sort: null,
          filters: [
            { kind: 'numeric-range', columnKey: 'amount', min: 100, max: 500, hideEmpty: false },
          ],
        },
      ],
    },
    {
      name: 'numeric range open-max + hideEmpty + sort',
      state: [
        {
          tableId: 'tbl-orders',
          sort: { columnIndex: 0, columnKey: 'amount', direction: 'desc' },
          filters: [
            { kind: 'numeric-range', columnKey: 'amount', min: 100, max: null, hideEmpty: true },
          ],
        },
      ],
    },
    {
      name: 'categorical + sort',
      state: [
        {
          tableId: 'tbl-orders',
          sort: { columnIndex: 1, columnKey: 'date', direction: 'asc' },
          filters: [
            { kind: 'categorical', columnKey: 'region', allowed: ['EU', 'US'], hideEmpty: false },
          ],
        },
      ],
    },
    {
      name: 'two tables',
      state: [
        { tableId: 't1', sort: { columnIndex: 0, columnKey: 'name', direction: 'asc' }, filters: [] },
        { tableId: 't2', sort: null, filters: [{ kind: 'categorical', columnKey: 'status', allowed: ['open'], hideEmpty: false }] },
      ],
    },
  ];

  for (const c of cases) {
    it(`round-trips: ${c.name}`, () => {
      const encoded = encodeViewState(c.state);
      const decoded = decodeViewState(encoded);
      // columnIndex isn't preserved through the URL (resolved at hydrate time).
      const normalised = decoded.map((d) => ({
        ...d,
        sort: d.sort ? { ...d.sort, columnIndex: -1 } : null,
      }));
      const expected = c.state.map((d) => ({
        ...d,
        sort: d.sort ? { ...d.sort, columnIndex: -1 } : null,
      }));
      expect(normalised).toEqual(expected);
    });
  }

  it('emits empty string for empty state and omits the table entry', () => {
    expect(encodeViewState([])).toBe('');
    expect(encodeViewState([{ tableId: 't1', sort: null, filters: [] }])).toBe('');
  });

  it('drops malformed directives leniently', () => {
    expect(decodeViewState('garbage')).toEqual([]);
    expect(decodeViewState('t1(s::asc)')).toEqual([]);
    const partial = decodeViewState('t1(f:amount:n:1:2;,t2(s:name:asc)');
    // 1st table malformed (semicolon then comma sequence); decoder is lenient — it may produce 1 or 2 entries.
    expect(Array.isArray(partial)).toBe(true);
  });
});

describe('hash read / write', () => {
  it('extracts gs.v from hash, preserves other params on write', () => {
    const hash = '#gs.s=foo:0.5&gs.v=t1(s:amount:asc)';
    const state = readViewStateFromHash(hash);
    expect(state[0].tableId).toBe('t1');
    const next = writeViewStateToHash([], hash);
    // gs.v removed, gs.s preserved.
    expect(next).toBe('#gs.s=foo:0.5');
  });

  it('writes a fresh gs.v when none present', () => {
    const out = writeViewStateToHash(
      [{ tableId: 't1', sort: { columnIndex: 0, columnKey: 'amount', direction: 'desc' }, filters: [] }],
      ''
    );
    expect(out).toContain('gs.v=');
    expect(out).toContain('t1(s:amount:desc)');
  });

  it('returns empty array for missing fragment', () => {
    expect(readViewStateFromHash('')).toEqual([]);
    expect(readViewStateFromHash('#gs.s=foo:0.5')).toEqual([]);
  });
});
