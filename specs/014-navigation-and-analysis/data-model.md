# Phase 1 Data Model: Large-Table Navigation & Analysis (Tier 1)

These are in-memory/derived entities (Grid-Sight holds no server state). Only the
summary aggregate choice is persisted. All row/cell access goes through the
table-grid addressing layer; figures are computed over the **visible** rows.

---

## E-1. ExtendedStatisticsResult (statistics extension)

Grows the existing `StatisticsResult` (`src/enrichments/statistics.ts`).

| Field | Type | Notes |
|-------|------|-------|
| count | number | Existing. Count of finite numeric values (visible rows). |
| sum, min, max, mean, median, stdDev, variance | number | Existing. `N/A` when count 0 (non-finite). |
| **missing** | number | NEW. Visible cells in the column that are blank/non-numeric. |
| **missingPct** | number | NEW. `missing / (count + missing)`; 0 when no cells. |
| **distinct** | number | NEW. Size of the set of finite numeric values. |
| **q1** | number | NEW. 25th percentile (`simple-statistics.quantile`). |
| **q3** | number | NEW. 75th percentile. |
| **histogram** | number[] | NEW. 10 equal-width bin counts over [min, max]; `[]` when count 0. |

**Validation / state**:

- `count === 0` ⇒ empty state: numerics render `N/A`, `missingPct` 100% if any
  cells existed, `histogram` empty. **Never throws** (replaces current throw).
- Computed over `getVisibleRows(table).current()`; `missing` counted at the
  extraction layer (the numeric array has already dropped blanks/non-numerics).
- Transient: recomputed on popup open and on `onVisibleRowsChange` while open.

---

## E-2. FrozenCellTag (freeze-panes)

Not a stored object — a DOM-class assignment computed by the apply pass.

| Concept | Representation | Notes |
|---------|----------------|-------|
| Frozen header cell | class `gs-freeze-header` on each header-row cell | `position: sticky; top:0` via injected CSS. |
| Frozen key cell | class `gs-freeze-col` on the first **logical** cell of each grid row | Resolved via addressing layer (`gridCells(row)[0]`), never `:first-child` (could be scaffold). `position: sticky; left:0`. |
| Corner | a cell carrying both classes | Higher `z-index`; pinned `top:0; left:0`. |
| Table opt-in | class `gs-freeze` on `<table>` | CSS is scoped under this class; removing it + cell classes = byte-identical teardown. |

**State transitions**: `apply` (enabled) ⇒ tag cells + add `gs-freeze`;
`tearDown` (disabled) ⇒ remove all three classes + any inline background.
No persisted state (on/off derives from the enabled set).

---

## E-3. SummaryRow + SummaryAggregateChoice (summary-row)

| Concept | Representation | Notes |
|---------|----------------|-------|
| Summary footer | one `<tfoot>` row, all cells `data-gs-injected` | Aligned to logical columns; ignored by addressing layer / other enrichments. |
| Per-column aggregate | `Aggregate = 'sum' \| 'avg' \| 'min' \| 'max' \| 'count'` | Default `sum` for numeric, `count` for non-numeric. |
| Computed value | number/string over visible rows | Numeric aggregates exclude blank/non-numeric; `count` counts non-blank. |

**Persisted entity — SummaryChoiceEnvelope** (localStorage, `gs:` scheme):

```text
key:   gs:<url-stem>:summary:<table-key>
value: { version: 1, choices: { [logicalColIndex: number]: Aggregate } }
```

- Table key = existing resolution (`data-gs-key` → id → caption → doc index).
- Keyed by **logical** column index (survives reorder/scaffolding).
- Read on `apply`; written on user change. try/catch; malformed ⇒ ignored
  (development-phase posture: no migration). No network.

**State transitions**: `apply` ⇒ inject footer, restore choices, subscribe to
`onVisibleRowsChange`; choice change ⇒ recompute that cell + persist;
visible-rows change ⇒ recompute all cells; `tearDown` ⇒ unsubscribe + remove
footer (byte-identical).

---

## E-4. FindQueryState (find-in-table)

Transient, in-memory per table while the find box is open. Not persisted.

| Field | Type | Notes |
|-------|------|-------|
| term | string | Current search text (case-insensitive). |
| matches | HTMLTableCellElement[] | Ordered list of matching **visible** grid cells (document order). |
| currentIndex | number | Index into `matches`; wraps. `-1` when no matches. |

**Derived rendering**: each `matches[i]` carries class `gs-find-match`;
`matches[currentIndex]` additionally `gs-find-current`. Counter shows
`currentIndex+1` of `matches.length` (or "0 matches").

**State transitions**: type/debounce ⇒ rebuild `matches` over current visible
rows, reset `currentIndex` to first match; Next/Prev ⇒ advance/retreat (wrapping)
and `scrollIntoView`; clear/close/`tearDown` ⇒ drop state and remove both classes
(byte-identical).

---

## Cross-entity invariants

- **Addressing**: every column/row/cell reference uses the table-grid layer;
  scaffolding (`data-gs-injected`) is never summed, profiled, frozen-as-key, or
  matched; virtual columns (`data-gs-virtual-column`) are eligible.
- **Visible-rows**: statistics, summary, and find all read
  `getVisibleRows(table).current()` and react to `onVisibleRowsChange`.
- **Teardown byte-identity**: no entity introduces text-node surgery; all use
  classes / `data-gs-injected` nodes / inline styles removed on teardown.
- **Composition order independence**: enabling/disabling any subset in any order,
  combined with sort/filter/sliders/virtual columns, yields identical results
  (spec 013 invariant).
