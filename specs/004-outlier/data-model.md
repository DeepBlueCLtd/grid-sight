# Phase 1 Data Model: Outlier Marker Enrichment

Feature: `004-outlier` · Date: 2026-05-28 · Derives from: [spec.md](./spec.md) §Key Entities, [research.md](./research.md)

Grid-Sight holds no database; "entities" here are the in-memory TypeScript shapes
that flow between the new modules, plus the on-page state they read from / write to
(the live DOM and the URL fragment). All shapes are internal — none are added to the
frozen `window.gridSight.init` surface.

---

## 1. `OutlierThreshold`

The sigma cut-off, an enum of exactly the three active values plus the absence of
flagging.

```ts
/** Active sigma threshold. Idle is represented by the directive's absence. */
export type OutlierThreshold = 1 | 2 | 3;
```

- **Cycle order** (FR-003): `idle → 2 → 1 → 3 → idle`. Encoded as a pure function
  `nextThreshold(current: OutlierThreshold | null): OutlierThreshold | null`.
- **Default first activation** is `2` (spec Assumption "Default threshold is 2σ").

---

## 2. `OutlierDirective`

A `(table, column, threshold)` tuple — at most one active per column (spec Key
Entities). This is the persisted, user-intent state.

```ts
export interface OutlierDirective {
  /** Stable table id (same source view-state-url uses for gs.v). */
  readonly tableId: string;
  /** Column key from colKeyAt(table, colIndex); names columns like sort/filter. */
  readonly columnKey: string;
  /** Logical column index resolved against the live grid at apply time. */
  readonly columnIndex: number;
  readonly threshold: OutlierThreshold;
}
```

- **Validation**: a directive is *applicable* only if its `tableId` resolves to a
  present table and `columnKey` resolves to a present, qualifying column
  (≥ 3 numeric cells, not rowspan, not σ = 0). Non-applicable directives decoded
  from the URL are silently dropped (FR-017).
- **Identity**: keyed by `(tableId, columnKey)`; re-activating the same column
  replaces its threshold rather than adding a second directive.

---

## 3. `ColumnStatistics` (shared with the statistics enrichment)

The `(mean, σ, numericCount)` record computed over a column's numeric body cells,
restricted to currently un-dimmed rows when any filter is active (spec Key Entities,
FR-008, FR-024). Owned by `src/core/column-statistics.ts`; consumed by **both** the
outlier enrichment and `statistics.ts` so the two never disagree (SC-006).

```ts
export interface ColumnStatistics {
  /** Arithmetic mean of the numeric cells in scope. */
  readonly mean: number;
  /** POPULATION standard deviation (÷ n). See research R-1. */
  readonly stdDev: number;
  /** Count of numeric cells that contributed (excludes non-numeric & dimmed). */
  readonly numericCount: number;
}

/**
 * Compute statistics for a logical column.
 * `scope` controls whether dimmed rows (active filter) are excluded.
 */
export function computeColumnStatistics(
  table: HTMLTableElement,
  columnIndex: number,
  scope?: { excludeDimmed?: boolean },
): ColumnStatistics;
```

- **Numeric-cell set**: `columnCells(table, columnIndex)` (from `table-grid.ts`) →
  `cellValue(cell)` → `cleanNumericCell(value)` (from `type-detection.ts`), keeping
  only non-null results. Non-numeric cells are excluded (FR-005/FR-008).
- **Filter scope**: when `excludeDimmed` is true, rows with
  `entry.state === 'dimmed'` (from `getVisibleRows`) are removed before computing
  (FR-008, research R-3).
- **σ = 0 case**: returned with `stdDev === 0`; callers treat the column as inert
  (FR-009).
- **`numericCount < 3`**: callers must not offer flagging (FR-010); the function
  still returns a value (callers gate, not the computer).
- **Agreement contract**: `statistics.ts` derives the displayed mean/σ from this same
  function over the same column, guaranteeing FR-024/SC-006 by construction.

---

## 4. `OutlierMark`

A per-cell record `(cell, value, sigmaDistance)` for a marked cell while flagging is
active (spec Key Entities). Transient — recomputed whenever the directive, the filter
set, or the DOM changes; never persisted.

