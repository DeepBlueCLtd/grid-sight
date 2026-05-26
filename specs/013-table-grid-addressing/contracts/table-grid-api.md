# Contract: `src/core/table-grid.ts` public surface

Internal module contract (not part of the frozen `window.gridSight.*` API).
All functions are **pure reads** of the live DOM + markers; none mutate the DOM.
Signatures are TypeScript-shaped but advisory — names/shapes may refine during
implementation (Development-Phase Posture), the *semantics* below are the
contract the consumers and tests depend on.

## Marker constants (single source of truth)

```ts
export const SCAFFOLD_ATTR = 'data-gs-injected';
export const VIRTUAL_COL_ATTR = 'data-gs-virtual-column';
```

## Classification

```ts
/** True for slider scaffolding rows/cells — never part of the logical grid. */
export function isScaffold(el: Element): boolean;        // el.hasAttribute(SCAFFOLD_ATTR)

/** True for a Grid-Sight-computed (virtual) column cell. */
export function isVirtualColumn(cell: Element): boolean; // cell.hasAttribute(VIRTUAL_COL_ATTR)
```

## Rows

```ts
/** All non-scaffold rows, in DOM order (header + body, excludes <tfoot>). */
export function gridRows(table: HTMLTableElement): HTMLTableRowElement[];

/** The header row (first non-scaffold row; reuses original-order header rule). */
export function headerRow(table: HTMLTableElement): HTMLTableRowElement | null;

/** Non-scaffold data rows after the header, excluding <tfoot>. Dimmed rows kept. */
export function bodyRows(table: HTMLTableElement): HTMLTableRowElement[];
```

## Cells within a row

```ts
/** Source + virtual columns (non-scaffold), DOM order: source first, virtual last.
 *  The surface lozenges / sort / filter / statistics / frequency address. */
export function gridCells(row: HTMLTableRowElement): HTMLTableCellElement[];

/** Source columns only (also excludes virtual). The surface slider axis-binding
 *  and column-type detection use. */
export function sourceCells(row: HTMLTableRowElement): HTMLTableCellElement[];
```

## Column counts

```ts
export function sourceColumnCount(table: HTMLTableElement): number;
export function gridColumnCount(table: HTMLTableElement): number;  // source + virtual
```

## Bidirectional translation

```ts
/** The cell at logical (rowIndex, colIndex), or null if out of range.
 *  rowIndex addresses bodyRows(); colIndex addresses gridCells() of that row.
 *  Rowspan-safe (INV-2). */
export function cellAt(
  table: HTMLTableElement,
  rowIndex: number,
  colIndex: number,
): HTMLTableCellElement | null;

/** Every body cell of logical column `colIndex`, one per body row, in body order.
 *  Empty array if colIndex is out of range. Rowspan-safe. */
export function columnCells(
  table: HTMLTableElement,
  colIndex: number,
): HTMLTableCellElement[];

/** The header cell for logical column `colIndex`, or null. For an author
 *  colspan header, any covered slot returns that header cell (R-6). */
export function headerCellFor(
  table: HTMLTableElement,
  colIndex: number,
): HTMLTableCellElement | null;

/** Logical column index of `cell` within its row's grid cells, or -1.
 *  Replaces ad-hoc `headerColIndex` / `th.cellIndex`. */
export function logicalColIndexOf(cell: HTMLTableCellElement): number;

/** Logical row identity: index in the Original Order Record when present,
 *  else index within bodyRows(). Stable across sort reorder (INV-5). -1 if
 *  the row is not a body row of this table. */
export function logicalRowIndexOf(
  table: HTMLTableElement,
  row: HTMLTableRowElement,
): number;
```

## Canonical value

```ts
/** The author data text of a cell, excluding Grid-Sight-injected UI
 *  (lozenge clusters, slider readouts, etc.), trimmed. For a clean cell,
 *  equals cell.textContent.trim() (INV-1 / INV-8). */
export function cellValue(cell: HTMLTableCellElement): string;
```

## Behavioural guarantees (tested)

| ID | Guarantee |
|----|-----------|
| C-1 | All functions are pure reads — calling any of them never changes the DOM (INV-6). |
| C-2 | With no scaffold/virtual markers present, `gridCells`/`bodyRows`/`cellAt`/`columnCells`/`logicalColIndexOf` match naive physical indexing (INV-1). |
| C-3 | `columnCells(K)` returns the same author cells under `{row, col, both}` slider injection as with none, for every source K (INV-2, SC-001). |
| C-4 | `gridColumnCount = sourceColumnCount + (#virtual columns)`; `sourceCells ⊆ gridCells` (INV-4). |
| C-5 | `logicalRowIndexOf` is invariant under sort reorder (INV-5). |
| C-6 | Out-of-range `colIndex`/`rowIndex` ⇒ `null`/`[]`/`-1` (INV-7). |
| C-7 | `cellValue` strips injected UI; identity on clean cells (INV-8). |
| C-8 | Results are identical under both activation orders for the same end state (INV-3, SC-002). |

## Consumer migration map (who calls what)

| Consumer (file) | Was | Becomes |
|-----------------|-----|---------|
| `ui/header-utils.ts` `injectPlusIcons` | local `nonInjected*` | `gridRows` / `gridCells` |
| `ui/header-utils.ts` `headerColIndex` | `Array.from(row.cells).indexOf` | `logicalColIndexOf` |
| `ui/header-utils.ts` `inferHeaderColumnType`, `columnHasRowspanBodyCells` | local `nonInjected*` | `sourceCells` / `columnCells` + `cellValue` |
| `ui/toggle-injector.ts` statistics/frequency (col & row) | `th.cellIndex` / `tr.rowIndex` + manual filters | logical index + `columnCells` / `gridCells` + `cellValue` |
| `enrichments/sort.ts` | `row.cells[columnIndex]` | `columnCells` / `cellAt` + `cellValue` |
| `enrichments/filter.ts`, `filter-helpers.ts` | `row.cells[columnIndex]` | `columnCells` / `cellAt` + `cellValue` |
| `enrichments/frequency.ts` | `rows[i].cells[index]`, `table.rows[index]` | `columnCells` / `bodyRows` + `cellValue` |
| `enrichments/heatmap.ts` | `tbody tr:nth-child(index)` | `bodyRows` / `cellAt` (col path already filters) |
| `enrichments/sparkline-column.ts`, `compare-column.ts`, `cumulative-column.ts` | `row.cells[i]` | `sourceCells` / `columnCells` + `cellValue` |
| `enrichments/slider-threshold.ts` | `row.cells[j]` | `gridCells` + `cellValue` |
| `enrichments/slider-injection.ts` | local `nonInjectedRows/Cells` | re-export/delegate to `table-grid` |
| `core/type-detection.ts`, `table-detection.ts` | `row.cells[j]` | `sourceCells` + `cellValue` |
| `utils/view-state-url.ts` `colKeyAt` | already filters injected | optionally delegate to `headerRow`/`gridCells` |
