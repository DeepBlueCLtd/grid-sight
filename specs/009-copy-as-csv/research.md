# Phase 0 — Research: Copy Table As CSV / TSV / Markdown

All decisions below are grounded in the current codebase (verified against
`src/core/table-grid.ts`, `src/utils/visible-rows.ts`,
`src/utils/copy-as-csv-registry.ts`, `src/utils/outlier-persistence.ts`,
`src/ui/popup-chrome.ts`, `src/ui/header-utils.ts`, and
`src/core/enrichment-registry.ts`). No `NEEDS CLARIFICATION` markers remain.

---

## D-1: Where does the "current visible view" come from?

**Decision**: Read body rows via `visibleBodyRows(table)` from
`src/utils/visible-rows.ts`. It returns the rows whose pipeline state is
`'visible'` (excludes `'dimmed'` / `'hidden'`), already in render order (sort is
applied by reordering the DOM), and falls back to all `bodyRows(table)` for a
table the pipeline never touched.

**Rationale**: This is the *sanctioned* read-channel — the same one statistics,
summary-row, and find-in-table (spec 014) consume. Using it guarantees the
export agrees with what every other enrichment considers "visible", and we
inherit sort ordering and filter results for free without re-implementing them.

**Alternatives considered**:
- Walking `tbody.rows` and testing `data-gs-dimmed` / `display` ourselves —
  rejected: duplicates pipeline logic and would drift; also wouldn't honour the
  identity fallback for untouched tables.
- Subscribing to `onVisibleRowsChange` — unnecessary: copy is a one-shot read at
  the moment **Copy** is pressed, so a snapshot read (`current()`) is correct.

---

## D-2: Column set, order, header text, and cell text

**Decision**: Resolve structure through `table-grid`:
- Source columns: iterate logical column indices `0 … sourceColumnCount(table)-1`;
  header text from `headerCellFor(table, colIndex)` via `cellValue(...)`; per-row
  cell from `cellAt(table, rowIndex, colIndex)` via `cellValue(...)`.
- Virtual columns: from `listVirtualColumnsForCopy(table)` — each entry's
  `exporter.headerText` and `exporter.getCellText(rowEl)`. Appended **after** the
  source columns (their rendered position), and only when "include GS virtual
  columns" is on.
- All author-data text comes from `cellValue()` (clones the cell, strips
  GS-owned UI such as lozenges/sliders/annotations, returns trimmed
  `textContent`). The export never reads raw `innerHTML`/SVG.

