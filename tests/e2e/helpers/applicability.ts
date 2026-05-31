import type { Page } from '@playwright/test';
import type { EnrichmentId } from './gridsight-window';
import { hasActiveLozenge, hasDisabledLozenge } from './toggle-panel';

/**
 * Weak oracle (2C): derive the *expected* state from what the running library
 * actually rendered, rather than from an authored table. An enrichment is:
 *   - `active`       — it produced an active lozenge for this table,
 *   - `inapplicable` — it offered a lozenge but marked it disabled,
 *   - `absent`       — it produced no lozenge here at all.
 * The strong oracle (curated fixture, authored kinds) lives in the matrix spec.
 *
 * The two tiers, and why both exist:
 *
 *      enrichment on a table
 *              │
 *     ┌────────┴─────────┐
 *     │   WEAK (2C)       │   "did the library render something sane?"
 *     │   observedState   │   ← every demo; cannot catch a typing *regression*
 *     └────────┬─────────┘     because it reads the code-under-test's own output
 *              │
 *     ┌────────┴─────────┐
 *     │   STRONG (5A)     │   "is the library's typing CORRECT?"
 *     │   ColumnOracle    │   ← curated fixture only; authored kinds are an
 *     └──────────────────┘     independent ground truth, so issue #48 can fail
 */
export async function observedState(
  page: Page,
  tableId: string,
  id: EnrichmentId,
): Promise<'active' | 'inapplicable' | 'absent'> {
  if (await hasActiveLozenge(page, tableId, id)) return 'active';
  if (await hasDisabledLozenge(page, tableId, id)) return 'inapplicable';
  return 'absent';
}

/**
 * Every unordered pair of `items` — no self-pairs, no duplicates, stable order
 * (input order, i before j). Pure + unit-tested (D9/D12); used by the
 * permutation sweep to bound combinations to maximal pairwise coverage.
 */
export function pairwise<T>(items: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      out.push([items[i], items[j]]);
    }
  }
  return out;
}
