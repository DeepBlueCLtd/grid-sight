# Phase 1 — Internal Module Contracts: Copy as CSV

These are **internal** module surfaces (not added to the frozen
`window.gridSight.init` public API). They document the seams this feature adds
and the existing seams it consumes. Signatures are TypeScript.

---

## NEW — `src/enrichments/csv-serialize.ts` (pure, DOM-free)

```ts
/** A rectangular grid of already-resolved cell strings (no header row). */
export type Matrix = ReadonlyArray<ReadonlyArray<string>>;

export type ColumnAlign = 'left' | 'right';

/** RFC 4180: comma delimiter, CRLF, quote-wrap on , " CR LF, internal " doubled. */
export function toCsv(header: readonly string[] | null, body: Matrix): string;

/** Tab delimiter, LF, no quoting; tab/CR/LF inside a field → single space. */
export function toTsv(header: readonly string[] | null, body: Matrix): string;

/** GFM table; `|` → `\|`, intra-cell newline → space; alignment from `aligns`. */
export function toMarkdown(
  header: readonly string[] | null,
  body: Matrix,
  aligns: readonly ColumnAlign[],
): string;
```

- `header === null` ⇒ omit the header row (CSV/TSV). For Markdown, a header is
  structurally required by GFM; when "include headers" is off, the builder
  supplies blank header cells (documented behaviour) rather than emitting an
  invalid table.
- Pure: no DOM, no clipboard, no globals. Fully unit-testable.

**Behaviour guarantees**
- `toCsv` round-trips RFC 4180 reference vectors (embedded comma, quote,
  newline).
- Empty `body` with a non-null `header` ⇒ header-only output (Edge Cases).

---

## NEW — `src/enrichments/copy-as-csv.ts` (orchestrator)

```ts
import type { CopyOptions } from '../utils/copy-persistence';

export interface ExportColumn {
  kind: 'row-header' | 'source' | 'virtual';
  headerText: string;
  align: 'left' | 'right';
  cellText(rowEl: HTMLTableRowElement, rowIndex: number, colIndex: number): string;
}

export interface ExportModel {
  columns: ExportColumn[];
  rows: HTMLTableRowElement[];
  matrix: string[][];
  rowCount: number;
  colCount: number;
}

/** Build the rectangular export snapshot for the current visible view. Reads
 *  visibleBodyRows + table-grid + the copy registry; mutates nothing. */
export function buildExportModel(
  table: HTMLTableElement,
  options: CopyOptions,
): ExportModel;

/** Serialise an ExportModel to the chosen format (delegates to csv-serialize). */
export function serialiseModel(model: ExportModel, options: CopyOptions): string;

/** Teardown hook wired into the enrichment registry: closes any open popup +
 *  toast for the table. No source-DOM changes to revert. */
export function removeCopyUi(table: HTMLTableElement): void;
```

**Behaviour guarantees**
- `buildExportModel` excludes rows with `data-gs-no-export` and rows not in
  `visibleBodyRows` (INV-1). Includes `row-header` column first iff
  `options.rowHeaders`. Appends `virtual` columns iff `options.virtualCols`,
  sourced from `listVirtualColumnsForCopy(table)`.
- All source/row-header text via `table-grid.cellValue()`; virtual text via
  `exporter.getCellText(rowEl)` (INV-3, sparkline-as-series).
- Matrix is rectangular with `''` for span-covered/short positions (INV-2).

---

## NEW — `src/ui/copy-csv-popup.ts`

```ts
export interface CopyPopupArgs {
  table: HTMLTableElement;
  anchor: HTMLElement;          // the lozenge button
  onClose?: () => void;
}

/** Open the modal dialog. Reads CopyOptions via resolveInitialCopyConfig();
 *  persists on every change; performs clipboard write or textarea fallback on
 *  Copy; shows the toast on success. Returns a dispose() that closes it. */
export function openCopyPopup(args: CopyPopupArgs): () => void;

/** Close every open copy popup (used by removeCopyUi / teardown). */
export function closeAllCopyPopups(): void;
```

- Uses `installPopupChrome(popup, anchor, focusables, onClose)` + `positionPopup`
  from `src/ui/popup-chrome.ts` for focus-trap, Esc, outside-click, and
  focus-restore (FR-004, FR-021).
