# Phase 0 Research: Canonical Table-Grid Addressing Layer

All decisions below resolve the "NEEDS CLARIFICATION" surface of the technical
context. None required external research; the questions are about *our own*
DOM conventions, which the audit (recorded inline) settled.

## R-1 — Two coordinate systems, one authority

**Decision**: Define a single **logical** coordinate space and make
`table-grid.ts` the only translator to/from physical DOM. Logical column index
= position among non-scaffolding cells in a row; logical row index = position
in the Original Order Record (or current body order if no record).

**Rationale**: The shipped bug and its latent siblings all stem from consumers
each re-deriving "where is column K" against the live DOM with different
(in)correct rules. One authority eliminates the divergence and the
copy-pasted helpers.

**Alternatives considered**:
- *Stamp logical coords onto every cell* (extend the existing `data-gs-rc`
  scheme to all cells/headers). Rejected: it adds markers (violates the
  zero-new-DOM constraint / complicates byte-identical teardown) and must be
  re-stamped on every structural mutation — i.e. stateful, the very thing that
  makes ordering matter. A stateless read layer is simpler and order-immune.
- *A cached per-table index map invalidated on mutation*. Rejected: invalidation
  is exactly where ordering bugs hide; the live DOM is already the source of
  truth and filtering it is cheap at our scale (≤ 50 cols).

## R-2 — Marker semantics: scaffold vs virtual column

**Decision**: `data-gs-injected` ⇒ **scaffold**, never part of the logical grid
(excluded from rows, cells, counts). `data-gs-virtual-column` ⇒ a **real
logical column**, included and ordered after source columns. Provide two cell
views: `gridCells(row)` (source + virtual) and `sourceCells(row)` (source only,
also excluding virtual).

**Rationale**: Confirmed by the audit — sliders mark scaffolding `data-gs-injected`;
virtual columns (cumulative/sparkline/compare) are appended at the right edge
via `virtual-column.ts` at index `sourceCount + canonicalIdx` and marked
`data-gs-virtual-column`. Slider axis-binding and column-type detection must see
*only* author data (source view); lozenges/sort/filter/stats legitimately
address virtual columns too (grid view). One marker is "skip always", the other
is "keep, but classifiable".

**Alternatives considered**:
- *Treat virtual columns as scaffold too*. Rejected: users can sort by / run
  stats on a computed column; excluding them outright would break those flows.
- *A single "is this a data cell" predicate*. Rejected: insufficient — the
  source-vs-grid distinction is load-bearing (slider binding vs sort target).

## R-3 — Rowspan-safe column access (the row-slider trap)

**Decision**: Column access resolves **per row** as "the K-th non-scaffold cell
of *this* row", never `someRow.cells[K]` with a single shared integer.

**Rationale**: The row slider injects its body cell with `rowspan` into **only
the first** body row, so a fixed physical index K means different things in
different rows. Filtering scaffold cells per row makes K consistent because the
injected cell is removed from every row's view (it only exists in row 0 anyway).
This is exactly the property the shipped fix relied on; the layer generalises it.

**Alternatives considered**: HTML table "slot"/colspan-aware coordinate math
(à la the CSS table layout algorithm). Rejected as overkill: author tables in
scope use simple 1×1 data cells; scaffold filtering plus an explicit
documented rule for *author* `colspan` headers (R-6) covers the real cases at a
fraction of the complexity and bundle cost.

## R-4 — Logical row identity under sort

**Decision**: `logicalRowIndexOf(row)` returns `getRecord(table)?.indexOf(row)`
when an Original Order Record exists, else the row's index within
`bodyRows(table)`. Reuse `original-order.ts` verbatim; do not duplicate it.

**Rationale**: Sort physically reorders `<tr>` via `appendChild`; the OOR
already captures the author order once at first sort/filter activation and is
the agreed source of truth (it also powers byte-identical teardown). Filter
only dims (no reorder), so dimmed rows keep identity automatically.

**Alternatives considered**: A new row-key scheme (hash of row content / a
stamped `data-gs-row-id`). Rejected: redundant with the OOR and would add a
marker.

## R-5 — Canonical cell value (`cellValue`)