```ts
export interface OutlierMark {
  readonly cell: HTMLTableCellElement;
  /** The row's label cell text, for the list popup (FR-012). */
  readonly rowLabel: string;
  readonly value: number;
  /** Signed distance in σ: (value - mean) / stdDev. */
  readonly sigmaDistance: number;
}
```

- **Qualification** (FR-005): a numeric cell is marked iff
  `Math.abs(value - mean) > threshold * stdDev`. (Strict `>`, matching the spec's
  "more than N standard deviations".) When `stdDev === 0`, no cell qualifies (inert).
- **Derivation** is pure: `computeMarks(cells, stats, threshold) → OutlierMark[]`,
  unit-tested in isolation (`outlier-marks.test.ts`).
- **Sort for popup** (FR-012): descending `|sigmaDistance|`, ties broken by document
  order (stable sort over cells already in document order).
- **Tooltip text** (FR-007): `value {value}, mean {mean}, {sign}{|σ|.toFixed(1)}σ`
  — e.g. `value 135, mean 100.0, +3.5σ`.

---

## 5. Per-table runtime state (in-memory, not persisted)

Held in a `WeakMap<HTMLTableElement, OutlierTableState>` inside `outlier.ts`
(mirrors how other enrichments hold per-table state; auto-GC'd with the table).

```ts
interface OutlierTableState {
  /** Active directive per columnKey (idle columns absent). */
  readonly directives: Map<string, OutlierDirective>;
  /** Current marks per columnKey, for popup + teardown. */
  readonly marks: Map<string, OutlierMark[]>;
  /** Unsubscribe handle for onVisibleRowsChange; null when no column active. */
  unsubscribeVisibleRows: (() => void) | null;
}
```

- The subscription is created when the first directive on the table activates and
  disposed when the last clears or on teardown (research R-3, R-7).

---

## 6. `PersistedOutlierState` (URL fragment + localStorage mirror)

The serialisation of all directives on the page (spec Key Entities). Source of truth
is the URL fragment parameter `gs.o`; `localStorage` is a same-machine mirror only
(SC-004). Full grammar in [contracts/url-fragment-schema.md](./contracts/url-fragment-schema.md).

```ts
/** Decoded form: one entry per table, each a map of columnKey → threshold. */
export type PersistedOutlierState = ReadonlyArray<{
  readonly tableId: string;
  readonly columns: ReadonlyMap<string, OutlierThreshold>;
}>;
```

- **Round-trip**: `decodeOutlierFragment(raw) → PersistedOutlierState` and
  `encodeOutlierFragment(state) → string`; malformed input yields an empty state
  (never throws — Progressive Enhancement, mirrors `decodeFragment`/`decodeViewState`).
- **Write** uses `history.replaceState` (no history entry) and reuses
  `urlStem()` / `storageKeyFor('outliers')` from `slider-persistence.ts`.
- **Resolve on load**: URL > localStorage > empty (mirrors
  `resolveVisitorEnrichments` precedence).

---

## Relationships

```text
PersistedOutlierState (gs.o)  ──decode──▶  OutlierDirective[]  (per qualifying column)
                                                  │
                              colKeyAt + columnCells (table-grid)
                                                  ▼
                         computeColumnStatistics ──▶ ColumnStatistics ──shared──▶ statistics.ts (#)
                                                  │
                              computeMarks(cells, stats, threshold)
                                                  ▼
                                          OutlierMark[]  ──▶ cell markers + tooltips (DOM)
                                                  │
                                                  └────────▶ outliers list popup (sorted by |σ|)

onVisibleRowsChange (filter/sort) ──▶ recompute ColumnStatistics + OutlierMark[] for active columns
```

## State transitions (the lozenge)

```text
        click / Enter / Space
 idle ───────────────▶ 2σ ───────────────▶ 1σ ───────────────▶ 3σ ───────────────▶ idle
   ▲                                                                                  │
   └──────────────────────────────────────────────────────────────────────────────┘

 inert (σ = 0): click is a no-op; stays in a non-flagging state with explanatory tooltip (FR-009)
```

Each transition: update directive map → persist `gs.o` → recompute marks for that
column → repaint markers/tooltips → refresh lozenge glyph/`aria-pressed`/label.