**Rationale**: `cellValue()` is the single canonical "data text of a cell"
reader (spec 013). Using the registry exporters means the sparkline column
exports its underlying numeric series (the exporter's responsibility), never SVG
— satisfying the spec's sparkline edge case without this feature knowing
anything about sparklines.

**Alternatives considered**:
- Reading rendered virtual-column DOM directly — rejected: would capture SVG /
  formatted markup and re-couple copy to each virtual-column's rendering.

---

## D-3: rowspan / colspan flattening

**Decision**: Produce a rectangular `string[][]` matrix of
`rows × (rowHeaders? + sourceCols + virtualCols)`. For each visible row,
populate source-column fields by logical column index using the row's own
present cells (`gridCells(row)` mapped to their logical positions); any logical
column position **not** physically present in that row (because it is covered by
a `rowspan`/`colspan` from another row, or the row is short) is emitted as an
**empty field**. The originating cell's value appears once, at its own
(row, column) origin.

**Rationale**: Matches the spec's stated rule verbatim ("source cell's value in
the source position and empty fields for every spanned position") and yields a
clean rectangular grid that pastes predictably into spreadsheets. It is the
literal flatten of the HTML rather than a semantic fill.

**Alternatives considered**:
- Using `cellAt()`'s rowspan-safe resolution everywhere (which *repeats* the
  spanning cell's value into covered positions) — rejected: contradicts the
  spec and would duplicate values down a merged column. (We still use `cellAt`
  for header/origin lookups, just not to back-fill covered positions.)
- Emitting ragged rows — rejected: breaks CSV/TSV column alignment and GFM table
  validity.

This decision is documented in the popup's "i" tooltip per spec FR-005 / Edge
Cases.

---

## D-4: Serialisation formats (pure, DOM-free)

**Decision**: Three pure functions in `src/enrichments/csv-serialize.ts` taking
the matrix (and, for Markdown, per-column alignment hints):

- `toCsv(matrix)` — **RFC 4180**: comma delimiter, `\r\n` line endings; a field
  is wrapped in double quotes iff it contains `,`, `"`, `\r`, or `\n`; internal
  `"` doubled.
- `toTsv(matrix)` — tab delimiter, `\n` line endings, **no quoting**; any `\t`,
  `\r`, or `\n` inside a field replaced with a single space.
- `toMarkdown(matrix, aligns)` — GFM table: header row, separator row with
  alignment (`:---`, `:---:`, `---:`) derived from column data type when
  detectable (numeric → right) else default; body rows pipe-delimited; `|`
  escaped as `\|`; intra-cell newlines replaced with a single space.

**Rationale**: Keeping serialisation pure and DOM-free makes it directly
unit-testable against published RFC 4180 / GFM vectors and keeps it free of
clipboard/permission concerns. Matches the project's preference for small,
testable units (e.g. `outlier-marks.ts`).

**Alternatives considered**:
- A single parameterised serialiser — rejected: the three formats differ in
  quoting/escaping rules enough that branching would be less readable and harder
  to test than three focused functions sharing small helpers.
- A CSV library dependency — rejected: constitution §I (no new runtime deps);
  RFC 4180 quoting is a few lines.

---

## D-5: Clipboard write + fallback

**Decision**: At Copy time, attempt
`await navigator.clipboard?.writeText(serialised)` guarded by feature detection
and wrapped in `try/catch`. On **success** → show the toast and close the popup.
On **absent API / rejected promise / thrown error** → replace the popup body
with a focused, fully-selected read-only-feeling `<textarea>` containing the
serialised output (for manual `Ctrl/Cmd+C`) and announce that the fallback path
was taken.

**Rationale**: `navigator.clipboard.writeText` is widely available but
permission- and secure-context-sensitive; `file://` and some embedded contexts
fail. The textarea fallback is the universally-supported path and satisfies
constitution §V (feature-detect + graceful fallback) and §VI (local-only).

**Alternatives considered**:
- `document.execCommand('copy')` as the primary path — rejected: deprecated;
  the async clipboard API is the modern primary with the textarea as the
  resilient fallback.
- Throwing on failure — rejected: must never throw into the host page
  (constitution §IV).

---

## D-6: Persistence shape and channel

**Decision**: A single **page-level** persisted record (not per-table):
`{ format: 'csv'|'tsv'|'md', headers: boolean, rowHeaders: boolean,
virtualCols: boolean }`. Encode into the URL fragment under a dedicated
`gs.cp` segment and mirror to `localStorage` (`gs:${stem}:copy`), following
`outlier-persistence.ts` exactly: `read…FromUrl`, `write…ToUrl`,
`read…FromStorage`, `write…ToStorage`, `persistCopyConfig`,
`resolveInitialCopyConfig` (priority URL > storage > defaults). Defaults are
`format:'csv'` and all three booleans `true`. Decoding never throws: an
unknown/unsupported `format` silently falls back to `csv`; an unparseable
boolean falls back to its `true` default.

**Rationale**: The popup configuration is a user *preference*, not table state,
so one page-level record is the simplest correct model and keeps the URL small.
Reusing the outlier-persistence shape gives us the dual URL+storage behaviour,
the `urlStem()` keying, and the malformed-tolerant decode for free.

**Alternatives considered**:
- Per-table persistence — rejected: the format/options aren't table-specific;
  per-table records would bloat the fragment with no user benefit.
- localStorage only — rejected: spec SC-004 requires URL-only reproducibility on
  another machine with no localStorage dependency.

---

## D-7: Affordance mount + lifecycle

**Decision**: Register a table-level descriptor via `registerEnrichment` in a
new `src/ui/copy-csv-lozenge.ts` (side-effect imported from `index.ts`), with
`appliesTo: (ctx) => ctx.headerType === 'table' &&
!ctx.table.hasAttribute('data-gs-no-export')` and a `mount` that builds the
corner `<button>` (reusing the shared `.gs-lozenge` class + `data-gs-lozenge-id`
convention seen in `find-in-table-box.ts` / `virtual-column-lozenges.ts`) and
opens the popup on click. Flip the catalog entry to `shipped: true` and add
`tearDown: removeCopyUi` (closes any open popup + toast). No `apply` hook is
needed — there is no persisted *on-table* state to re-render; the popup reads
the page-level config lazily when opened. `data-gs-ignore` is already excluded by
`buildDescriptorAffordances`; `data-gs-no-export` is excluded in `appliesTo`.

**Rationale**: This is exactly how every other table-level lozenge (sliders,
compare, find-in-table) mounts, so the toggle-panel on/off gating, per-table
enabled-set resolution (spec 015), and lozenge-rebuild pipeline drive it for
free.

**Alternatives considered**:
- Exporting `buildLozenge` from `header-utils.ts` to reuse it externally —
  rejected: it is intentionally module-private; the sibling external descriptors
  build their own buttons against the shared CSS class, so we follow suit.
- Adding an `apply` hook — rejected: nothing to re-apply on toggle-on.

---

## D-8: Toast

**Decision**: A minimal `src/ui/copy-toast.ts` exposing `showCopyToast(message)`
that creates (or reuses a singleton) `role="status"` `aria-live="polite"`
element appended to `document.body`, sets its text, and auto-dismisses after ≤ 5
seconds (SC; FR-015). It never receives focus (FR-022) and is marked
`data-gs-injected` so it's outside the grid model.

**Rationale**: No toast utility exists in the codebase; the slider control's
`aria-live` region (`src/ui/slider-control.ts`) is the established pattern for
transient announcements. A tiny dedicated helper keeps it reusable and testable
and avoids coupling the announcement to the popup's lifetime.

**Alternatives considered**:
- Announcing inside the popup — rejected: the popup closes on success, so the
  announcement needs to outlive it.
- A third-party toast library — rejected: constitution §I.

---

## Resolved unknowns summary

| Unknown | Resolution |
|---------|-----------|
| Visible-view source | `visibleBodyRows()` (`src/utils/visible-rows.ts`) |
| Cell/header/column text | `table-grid` `cellValue` / `headerCellFor` / `cellAt` / `sourceColumnCount` |
| Appended columns | `listVirtualColumnsForCopy()` → `VirtualColumnExport` |
| rowspan/colspan | Flatten: value at origin, empty for covered positions (spec rule) |
| Clipboard | `navigator.clipboard?.writeText` + textarea fallback |
| Persistence | Page-level `{format,headers,rowHeaders,virtualCols}` via `gs.cp` URL + localStorage (outlier-persistence shape) |
| Mount/lifecycle | `registerEnrichment` table-level descriptor; `shipped:true`; `tearDown: removeCopyUi` |
| Toast | `role="status"` `aria-live="polite"` singleton, auto-dismiss ≤ 5 s |