**Decision**: `cellValue(cell)` returns the cell's text **excluding** Grid-Sight
injected UI. Implementation reads text nodes / clones and strips known GS
containers (`.gs-lozenge-cluster`, `[data-gs-slider-readout]`, and any element
carrying a GS-owned class/attribute), then trims. Provide it as the one reader
that slider parsing, type detection, sort, and filter use.

**Rationale**: Today header parsing is only *accidentally* safe — `parseHeaderNumber`
strips a numeric prefix, so `"10" + "H#↕▽"` still parses to `10`, and body `<td>`
cells carry no lozenges. But categorical sort/filter comparison and type
detection read full `textContent`; a future UI injected into a `<td>` (or a
header compared categorically) would silently corrupt the value. Centralising
"what is the data text of a cell" removes the whole class of ordering-dependent
value bugs and is cheap.

**Alternatives considered**:
- *Stamp `data-gs-value` on every cell at enable time*. Rejected: a marker, and
  it goes stale if author content changes; reading live text is correct and
  marker-free.
- *Leave parsing leniency as-is*. Rejected: it's load-bearing-by-accident and
  doesn't cover categorical/text reads — exactly the latent risk this feature
  exists to remove.

## R-6 — Header-row detection and author `colspan`

**Decision**: Header row = the first non-scaffold row. Reuse the established
detection already encoded in `original-order.ts::getDataRows` (header is
`table.rows[0]` iff it's the first row of the implicit/`tbody` block and
contains a `<th>`; with an explicit `<thead>` the body starts at data rows).
For an **author** header cell with `colspan > 1`, the documented rule is: it
occupies `colspan` consecutive logical column slots; addressing any of those
slots returns that header cell, and body-column access uses per-row scaffold
filtering as in R-3. Tables with rowspan in *body data* columns already suppress
sort/filter (existing `columnHasRowspanBodyCells`) and are out of the addressing
guarantee for those columns.

**Rationale**: Consistency with existing behaviour; `getDataRows` is already the
project's header heuristic and is reused rather than reinvented. Author colspan
is rare in scope but must have a deterministic answer for FR-015.

**Alternatives considered**: A bespoke header detector. Rejected — divergence
from `getDataRows` would itself be a new inconsistency.

## R-7 — Migration order & safety net

**Decision**: Land the module + tests first; then make `header-utils.ts` and
`slider-injection.ts` *delegate* their existing `nonInjectedRows/Cells` to it
(pure refactor, behaviour-preserving — guarded by the existing suites). Then
migrate the confirmed-wrong consumers in priority order: (1) sort/filter/
filter-helpers and frequency and heatmap nth-child and `headerColIndex` and the
toggle-injector sites [these are demonstrated or latent correctness bugs], then
(2) sparkline/compare/cumulative/threshold and type-detection [defence-in-depth;
mostly read source cells already at safe indices].

**Rationale**: Delegation first gives a zero-risk safety net and proves the API
against the two most exercised call sites before touching value-extraction
code. Priority (1) closes real bugs; priority (2) prevents recurrence.

**Alternatives considered**: Big-bang migration. Rejected: harder to review and
to bisect if a regression appears.

## R-8 — Composition test strategy

**Decision**: A parametrized Vitest suite builds a known table, captures each
author cell's identity, then for every point in
`{none, row, col, both} × {none, +cumulative, +sparkline} × {unsorted, sorted}`
asserts: (a) `columnCells(K)` returns exactly the captured author cells for each
source column K; (b) `headerCellFor(K)` is the author header; (c)
`cellValue` is unpolluted; and runs each point under **both** activation orders
(enrichment-first vs slider-first). A thin per-consumer assertion confirms each
migrated consumer reads through the layer.

**Rationale**: Encodes SC-001/SC-002/SC-003 directly as executable truth and
will fail loudly on any future enrichment that forgets the layer.

**Alternatives considered**: Per-consumer ad-hoc tests only. Rejected: misses
the cross-product interactions that are the actual failure surface.

## Open questions

None. All technical-context unknowns are resolved above. No `[NEEDS CLARIFICATION]`
remain.
