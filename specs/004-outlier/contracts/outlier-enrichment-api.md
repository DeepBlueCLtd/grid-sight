# Contract: Outlier Enrichment Module Surface

Feature: `004-outlier` · Date: 2026-05-28

These are the **internal** module contracts the implementation must satisfy. None
are added to the frozen `window.gridSight.init` public surface (constitution
§"Public API surface"; Development-Phase Posture). Signatures are normative; bodies
are illustrative.

---

## 1. `src/core/column-statistics.ts` (shared)

The single authority for a column's mean + population σ. Consumed by both the outlier
enrichment and `statistics.ts` (research R-1; satisfies FR-024 / SC-006).

```ts
export interface ColumnStatistics {
  readonly mean: number;
  readonly stdDev: number;      // POPULATION σ (÷ n)
  readonly numericCount: number;
}

/** Numeric values of a logical column, in document order, excluding non-numeric
 *  cells and (when excludeDimmed) rows currently dimmed by an active filter. */
export function columnNumericValues(
  table: HTMLTableElement,
  columnIndex: number,
  scope?: { excludeDimmed?: boolean },
): number[];

export function computeColumnStatistics(
  table: HTMLTableElement,
  columnIndex: number,
  scope?: { excludeDimmed?: boolean },
): ColumnStatistics;

/** Pure population σ over a numeric array (mean optional, computed if absent). */
export function populationStdDev(values: number[], mean?: number): number;
```

**Contract**
- `computeColumnStatistics` reads cells via `columnCells` + `cellValue`
  (`table-grid.ts`) and parses with `cleanNumericCell` (`type-detection.ts`).
- `stdDev` is population (`÷ numericCount`); `numericCount` excludes non-numeric and
  (when `excludeDimmed`) dimmed rows.
- Empty/empty-after-filter set → `{ mean: NaN, stdDev: NaN, numericCount: 0 }`
  (callers gate on `numericCount`); never throws.
- `statistics.ts` MUST derive its displayed mean and σ from these functions (no
  independent `simple-statistics.standardDeviation` call for σ).

---

## 2. `src/enrichments/outlier-marks.ts` (pure)

```ts
import type { OutlierMark } from './outlier';            // or a shared types module
import type { ColumnStatistics } from '../core/column-statistics';

/** Idle → 2 → 1 → 3 → idle. */
export function nextThreshold(current: 1 | 2 | 3 | null): 1 | 2 | 3 | null;

/** Mark every cell with |value − mean| > threshold·σ. Empty when σ = 0. */
export function computeMarks(
  cells: ReadonlyArray<{ cell: HTMLTableCellElement; rowLabel: string; value: number }>,
  stats: ColumnStatistics,
  threshold: 1 | 2 | 3,
): OutlierMark[];

/** Descending |σ|, ties by document order. */
export function sortMarksByDistance(marks: readonly OutlierMark[]): OutlierMark[];

/** "value 135, mean 100.0, +3.5σ" */
export function formatOutlierTooltip(mark: OutlierMark, mean: number): string;
```

**Contract**
- `computeMarks` is pure and DOM-free apart from holding cell references; fully
  unit-testable (FR-005, FR-009, SC-002 hot path).
- Strict `>` comparison (FR-005, "more than N standard deviations").
- `σ = 0` ⇒ returns `[]` (inert, FR-009).

---

## 3. `src/enrichments/outlier.ts` (orchestrator + lifecycle)

```ts
/** Registry apply hook: render persisted directives from gs.o for this table. */
export function applyOutliers(table: HTMLTableElement): void;

/** Registry tearDown hook: remove ALL markers/tooltips/popups, unsubscribe.
 *  DOM byte-identical to pre-flagging (FR-021, SC-005). Does NOT touch gs.o. */
export function tearDownOutliers(table: HTMLTableElement): void;

/** Set/clear the active threshold for one column; persists gs.o and repaints. */
export function setOutlierThreshold(
  table: HTMLTableElement,
  columnIndex: number,
  threshold: 1 | 2 | 3 | null,
): void;

/** Current directive for a column (for the lozenge's refresh probe). */
export function getOutlierThreshold(
  table: HTMLTableElement,
  columnIndex: number,
): 1 | 2 | 3 | null;

/** Current marks for a column (for the list popup). */
export function getOutlierMarks(
  table: HTMLTableElement,
  columnIndex: number,
): readonly OutlierMark[];
```

**Contract**
- `applyOutliers` is idempotent and re-runnable after `tearDownOutliers` (enable→
  disable→enable round-trip; `docs/adding-an-enrichment.md` §3).
- `setOutlierThreshold`: updates per-table state → writes `gs.o`
  (`history.replaceState`) + localStorage mirror → recomputes stats (filter-aware) →
  recomputes + repaints marks → leaves lozenge refresh to the caller/`refresh()`.
- A column becoming active (from none) subscribes `onVisibleRowsChange`; the last
  column clearing unsubscribes (research R-3).
- `tearDownOutliers` removes: marker classes/attrs, the `tabindex` added to marked
  cells, tooltip nodes/`aria-describedby` targets, any open popup, and the
  visible-rows subscription.

---

## 4. `src/ui/outlier-lozenge.ts`

