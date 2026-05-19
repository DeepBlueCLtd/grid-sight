import { describe, it, expect } from 'vitest';
import { makeComparator, detectSortColumnType } from '../sort';

function row(cells: readonly string[]): HTMLTableRowElement {
  const r = document.createElement('tr');
  for (const c of cells) r.insertCell().textContent = c;
  return r;
}

describe('makeComparator — numeric', () => {
  it('orders ascending', () => {
    const cmp = makeComparator(0, 'asc', 'numeric');
    expect(cmp(row(['10']), row(['20']))).toBeLessThan(0);
    expect(cmp(row(['20']), row(['10']))).toBeGreaterThan(0);
    expect(cmp(row(['10']), row(['10']))).toBe(0);
  });

  it('orders descending', () => {
    const cmp = makeComparator(0, 'desc', 'numeric');
    expect(cmp(row(['10']), row(['20']))).toBeGreaterThan(0);
    expect(cmp(row(['20']), row(['10']))).toBeLessThan(0);
  });

  it('handles currency-style strings via cleanNumericCell', () => {
    const cmp = makeComparator(0, 'asc', 'numeric');
    expect(cmp(row(['$1,000']), row(['$500']))).toBeGreaterThan(0);
  });

  it('NaN / null sorts to the end in both directions', () => {
    const cmpAsc = makeComparator(0, 'asc', 'numeric');
    const cmpDesc = makeComparator(0, 'desc', 'numeric');
    expect(cmpAsc(row(['']), row(['10']))).toBeGreaterThan(0);
    expect(cmpAsc(row(['10']), row(['']))).toBeLessThan(0);
    expect(cmpDesc(row(['']), row(['10']))).toBeGreaterThan(0);
    expect(cmpDesc(row(['10']), row(['']))).toBeLessThan(0);
  });
});

describe('makeComparator — categorical', () => {
  it('orders via locale-aware collator', () => {
    const cmp = makeComparator(0, 'asc', 'categorical');
    expect(cmp(row(['banana']), row(['apple']))).toBeGreaterThan(0);
    expect(cmp(row(['Apple']), row(['apple']))).toBe(0); // case-insensitive sensitivity:'base'
  });

  it('numeric ordering on strings via collator.numeric', () => {
    const cmp = makeComparator(0, 'asc', 'categorical');
    expect(cmp(row(['item2']), row(['item10']))).toBeLessThan(0);
  });

  it('empty cells sort to the end', () => {
    const cmp = makeComparator(0, 'asc', 'categorical');
    expect(cmp(row(['']), row(['x']))).toBeGreaterThan(0);
  });
});

describe('detectSortColumnType', () => {
  it('detects numeric when the first non-empty cell parses', () => {
    const t = document.createElement('table');
    t.createTHead().insertRow().insertCell().textContent = 'h';
    t.createTBody().insertRow().insertCell().textContent = '$1,000';
    expect(detectSortColumnType(t, 0)).toBe('numeric');
  });

  it('detects categorical otherwise', () => {
    const t = document.createElement('table');
    t.createTHead().insertRow().insertCell().textContent = 'h';
    t.createTBody().insertRow().insertCell().textContent = 'EU';
    expect(detectSortColumnType(t, 0)).toBe('categorical');
  });

  it('defaults to categorical for empty columns', () => {
    const t = document.createElement('table');
    t.createTHead().insertRow().insertCell();
    t.createTBody().insertRow().insertCell();
    expect(detectSortColumnType(t, 0)).toBe('categorical');
  });
});
