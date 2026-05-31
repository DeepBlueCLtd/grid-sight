import { describe, it, expect } from 'vitest';
import { pairwise } from '../../e2e/helpers/applicability';

describe('pairwise (D12)', () => {
  it('produces every unordered pair, i before j, in input order', () => {
    expect(pairwise(['a', 'b', 'c'])).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ]);
  });

  it('emits n*(n-1)/2 pairs with no self-pairs and no duplicates', () => {
    const items = ['w', 'x', 'y', 'z'];
    const pairs = pairwise(items);
    expect(pairs).toHaveLength((items.length * (items.length - 1)) / 2);
    for (const [a, b] of pairs) expect(a).not.toBe(b);
    const keys = pairs.map(([a, b]) => `${a}|${b}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is empty for 0 or 1 items', () => {
    expect(pairwise([])).toEqual([]);
    expect(pairwise(['solo'])).toEqual([]);
  });

  it('orders pairs stably regardless of value, by index', () => {
    expect(pairwise([3, 1, 2])).toEqual([
      [3, 1],
      [3, 2],
      [1, 2],
    ]);
  });
});