```ts
export interface OutlierLozengeArgs {
  columnIndex: number;
  columnKey: string;
  /** false when σ = 0 — lozenge renders but click is a no-op (FR-009). */
  inert: boolean;
  columnLabel: string;                 // for aria-label text
  getCurrent: () => 1 | 2 | 3 | null;  // reads live directive
  onChange: (next: 1 | 2 | 3 | null) => void;
  onShowList: () => void;              // secondary affordance (FR-011)
}

/** Returns the cluster fragment: the `!` button (+ a "show list" icon button
 *  shown only while active). data-gs-lozenge-id="outlier". */
export function createOutlierLozenge(args: OutlierLozengeArgs): HTMLElement;
```

**Contract (mirrors `createSortLozenge`)**
- Glyph: `!` idle; `!2` / `!1` / `!3` active (FR-003). `data-gs-lozenge-id="outlier"`.
- `aria-pressed`: `true` when a threshold is active, else `false`/absent (FR-004/FR-018).
- `aria-label` + `title`: current threshold + next action, e.g.
  `"Outliers in column 'Latency' at 1σ; click for 3σ"`; idle:
  `"Mark outliers in column 'Latency' at 2σ"` (FR-001 scenario 3).
- Keyboard: Enter/Space cycle (native `<button>`); `Shift`+`Enter` calls `onShowList`
  (FR-011). The mouse "show list" icon is a sibling button (also calls `onShowList`),
  rendered only while active.
- `inert: true`: click/Enter is a no-op; `title` is "All values equal; no outliers to
  flag"; `aria-pressed` stays `false` (FR-009).
- Has an internal `refresh()` re-reading `getCurrent()` (same pattern as sort).

---

## 5. `src/ui/outlier-popup.ts`

```ts
export interface OutlierPopupArgs {
  table: HTMLTableElement;
  columnIndex: number;
  columnLabel: string;
  threshold: 1 | 2 | 3;
  anchor: HTMLElement;                 // the lozenge, for positioning + focus return
  getMarks: () => readonly OutlierMark[];
}

/** Opens the focus-trapped dialog; returns dispose() (FR-014). */
export function openOutlierPopup(args: OutlierPopupArgs): () => void;
```

**Contract (built on `popup-chrome.ts`)**
- `role="dialog"`, `aria-label` `"Outliers in column 'X' at Nσ"` (FR-020).
- Lists `row label — value — σ distance`, descending `|σ|`, doc-order tie-break
  (FR-012). Each entry is a focusable button.
- Activating an entry: `scrollIntoView({ block: 'nearest' })` + brief highlight class
  on the row; popup stays open (FR-013).
- `installPopupChrome` provides Escape, Tab focus-trap, outside-click dismiss, and
  refocus-the-anchor on close (FR-014/FR-020). A second `onShowList` call disposes.

---

## 6. `src/utils/outlier-persistence.ts`

See [url-fragment-schema.md](./url-fragment-schema.md) for the grammar. Surface:

```ts
export function encodeOutlierFragment(state: PersistedOutlierState): string;
export function decodeOutlierFragment(raw: string): PersistedOutlierState;
export function readOutliersFromUrl(hash?: string): PersistedOutlierState;
export function writeOutliersToUrl(state: PersistedOutlierState, hash?: string): string;
export function readOutliersFromStorage(stem?: string): PersistedOutlierState | undefined;
export function writeOutliersToStorage(state: PersistedOutlierState, stem?: string): void;
export function persistOutliers(state: PersistedOutlierState): void; // URL + localStorage
export function resolveInitialOutliers(): PersistedOutlierState;      // URL > LS > empty
```

**Contract**
- Reuses `urlStem()` / `storageKeyFor('outliers')` from `slider-persistence.ts`;
  writes preserve all other `&` fragment params (like `gs.s`/`gs.v`).
- `decode*` never throw; malformed input → empty state (FR-017 robustness).
- `writeOutliersToUrl([])` removes the `gs.o` segment entirely.

---

## 7. `src/core/enrichment-registry.ts` (modified entry)

```ts
{ id: 'outlier', label: 'Outlier marker', defaultOn: true, shipped: true,
  tearDown: tearDownOutliers, apply: applyOutliers },  // spec 004
```

Boot-time validation requires `apply`/`tearDown` only on `shipped: true` entries —
satisfied.

---

## 8. `src/ui/header-utils.ts` (behavior registration)

```ts
registerEnrichment({
  id: 'outlier',
  appliesTo: (ctx) =>
    ctx.headerType === 'column' &&
    ctx.columnType === 'numeric' &&
    !ctx.table.hasAttribute('data-gs-no-outlier') &&        // FR-022
    !ctx.header.hasAttribute('data-gs-no-outlier') &&
    !columnHasRowspanBodyCells(ctx.table, ctx.colIndex) &&  // FR-002
    qualifiesForOutliers(ctx.table, ctx.colIndex),          // ≥ 3 numeric cells (FR-010)
  isActive: (ctx) => getOutlierThreshold(ctx.table, ctx.colIndex) !== null,
  mount: (ctx) => createOutlierLozenge({ /* wired to setOutlierThreshold / openOutlierPopup */ }),
});
```

`data-gs-ignore` on the table is handled upstream by the detection/injection pass
(no outlier-specific code needed) — FR-023.
