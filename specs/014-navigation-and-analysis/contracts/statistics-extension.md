# Contract: `statistics` enrichment — EXTENSION (no new id)

**Id**: `statistics` (existing) · **Label**: "Statistics popup" (unchanged) ·
**Scope**: numeric column lozenge (existing trigger via the `+`/enrichment menu
in `toggle-injector.ts`). This contract describes only the **delta**.

## `src/enrichments/statistics.ts` (MODIFIED)

```typescript
export interface StatisticsResult {
  count: number; sum: number; min: number; max: number;
  mean: number; median: number; stdDev: number; variance: number;
  // NEW:
  missing: number;        // set by caller (extraction layer)
  missingPct: number;     // set by caller
  distinct: number;
  q1: number;
  q3: number;
  histogram: number[];    // 10 bin counts; [] when count 0
}

/** Now accepts the missing count (cells seen but non-numeric/blank) so it can
 *  populate missing/missingPct. MUST NOT throw on empty: returns a zero-count
 *  result with non-finite numerics (rendered as N/A by the popup). */
export function calculateStatistics(values: number[], missing?: number): StatisticsResult;
```

- `distinct` = `new Set(finiteValues).size`.
- `q1`/`q3` via `simple-statistics.quantile(values, 0.25|0.75)` (existing dep).
- `histogram` = 10 equal-width bins over [min,max]; all-equal ⇒ single bar.

## `src/ui/statistics-popup.ts` (MODIFIED)

`StatisticsPopup.show(stats, anchor)` renders the new rows (Missing, Distinct,
Q1, Q3) alongside the existing ones, plus an inline SVG mini histogram (reusing
`sparkline-svg` style). Empty state (`count === 0`): show "No numeric values",
`missingPct` if applicable, no histogram. `show`/`onClose` signatures unchanged.

## `src/ui/toggle-injector.ts` (MODIFIED)

`extractNumericColumnValues` / `extractNumericRowValues` /
`extractNumericTableValues` read the **visible** rows
(`getVisibleRows(table).current()`) and also return the **missing** count.
While the popup is open, subscribe via `onVisibleRowsChange(table, …)` to
recompute + re-`show`; unsubscribe in the popup's `onClose`.

## Behaviour contract

| Given | When | Then |
|-------|------|------|
| numeric col with blanks | open popup | shows existing figures + missing #/%, distinct, Q1, Q3, histogram (hand-checked) |
| filter hides rows | open/reopen | figures over visible rows only |
| every visible cell blank | open | zero-count empty state, no throw, no NaN |
| popup open | Escape / outside click | closes, focus returns to lozenge, subscription removed |
| `statistics` disabled | tearDown | lozenge removed, byte-identical (unchanged contract) |

## Non-goals (explicit)

- **No new `column-profile` id.** Categorical distribution stays with
  `frequency`/`frequency-chart`; the statistics popup remains numeric-only.
