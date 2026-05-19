import { describe, it, expect, beforeEach } from 'vitest';
import { getColumnTypes, setColumnTypes, clearColumnTypes } from '../column-types-cache';

function makeTable(): HTMLTableElement {
  return document.createElement('table');
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('column-types-cache', () => {
  it('returns undefined on a miss', () => {
    expect(getColumnTypes(makeTable())).toBeUndefined();
  });

  it('round-trips set → get', () => {
    const t = makeTable();
    setColumnTypes(t, ['numeric', 'categorical']);
    expect(getColumnTypes(t)).toEqual(['numeric', 'categorical']);
  });

  it('isolates entries per table', () => {
    const a = makeTable();
    const b = makeTable();
    setColumnTypes(a, ['numeric']);
    setColumnTypes(b, ['categorical']);
    expect(getColumnTypes(a)).toEqual(['numeric']);
    expect(getColumnTypes(b)).toEqual(['categorical']);
  });

  it('clear removes the entry', () => {
    const t = makeTable();
    setColumnTypes(t, ['numeric']);
    clearColumnTypes(t);
    expect(getColumnTypes(t)).toBeUndefined();
  });

  it('clear on a never-set table is a no-op', () => {
    expect(() => clearColumnTypes(makeTable())).not.toThrow();
  });

  it('set stores a defensive copy (caller mutation does not leak)', () => {
    const t = makeTable();
    const types: Array<'numeric' | 'categorical'> = ['numeric'];
    setColumnTypes(t, types);
    types.push('categorical');
    expect(getColumnTypes(t)).toEqual(['numeric']);
  });
});