- Dialog DOM: `role="dialog"`, labelled title, format radios, three checkboxes,
  Copy + Close, and a brief "i" note explaining "current visible view" and the
  flatten rule (FR-003, FR-005). Marked `data-gs-injected`.
- Clipboard: `await navigator.clipboard?.writeText(text)` guarded + `try/catch`;
  on failure swaps body for a selected `<textarea>` (FR-013, FR-014).

---

## NEW — `src/ui/copy-toast.ts`

```ts
/** Announce a transient message via a singleton role="status" aria-live="polite"
 *  region; auto-dismiss after <= 5s; never steals focus. */
export function showCopyToast(message: string): void;

/** Remove the toast immediately (teardown). */
export function hideCopyToast(): void;
```

---

## NEW — `src/ui/copy-csv-lozenge.ts` (descriptor registration; side-effect import)

```ts
import { registerEnrichment } from '../core/enrichment-registry';
import { openCopyPopup } from './copy-csv-popup';

registerEnrichment({
  id: 'copy-as-csv',
  appliesTo: (ctx) =>
    ctx.headerType === 'table' && !ctx.table.hasAttribute('data-gs-no-export'),
  // not a stateful toggle: isActive omitted (defaults to inactive)
  mount: (ctx) => /* build <button class="gs-lozenge" data-gs-lozenge-id="copy-as-csv">; onClick → openCopyPopup */,
});
```

- Imported for side-effect from `src/index.ts`:
  `import './ui/copy-csv-lozenge';`.

---

## NEW — `src/utils/copy-persistence.ts` (mirrors `outlier-persistence.ts`)

```ts
export type CopyFormat = 'csv' | 'tsv' | 'md';

export interface CopyOptions {
  format: CopyFormat;
  headers: boolean;
  rowHeaders: boolean;
  virtualCols: boolean;
}

export function encodeCopyFragment(opts: CopyOptions): string;
export function decodeCopyFragment(raw: string): CopyOptions;   // never throws

export function readCopyFromUrl(hash?: string): CopyOptions | undefined;
export function writeCopyToUrl(opts: CopyOptions, hash?: string): string;

export function readCopyFromStorage(stem?: string): CopyOptions | undefined;
export function writeCopyToStorage(opts: CopyOptions, stem?: string): void;

/** Write to BOTH URL fragment (history.replaceState) and localStorage. */
export function persistCopyConfig(opts: CopyOptions): void;

/** Init priority: URL > storage > defaults {csv,true,true,true}. */
export function resolveInitialCopyConfig(): CopyOptions;
```

- URL segment id: `gs.cp`. Storage key: `gs:${stem}:copy` (via shared
  `urlStem()`). Grammar (compact): `gs.cp=fmt:csv;h:1;rh:1;vc:1`.
- `decodeCopyFragment`: unknown `fmt` → `csv`; unparseable boolean → `true`
  (FR-019, INV-6).

---

## MODIFIED — `src/core/enrichment-registry.ts`

```ts
// was: { id: 'copy-as-csv', label: 'Copy as CSV', defaultOn: true, shipped: false }
{ id: 'copy-as-csv', label: 'Copy as CSV', defaultOn: true, shipped: true,
  tearDown: removeCopyUi },  // spec 009
```

- No `apply` hook (nothing to re-render on toggle-on; popup reads config lazily).

---

## CONSUMED — existing surfaces (unchanged)

| Module | Used for |
|--------|----------|
| `src/utils/visible-rows.ts` → `visibleBodyRows(table)` | Visible, post-sort/filter rows |
| `src/core/table-grid.ts` → `cellValue`, `headerCellFor`, `cellAt`, `sourceColumnCount`, `gridCells`, `logicalRowIndexOf` | Column structure, canonical cell text, flatten |
| `src/utils/copy-as-csv-registry.ts` → `listVirtualColumnsForCopy(table)` | Appended-column header + cell text |
| `src/ui/popup-chrome.ts` → `installPopupChrome`, `positionPopup` | Dialog focus-trap / Esc / outside-click / position |
| `src/core/enrichment-registry.ts` → `registerEnrichment` | Lozenge descriptor mount |
