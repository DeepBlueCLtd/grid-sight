import { describe, it, expect } from 'vitest';
import {
  numericRange,
  categoricalInclusion,
  collectCategoricalValues,
  predicateFromDirective,
} from '../filter';

function tableWith(rows: readonly (readonly string[])[]): HTMLTableElement {
  const t = document.createElement('table');
  const thead = t.createTHead();
  thead.insertRow().insertCell().textContent = 'h';
  const tb = t.createTBody();
  for (const r of rows) {
    const tr = tb.insertRow();
    for (const c of r) tr.insertCell().textContent = c;
  }
  return t;
}

describe('numericRange predicate', () => {
  it('closed range [min, max]', () => {
    const tb = tableWith([['50'], ['100'], ['500'], ['1000']]).tBodies[0];
    const p = numericRange({ columnIndex: 0, columnKey: 'amount', min: 100, max: 500, hideEmpty: false });
    expect(p.test(tb.rows[0])).toBe(false);
    expect(p.test(tb.rows[1])).toBe(true);
    expect(p.test(tb.rows[2])).toBe(true);
    expect(p.test(tb.rows[3])).toBe(false);
  });

  it('open-min and open-max', () => {
    const tb = tableWith([['50'], ['200']]).tBodies[0];
    const openMin = numericRange({ columnIndex: 0, columnKey: 'amount', min: null, max: 100, hideEmpty: false });
    expect(openMin.test(tb.rows[0])).toBe(true);
    expect(openMin.test(tb.rows[1])).toBe(false);
    const openMax = numericRange({ columnIndex: 0, columnKey: 'amount', min: 100, max: null, hideEmpty: false });
    expect(openMax.test(tb.rows[0])).toBe(false);
    expect(openMax.test(tb.rows[1])).toBe(true);
  });

  it('hideEmpty toggles blank handling', () => {
    const tb = tableWith([['']]).tBodies[0];
    expect(numericRange({ columnIndex: 0, columnKey: 'amount', min: null, max: null, hideEmpty: false }).test(tb.rows[0])).toBe(true);
    expect(numericRange({ columnIndex: 0, columnKey: 'amount', min: null, max: null, hideEmpty: true }).test(tb.rows[0])).toBe(false);
  });

  it('toDirective round-trips shape', () => {
    const p = numericRange({ columnIndex: 0, columnKey: 'amount', min: 1, max: 2, hideEmpty: true });
    expect(p.toDirective()).toEqual({ kind: 'numeric-range', columnKey: 'amount', min: 1, max: 2, hideEmpty: true });
  });
});

describe('categoricalInclusion predicate', () => {
  it('admits rows whose value is in the allowed set', () => {
    const tb = tableWith([['EU'], ['US'], ['JP']]).tBodies[0];
    const p = categoricalInclusion({ columnIndex: 0, columnKey: 'region', allowed: new Set(['EU', 'US']), hideEmpty: false });
    expect(p.test(tb.rows[0])).toBe(true);
    expect(p.test(tb.rows[1])).toBe(true);
    expect(p.test(tb.rows[2])).toBe(false);
  });

  it('hideEmpty controls blank handling independent of allowed', () => {
    const tb = tableWith([['']]).tBodies[0];
    expect(categoricalInclusion({ columnIndex: 0, columnKey: 'region', allowed: new Set([]), hideEmpty: true }).test(tb.rows[0])).toBe(false);
    expect(categoricalInclusion({ columnIndex: 0, columnKey: 'region', allowed: new Set(['']), hideEmpty: false }).test(tb.rows[0])).toBe(true);
  });

  it('toDirective returns categorical shape', () => {
    const p = categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['EU', 'US'], hideEmpty: false });
    expect(p.toDirective()).toEqual({ kind: 'categorical', columnKey: 'region', allowed: ['EU', 'US'], hideEmpty: false });
  });
});

describe('collectCategoricalValues', () => {
  it('counts distinct values', () => {
    const t = tableWith([['EU'], ['US'], ['EU'], ['EU']]);
    const counts = collectCategoricalValues(t, 0);
    expect(counts.get('EU')).toBe(3);
    expect(counts.get('US')).toBe(1);
  });
});

describe('predicateFromDirective', () => {
  it('builds a numeric predicate', () => {
    const p = predicateFromDirective({ kind: 'numeric-range', columnKey: 'amount', min: 1, max: 10, hideEmpty: false }, 2);
    expect(p?.columnIndex).toBe(2);
  });
  it('builds a categorical predicate', () => {
    const p = predicateFromDirective({ kind: 'categorical', columnKey: 'region', allowed: ['EU'], hideEmpty: false }, 1);
    expect(p?.columnIndex).toBe(1);
  });
});
