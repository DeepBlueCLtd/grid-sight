# Contract: `gs.o` URL-Fragment Schema (Outlier Persistence)

Feature: `004-outlier` · Date: 2026-05-28 · Satisfies: FR-015, FR-016, FR-017, SC-003, SC-004

The active outlier state is encoded in `location.hash` under the parameter `gs.o`,
co-existing with `gs.s` (sliders) and `gs.v` (sort+filter). Each parameter writes
back preserving the others (same rule as `slider-persistence.ts` and
`view-state-url.ts`). The URL is the **source of truth**; `localStorage`
(`gs:${stem}:outliers`) is a same-machine mirror only (SC-004 forbids a
`localStorage` dependency for sharing).

---

## Grammar

```
fragment-param := "gs.o" "=" table-list
table-list     := table-entry ( "," table-entry )*
table-entry    := tableId "(" column-list ")"
column-list    := column-entry ( ";" column-entry )* ";"?
column-entry   := colKey ":" threshold
threshold      := "1" | "2" | "3"
```

- `tableId` — the table's stable id, the same value `gs.v` uses to name tables. Tables
  with no active outlier column are omitted entirely.
- `colKey` — `colKeyAt(table, colIndex)` from `view-state-url.ts`: a slug of the
  header text (`/[^a-z0-9]+/ → "-"`, trimmed), falling back to `c<index>`. This is the
  identical column naming sort and filter use, so a stale/missing column is detectable.
- `threshold` — the active σ multiple. Idle columns are **absent** (never written as a
  zero); clearing the last column removes the table entry; removing the last table
  removes the whole `gs.o` segment.

### Example

Two tables — `sales` with column `latency` at 1σ and `error-rate` at 3σ; `inventory`
with `qty` at 2σ:

```
#gs.o=sales(latency:1;error-rate:3;),inventory(qty:2;)
```

Co-existing with a slider and a sort, write-back preserves all three:

```
#gs.s=axis-x:0.42&gs.v=sales(s:latency:asc)&gs.o=sales(latency:1;)
```

---

## Decode rules (FR-017 robustness)

`decodeOutlierFragment(raw)` MUST:

1. Never throw. Any parse failure of a fragment, table-entry, or column-entry yields
   **the empty state** for that scope (the malformed piece is skipped; valid siblings
   survive). Mirrors `decodeFragment` / `decodeViewState`.
2. Reject thresholds outside `{1,2,3}` (skip that column-entry).
3. Reject a `colKey` not matching `^[a-z0-9-]+$` (skip that column-entry).
4. De-duplicate: if a `colKey` appears twice in one table, the **last** wins.

`applyOutliers` then resolves each decoded entry against the live DOM and:

- Skips any `tableId` with no matching table on the page (FR-017).
- Skips any `colKey` with no matching header, or a column that no longer qualifies
  (< 3 numeric cells, rowspan, or σ = 0) — silently; other directives still apply
  (FR-017, edge cases).

---

## Encode rules

`encodeOutlierFragment(state)` MUST:

1. Emit tables in a stable order (input order; callers pass document order) and
   columns within a table in a stable order (column index ascending) so the same view
   always produces the same string (shareable, diff-friendly).
2. Omit any table with zero active columns and omit the `gs.o=` segment entirely when
   the whole state is empty (so toggling everything off leaves a clean hash).
3. Preserve every other `&`-separated fragment parameter on write
   (`writeOutliersToUrl`).

---

## Load timing (SC-003)

On init, `resolveInitialOutliers()` (URL > localStorage > empty) is read and
`applyOutliers(table)` runs during `processTable`, so marks paint within one
animation frame of first paint — no visible flash of unmarked content beyond a single
frame (SC-003). Restoration does not depend on `localStorage` (SC-004): a fresh
machine with only the URL reproduces the view 100% of the time.

---

## Interaction with Grid-Sight off (FR-021)

Toggling Grid-Sight (or the `outlier` enrichment) off runs `tearDownOutliers`, which
removes DOM only. The `gs.o` segment is **left untouched** in the URL, so toggling
back on restores the same flagged view.
