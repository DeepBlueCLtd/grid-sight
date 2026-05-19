import { describe, it, expect } from 'vitest';
import { sortCanonical } from '../virtual-column-registry';
import type { VirtualColumnDirective } from '../../types/virtual-column';

function mkCum(colKey: string, activationIndex: number): VirtualColumnDirective {
  return {
    id: `cum-${colKey}`,
    kind: 'cumulative',
    tableEl: {} as HTMLTableElement,
    sourceColKey: colKey,
    mode: 'sum',
    activationIndex,
  };
}

function mkCompare(): VirtualColumnDirective {
  return {
    id: 'cmp-a-b',
    kind: 'compare',
    tableEl: {} as HTMLTableElement,
    colKeyA: 'a',
    colKeyB: 'b',
    mode: 'abs',
  };
}

function mkSpark(): VirtualColumnDirective {
  return {
    id: 'spark',
    kind: 'sparkline',
    tableEl: {} as HTMLTableElement,
    scale: 'per-row',
    style: 'bar',
  };
}

describe('sortCanonical', () => {
  it('orders cumulative directives by activation index', () => {
    const result = sortCanonical([mkCum('b', 2), mkCum('a', 1), mkCum('c', 3)]);
    expect(result.map((d) => d.id)).toEqual(['cum-a', 'cum-b', 'cum-c']);
  });

  it('places compare after cumulative', () => {
    const result = sortCanonical([mkCompare(), mkCum('a', 1)]);
    expect(result.map((d) => d.kind)).toEqual(['cumulative', 'compare']);
  });

  it('always places sparkline last', () => {
    const result = sortCanonical([mkSpark(), mkCompare(), mkCum('a', 1)]);
    expect(result.map((d) => d.kind)).toEqual(['cumulative', 'compare', 'sparkline']);
  });

  it('is idempotent', () => {
    const input = [mkCum('a', 1), mkCum('b', 2), mkCompare(), mkSpark()];
    const once = sortCanonical(input);
    const twice = sortCanonical(once);
    expect(twice.map((d) => d.id)).toEqual(once.map((d) => d.id));
  });

  it('handles a mixed-kind permutation', () => {
    const result = sortCanonical([
      mkSpark(),
      mkCum('weight', 5),
      mkCompare(),
      mkCum('cost', 3),
    ]);
    expect(result.map((d) => d.id)).toEqual(['cum-cost', 'cum-weight', 'cmp-a-b', 'spark']);
  });
});
