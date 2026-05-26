import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  cellIdentity,
  identityKey,
  parseIdentityKey,
  isOptedOut,
  resolveCell,
  __resetIdentityWarnings,
} from '../annotation-identity';

function makeTable(html: string): HTMLTableElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const table = wrap.querySelector('table') as HTMLTableElement;
  document.body.appendChild(table);
  return table;
}

beforeEach(() => {
  document.body.innerHTML = '';
  __resetIdentityWarnings();
});

describe('cellIdentity — triple derivation', () => {
  it('derives (tableKey, rowKey, columnKey) from data attributes and headers', () => {
    const table = makeTable(`
      <table data-gs-key="sales">
        <thead><tr><th>Region</th><th>Q3</th></tr></thead>
        <tbody>
          <tr data-gs-row-key="acme"><th scope="row">Acme</th><td>1200</td></tr>
        </tbody>
      </table>`);
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    const id = cellIdentity(cell);
    expect(id).toEqual({ tableKey: 'sales', rowKey: 'acme', columnKey: 'q3' });
  });

  it('memoises the identity per cell (stable across position changes)', () => {
    const table = makeTable(`
      <table id="t"><tbody>
        <tr><th scope="row">Acme</th><td>1</td></tr>
        <tr><th scope="row">Globex</th><td>2</td></tr>
      </tbody></table>`);
    const cell = table.querySelectorAll('tbody td')[0] as HTMLTableCellElement;
    const before = cellIdentity(cell);
    // Reorder rows; memoised identity must not change.
    const tbody = table.tBodies[0];
    tbody.insertBefore(tbody.rows[1], tbody.rows[0]);
    const after = cellIdentity(cell);
    expect(after).toEqual(before);
  });
});

describe('tableKey preference order', () => {
  it('prefers data-gs-key over id over caption', () => {
    const t = makeTable(`<table data-gs-key="kk" id="ii"><caption>Cap</caption><tbody><tr><td>x</td></tr></tbody></table>`);
    expect(cellIdentity(t.querySelector('td')!).tableKey).toBe('kk');
  });
  it('falls back to id when no data-gs-key', () => {
    const t = makeTable(`<table id="my-id"><caption>Cap</caption><tbody><tr><td>x</td></tr></tbody></table>`);
    expect(cellIdentity(t.querySelector('td')!).tableKey).toBe('my-id');
  });
  it('falls back to slug(caption) when no key or id', () => {
    const t = makeTable(`<table><caption>Quarterly Sales</caption><tbody><tr><td>x</td></tr></tbody></table>`);
    expect(cellIdentity(t.querySelector('td')!).tableKey).toBe('quarterly-sales');
  });
});

describe('rowKey fallbacks', () => {
  it('prefers data-gs-row-key, then first-cell text, then index', () => {
    const t = makeTable(`<table id="t"><tbody>
      <tr data-gs-row-key="rk"><td>first</td><td>a</td></tr>
      <tr><th scope="row">Globex</th><td>b</td></tr>
      <tr><td></td><td>c</td></tr>
    </tbody></table>`);
    const rows = t.querySelectorAll('tbody tr');
    expect(cellIdentity(rows[0].querySelectorAll('td')[1] as HTMLTableCellElement).rowKey).toBe('rk');
    expect(cellIdentity(rows[1].querySelector('td') as HTMLTableCellElement).rowKey).toBe('globex');
    expect(cellIdentity(rows[2].querySelectorAll('td')[1] as HTMLTableCellElement).rowKey).toBe('r2');
  });
});

describe('slug rules', () => {
  it('lowercases and collapses non-alphanumerics to single hyphens', () => {
    const t = makeTable(`<table data-gs-key="  Hello,  World!! "><tbody><tr><td>x</td></tr></tbody></table>`);
    expect(cellIdentity(t.querySelector('td')!).tableKey).toBe('hello-world');
  });
});

describe('identityKey / parseIdentityKey round-trip', () => {
  it('serialises and parses', () => {
    const id = { tableKey: 'sales', rowKey: 'acme', columnKey: 'q3' };
    expect(identityKey(id)).toBe('sales/acme/q3');
    expect(parseIdentityKey('sales/acme/q3')).toEqual(id);
  });
  it('rejects malformed keys', () => {
    expect(parseIdentityKey('only/two')).toBeNull();
    expect(parseIdentityKey('a/b/c/d')).toBeNull();
    expect(parseIdentityKey('Bad/Key/UPPER')).toBeNull();
  });
});

describe('isOptedOut', () => {
  it('detects data-gs-no-annotate / data-gs-ignore on cell or table', () => {
    const t1 = makeTable(`<table id="t"><tbody><tr><td data-gs-no-annotate>x</td></tr></tbody></table>`);
    expect(isOptedOut(t1.querySelector('td')!)).toBe(true);
    const t2 = makeTable(`<table id="t2" data-gs-ignore><tbody><tr><td>x</td></tr></tbody></table>`);
    expect(isOptedOut(t2.querySelector('td')!)).toBe(true);
    const t3 = makeTable(`<table id="t3"><tbody><tr><td>x</td></tr></tbody></table>`);
    expect(isOptedOut(t3.querySelector('td')!)).toBe(false);
  });
});

describe('resolveCell', () => {
  it('returns the live cell for a triple, or null when missing', () => {
    const t = makeTable(`<table data-gs-key="sales">
      <thead><tr><th>Region</th><th>Q3</th></tr></thead>
      <tbody><tr><th scope="row">Acme</th><td>1200</td></tr></tbody></table>`);
    const cell = t.querySelector('tbody td') as HTMLTableCellElement;
    const id = cellIdentity(cell);
    expect(resolveCell(id)).toBe(cell);
    expect(resolveCell({ tableKey: 'sales', rowKey: 'nope', columnKey: 'q3' })).toBeNull();
    expect(resolveCell({ tableKey: 'other', rowKey: 'acme', columnKey: 'q3' })).toBeNull();
  });
});

describe('index-fallback warning', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('warns at most once per page across multiple index-fallback tables', () => {
    const t1 = makeTable(`<table><tbody><tr><td>x</td></tr></tbody></table>`);
    const t2 = makeTable(`<table><tbody><tr><td>y</td></tr></tbody></table>`);
    cellIdentity(t1.querySelector('td')!);
    cellIdentity(t2.querySelector('td')!);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
