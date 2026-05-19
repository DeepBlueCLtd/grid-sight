/**
 * Canonical-order helper for virtual columns (spec 012-virtual-columns §R-2).
 * Invariant: cumulative (by activationIndex asc) → compare → sparkline.
 */

import type { VirtualColumnDirective } from '../types/virtual-column';

const KIND_PRIORITY: Record<VirtualColumnDirective['kind'], number> = {
  cumulative: 0,
  compare: 1,
  sparkline: 2,
};

/** Pure: return a new array sorted in canonical order. */
export function sortCanonical(
  directives: ReadonlyArray<VirtualColumnDirective>,
): VirtualColumnDirective[] {
  return [...directives].sort((a, b) => {
    const pa = KIND_PRIORITY[a.kind];
    const pb = KIND_PRIORITY[b.kind];
    if (pa !== pb) return pa - pb;
    if (a.kind === 'cumulative' && b.kind === 'cumulative') {
      return a.activationIndex - b.activationIndex;
    }
    return 0;
  });
}
