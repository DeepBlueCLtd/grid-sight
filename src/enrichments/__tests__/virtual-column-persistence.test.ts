import { describe, it, expect } from 'vitest';
import {
  encodeFragment,
  decodeFragment,
  slugifyColumnKey,
  type PersistedVirtualColumnState,
} from '../virtual-column-persistence';

describe('slugifyColumnKey', () => {
  it('lowercases and replaces non-alphanumeric with hyphens', () => {
    expect(slugifyColumnKey('Weight (kg)')).toBe('weight-kg');
    expect(slugifyColumnKey('Q1 / Q2')).toBe('q1-q2');
  });

  it('deduplicates runs of hyphens and trims', () => {
    expect(slugifyColumnKey('  Foo --- Bar  ')).toBe('foo-bar');
  });
});

describe('encode/decode fragment', () => {
  it('round-trips every directive kind', () => {
    const state: PersistedVirtualColumnState = {
      blocks: [
        {
          tableKey: 'table-0',
          tokens: [
            { kind: 'cumulative', colKey: 'weight', mode: 'sum' },
            { kind: 'cumulative', colKey: 'cost', mode: 'percent' },
            { kind: 'compare', colKeyA: 'q1', colKeyB: 'q4', mode: 'abs' },
            { kind: 'sparkline', scale: 'shared' },
          ],
        },
      ],
    };
    const encoded = encodeFragment(state);
    expect(encoded).toContain('table-0:');
    expect(encoded).toContain('c.weight.s');
    expect(encoded).toContain('c.cost.p');
    expect(encoded).toContain('d.q1.q4.a');
    expect(encoded).toContain('t.s');

    const decoded = decodeFragment(encoded);
    expect(decoded).toEqual(state);
  });

  it('ignores unknown-prefix tokens', () => {
    const decoded = decodeFragment('table-0:c.weight.s,x.unknown.foo,t.r');
    expect(decoded.blocks[0].tokens.map((t) => t.kind)).toEqual(['cumulative', 'sparkline']);
  });

  it('drops invalid tokens without erroring', () => {
    const decoded = decodeFragment('table-0:c.weight.z,d.a.b,bad,t.r');
    expect(decoded.blocks[0].tokens).toEqual([{ kind: 'sparkline', scale: 'per-row' }]);
  });

  it('keeps the last duplicate cumulative for the same colKey', () => {
    const decoded = decodeFragment('table-0:c.weight.s,c.weight.p');
    expect(decoded.blocks[0].tokens).toEqual([
      { kind: 'cumulative', colKey: 'weight', mode: 'percent' },
    ]);
  });

  it('keeps the first duplicate compare/sparkline', () => {
    const decoded = decodeFragment('table-0:d.a.b.a,d.c.d.r,t.r,t.s');
    expect(decoded.blocks[0].tokens).toEqual([
      { kind: 'compare', colKeyA: 'a', colKeyB: 'b', mode: 'abs' },
      { kind: 'sparkline', scale: 'per-row' },
    ]);
  });

  it('re-canonicalises after parse', () => {
    // sparkline placed before cumulative in the URL — should be reordered.
    const decoded = decodeFragment('table-0:t.r,c.weight.s,d.a.b.a');
    expect(decoded.blocks[0].tokens.map((t) => t.kind)).toEqual([
      'cumulative',
      'compare',
      'sparkline',
    ]);
  });

  it('encodes multi-table blocks', () => {
    const state: PersistedVirtualColumnState = {
      blocks: [
        { tableKey: 'table-0', tokens: [{ kind: 'cumulative', colKey: 'a', mode: 'sum' }] },
        { tableKey: 'table-1', tokens: [{ kind: 'sparkline', scale: 'per-row' }] },
      ],
    };
    const encoded = encodeFragment(state);
    expect(encoded).toBe('table-0:c.a.s;table-1:t.r');
    expect(decodeFragment(encoded)).toEqual(state);
  });
});
