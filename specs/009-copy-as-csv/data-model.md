# Phase 1 — Data Model: Copy Table As CSV / TSV / Markdown

This feature is read-only over the DOM; its "data model" is the in-memory
structures it builds at Copy time plus the small persisted configuration. No
source DOM is mutated and no schema is stored on the table.

---

## Entities

### 1. `CopyFormat`

```ts
type CopyFormat = 'csv' | 'tsv' | 'md';
```

- The serialisation target chosen in the popup.
- Validation: any other value decoded from the URL/storage falls back to `'csv'`
  silently (FR-019).

### 2. `CopyOptions`

```ts
interface CopyOptions {
  format: CopyFormat;
  headers: boolean;       // include the header row
  rowHeaders: boolean;    // include scope="row" / header-column cell as first field
  virtualCols: boolean;   // include GS-appended virtual columns
}
```

- The full popup configuration. **Page-level** (one per page), not per-table.
- Defaults when nothing is persisted: `{ format:'csv', headers:true,
  rowHeaders:true, virtualCols:true }` (FR-018).
- This is also the **Persisted Config State** entity (spec's "Persisted Format
  State", widened to include the three booleans per FR-018).

### 3. `ExportColumn`

```ts
type ExportColumnKind = 'row-header' | 'source' | 'virtual';

interface ExportColumn {
  kind: ExportColumnKind;
  headerText: string;          // already via cellValue() / exporter.headerText
  align: 'left' | 'right';     // for Markdown; 'right' when source column type is numeric
  // resolver bound at build time:
  cellText(rowEl: HTMLTableRowElement, rowIndex: number, colIndex: number): string;
}
```

- The ordered list of columns to emit, computed once per Copy:
  `[ row-header? , …source columns (visible order) , …virtual columns (if on) ]`.
- `align` is derived from the column's detected data type (numeric → right) and
  used only by the Markdown serialiser.

### 4. `ExportModel`

```ts
interface ExportModel {
  columns: ExportColumn[];
  rows: HTMLTableRowElement[];   // visibleBodyRows minus data-gs-no-export rows
  matrix: string[][];            // rows × columns, rectangular, flattened
  rowCount: number;              // matrix.length
  colCount: number;              // columns.length
}
```

- The rectangular snapshot captured at the moment **Copy** is pressed (spec's
  "Visible View Snapshot").
- `matrix` is built by the model builder per research D-3 (flatten rule). The
  header row is **not** part of `matrix`; serialisers prepend it from
  `columns[].headerText` when `options.headers` is on.
- `rowCount × colCount` is what the toast reports (FR-015). With an empty visible
  view, `rowCount === 0` and the header row is still emitted when `headers` is on
  (Edge Cases).

### 5. `ToastNotification`

- Transient `role="status"` `aria-live="polite"` element communicating the
  outcome (success count or fallback-taken). Auto-dismisses ≤ 5 s; never focused.
- Singleton per page; a new copy replaces the previous message.

---

## Relationships

```text
CopyOptions ──drives──▶ buildExportModel(table, options) ──▶ ExportModel
                                                              │
ExportModel.matrix + columns ──▶ serialise(format) ──▶ string ──▶ clipboard | textarea
                                                                          │
                                                              success ──▶ ToastNotification

CopyOptions ◀──resolve/persist──▶ gs.cp URL fragment + localStorage (copy-persistence.ts)
```

- `buildExportModel` reads (does not mutate) the table via `visibleBodyRows`,
  `table-grid` (`cellValue`, `headerCellFor`, `cellAt`, `sourceColumnCount`,
  `logicalRowIndexOf`), and `listVirtualColumnsForCopy`.
- Exactly one `ExportModel` per Copy press; not cached.

---

## Validation & invariants

- **INV-1 (visibility fidelity)**: `ExportModel.rows ⊆ visibleBodyRows(table)`,
  minus any row carrying `data-gs-no-export` (FR-024). Order equals visible
  (post-sort) order.
- **INV-2 (rectangularity)**: every `matrix[r].length === colCount`; short or
  span-covered positions are `''` (research D-3).
- **INV-3 (no UI leakage)**: every source/row-header cell value passes through
  `cellValue()`, so no lozenge/slider/annotation text appears in output.
- **INV-4 (virtual-column gating)**: when `options.virtualCols` is false, no
  `kind:'virtual'` column exists in `columns`.
- **INV-5 (no source mutation)**: building the model and serialising perform zero
  writes to the source DOM; only the popup/toast (both `data-gs-injected`) are
  added to `document.body`.
- **INV-6 (persistence tolerance)**: decoding `gs.cp` never throws; unknown
  format → `csv`, unparseable boolean → `true`.

---

## State transitions (popup)

```text
[lozenge idle]
   ── click / Enter / Space ──▶ [popup open: config = resolveInitialCopyConfig()]
[popup open]
   ── change format/option ──▶ [popup open: config updated + persistCopyConfig()]
   ── Copy (clipboard ok) ───▶ [popup closed] + [toast: "Copied R rows × C cols as FMT"]
   ── Copy (clipboard fail) ─▶ [popup body → textarea (selected)] + [toast: fallback]
   ── Esc / outside click / Close ──▶ [popup closed, focus → lozenge]
```

- Only one popup open per page at a time (page-level singleton; opening closes
  any prior).
- Toggling Grid-Sight off (`tearDown: removeCopyUi`) closes any open popup and
  toast and removes the lozenge via the standard rebuild.
