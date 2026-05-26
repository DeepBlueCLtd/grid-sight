# Feature Specification: Canonical Table-Grid Addressing Layer

**Feature Branch**: `claude/funny-cannon-ojWpI` (developed on the designated session branch; no separate feature branch created)
**Created**: 2026-05-26
**Status**: Draft
**Input**: User description: "Canonical table-grid addressing layer for enrichment composition" — a single, stateless, logical→physical coordinate authority so enrichments compose correctly regardless of which other enrichments are active or the order in which they were activated.

## Context

Grid-Sight is a browser library that layers "enrichments" (sliders, heatmap, statistics, frequency, sort, filter, virtual columns such as cumulative/sparkline/compare) onto an author's HTML table. Several enrichments mutate the table's DOM structure:

- **Axis sliders** inject scaffolding rows/cells (marked `data-gs-injected`). The row slider prepends a `<th>` to the header row and inserts a `rowspan` cell into **only the first** body row; the column slider prepends an entire `<tr>`.
- **Virtual columns** (cumulative/sum, sparkline, compare) append real, computed columns at the right edge (marked `data-gs-virtual-column`).
- **Sort** physically reorders `<tr>` nodes; **filter** dims rows (no structural change).

Consumers that address cells by physical position (`cell.cellIndex`, `row.cells[i]`, `tbody tr:nth-child(i)`) therefore resolve the *same logical coordinate* to *different author cells* depending on what is active and in what order it was activated. A shipped symptom was statistics trigger buttons landing on the wrong cells once sliders were enabled. The same defect is latent in sort, filter, frequency, the heatmap row lookup, and lozenge state refresh.

This feature is internal architecture (a developer-facing API consumed by enrichments), not an end-user UI. "Users" in the scenarios below are **enrichment authors / the enrichment modules themselves**, and the "author" is the person whose table Grid-Sight enhances.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stable column addressing under structural mutation (Priority: P1)

An enrichment needs to read or act on "the author's column K" (e.g. the column under header "10"). Regardless of whether sliders have injected scaffolding to the left, or virtual columns have been appended to the right, asking the addressing layer for logical column K must always return the author's K-th column — every body cell of it, in every row.

**Why this priority**: This is the demonstrated, shipped bug class. Without it, statistics/heatmap/sort/filter silently operate on the wrong column the moment a slider is active. It is the minimum viable slice and fixes real defects on its own.

**Independent Test**: Build a table, capture each author cell's identity, enable a row slider and a column slider, then ask the layer for each logical column's cells and assert they are the exact same author cells captured before injection.

**Acceptance Scenarios**:

1. **Given** a table with no enrichments active, **When** an enrichment requests logical column K, **Then** it receives the same cells it would receive by naive physical indexing (identity / no behavior change).
2. **Given** a row slider is active (header row has a leading injected `<th>`, first body row carries an injected `rowspan` cell), **When** an enrichment requests logical column K, **Then** it receives the K-th author cell in **every** body row, including the first body row that carries the injected cell.
3. **Given** a column slider is active (a scaffolding `<tr>` is prepended), **When** an enrichment requests the header cell for logical column K, **Then** it receives the author's header cell, not the injected corner/slot cell.
4. **Given** one or more virtual columns have been appended at the right edge, **When** an enrichment requests the count of addressable columns, **Then** virtual columns are included as addressable logical columns ordered after the source columns, while scaffolding cells are never counted.

---

### User Story 2 - Order-independent activation (both permutations) (Priority: P1)

An author may toggle enrichments in any order. Enabling the statistics buttons and *then* the sliders must place and operate those buttons identically to enabling the sliders first and *then* the statistics buttons.

**Why this priority**: The reported failure is fundamentally about composition order. A correctness guarantee that only holds for one activation order is not a fix. Equal priority to US1 because the two together define "correct".

**Independent Test**: Run the same end state via two activation sequences (enrichment→slider and slider→enrichment) and assert the resulting DOM placement and the cells each enrichment reads are identical.

**Acceptance Scenarios**:

1. **Given** trigger buttons are already present on the author headers, **When** a slider is subsequently activated, **Then** the buttons remain on their original author headers and continue to address the correct columns.
2. **Given** a slider is already active, **When** trigger buttons are subsequently injected, **Then** the buttons are placed only on author cells (never on scaffolding cells) and address the correct columns.
3. **Given** either activation order, **When** the same set of enrichments is active, **Then** every enrichment reads the same author cells and the rendered DOM is equivalent.

---

### User Story 3 - Stable row identity across sort and filter (Priority: P2)

An enrichment that needs to know "which author row is this" must get a stable answer even after sort has physically reordered the rows or filter has dimmed some of them.

**Why this priority**: Row-identity drift is less widespread today (most row-oriented code passes row elements directly through the visible-rows pipeline), so it ships after the column work. But an enduring abstraction must own it to avoid a future repeat of the column problem.

**Independent Test**: Capture each row's original-order identity, apply a sort that reverses the visual order, and assert the layer still reports each row's original identity; confirm dimmed (filtered) rows keep their identity and remain addressable.

**Acceptance Scenarios**:

1. **Given** sort has physically reordered the body rows, **When** an enrichment asks for a row's logical identity, **Then** it receives the row's position in the original author order, not its current visual position.
2. **Given** filter has dimmed some rows, **When** an enrichment enumerates body rows, **Then** dimmed rows are still present and addressable (dimming does not remove them from the logical grid).
3. **Given** all enrichments are toggled off, **When** the table is inspected, **Then** rows are back in original author order and the DOM is byte-identical to before any enrichment ran.

---

### User Story 4 - Canonical cell value reading (Priority: P2)

An enrichment that reads a cell's data value (for parsing numbers, detecting column type, comparing for sort/filter) must get the author's data text, never polluted by Grid-Sight UI that other enrichments injected inside that cell (lozenge button clusters, slider readouts).

**Why this priority**: Today this is only accidentally safe (numeric parsing happens to strip a numeric prefix). Categorical comparison, type detection, and future readers are exposed. Centralizing the rule removes a whole class of latent ordering bugs.

**Independent Test**: Inject a lozenge cluster into a header/cell, then ask the layer for that cell's value and assert it equals the original author text with no UI fragments.

**Acceptance Scenarios**:

1. **Given** a cell contains author text plus an injected Grid-Sight UI element, **When** an enrichment reads the cell's value via the layer, **Then** it receives only the author text.
2. **Given** a cell contains only author text, **When** read via the layer, **Then** the value is identical to the raw trimmed text content (identity / no behavior change).

---

### Edge Cases

- **Rowspan scaffolding**: the row-slider cell exists in only the first body row with `rowspan` spanning the rest — logical column K must still resolve per-row to the same author column in every row.
- **Both sliders at once**: left-injected cells (row slider) and a prepended row (column slider) are simultaneously present.
- **Header colspan**: an author header cell that legitimately spans multiple columns must be handled deterministically (documented rule), distinct from injected scaffolding.
- **No tbody / header in tbody vs thead**: tables where the header lives in `<thead>` vs an implicit first `<tr>` in `<tbody>` must classify the header row consistently.
- **tfoot rows**: footer rows (used by some virtual columns) must be classified as non-body so they are not mistaken for data rows.
- **Out-of-range logical index**: requesting a column/row index beyond the grid returns an explicit "not found" result rather than a wrong-but-plausible cell.
- **Empty table / single column**: degrade gracefully (no crash, sensible empty results).
- **Virtual column requested as a source coordinate**: source-only views must exclude virtual columns even though grid views include them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single addressing layer that is the only sanctioned path for translating between a logical (row, column) coordinate and a live DOM cell, and back.
- **FR-002**: The layer MUST be stateless with respect to activation history — every query is computed from the live DOM and structural marker attributes at call time, so results never depend on the order in which enrichments were activated.
- **FR-003**: The layer MUST classify any node carrying the scaffolding marker (`data-gs-injected`) as never part of the logical data grid (excluded from all row, column, and cell enumerations).
- **FR-004**: The layer MUST classify any cell carrying the virtual-column marker (`data-gs-virtual-column`) as a real, addressable logical column, ordered after the source columns.
- **FR-005**: The layer MUST expose logical row access that returns the header row and the ordered body rows, excluding scaffolding rows and footer rows from the body set.
- **FR-006**: The layer MUST expose two per-row cell views: a "grid" view (source + virtual columns — the surface that lozenges, sort, filter, statistics, and frequency address) and a "source" view (source columns only — the surface that slider axis-binding and column-type detection use).
- **FR-007**: The layer MUST provide rowspan-safe column access such that requesting logical column K returns the K-th author cell in every body row, including a row that carries an injected `rowspan` scaffolding cell.
- **FR-008**: The layer MUST provide bidirectional translation: cell-at-(row, col), all body cells of a logical column, the header cell for a logical column, the logical column index of a given cell, and the logical row identity of a given row.
- **FR-009**: The logical row identity MUST reflect the row's position in the original author order even after sort has physically reordered rows, by consulting the existing original-order record when one is present, and falling back to current DOM order when none exists.
- **FR-010**: The layer MUST provide a canonical cell-value reader that returns a cell's author data text while ignoring Grid-Sight-injected UI contained within the cell.
- **FR-011**: The layer MUST NOT introduce any new DOM nodes, classes, or marker attributes of its own (so byte-identical teardown of every enrichment is preserved).
- **FR-012**: The layer MUST return identical results to naive physical indexing when no enrichment is active (identity / zero behavior change for the un-enriched case).
- **FR-013**: All existing physical-index consumers MUST be migrated to the layer: sort comparison, filter predicates and helpers, frequency extraction, the heatmap row lookup, the lozenge column-index/state-refresh helpers, the toggle-injector heatmap and row-frequency sites, sparkline/compare/cumulative value extraction, threshold-slider cell reads, and column-type detection.
- **FR-014**: The duplicated `non-injected rows/cells` helpers (currently copy-pasted across modules) MUST be unified by delegating to the layer, leaving a single source of truth.
- **FR-015**: Out-of-range or unresolvable coordinates MUST yield an explicit empty/not-found result, never a silently incorrect cell.
- **FR-016**: The layer MUST introduce no new runtime dependencies and keep the enrichment bundle within its existing size budget.

### Key Entities *(include if feature involves data)*

- **Logical Grid**: the conceptual matrix of the author's data as it existed before any enrichment, plus any virtual columns appended at the right edge; the stable coordinate space all enrichments share.
- **Source Column**: a column supplied by the author (excludes virtual columns and scaffolding).
- **Virtual Column**: a Grid-Sight-computed column (cumulative/sum, sparkline, compare) that is addressable as a logical column but is not author source data.
- **Scaffolding Node**: an injected row/cell that exists only to host slider chrome; never part of the logical grid.
- **Logical Coordinate**: a (row, column) pair expressed in the stable logical space, independent of current physical DOM position.
- **Original Order Record**: the pre-existing snapshot of the author's row sequence, used to answer logical row identity after sort reorders the DOM.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every consumer enrichment, addressing logical column K resolves to the same author cell across the full matrix of `{no slider, row slider, column slider, both} × {no virtual column, +cumulative, +sparkline} × {unsorted, sorted}` — 100% of matrix cells pass.
- **SC-002**: The same end state reached via both activation orders (enrichment-before-slider and slider-before-enrichment) produces identical cell resolution and equivalent rendered placement — 0 discrepancies.
- **SC-003**: With no enrichment active, the layer's results are identical to naive physical indexing for 100% of cells (zero behavior change for un-enriched tables).
- **SC-004**: After toggling all enrichments off, the table DOM is byte-identical to its pre-enrichment state (no markers, nodes, or attributes left by the addressing layer).
- **SC-005**: The full existing automated suite (unit, Storybook interaction, end-to-end) continues to pass with no regressions.
- **SC-006**: No physical-index cell/row access (`cellIndex`, `rows[i]`/`cells[i]` against the live DOM, `:nth-child` row lookups) remains in any migrated consumer; such access goes through the layer.
- **SC-007**: The net runtime bundle size delta stays within the project's existing budget and no new runtime dependency is added.

## Assumptions

- The existing structural markers (`data-gs-injected` for scaffolding, `data-gs-virtual-column` for virtual columns) are the authoritative signals and are reliably set by the enrichments that inject DOM; the layer reads but does not define new markers.
- The existing original-order record is the source of truth for the author's row sequence and is captured before sort reorders rows; the layer consults it rather than re-deriving identity.
- Virtual columns are always appended at the right edge after source columns (the established insertion convention); the layer relies on this ordering rather than imposing a new one.
- Header detection follows the established convention (first non-scaffolding row is the header row); tables relying on `<thead>` vs an implicit header row are both supported.
- This is a developer-facing internal abstraction; there is no new end-user UI, copy, or visible control introduced by this feature.
- The work targets the same evergreen-browser and offline/`file://` constraints as the rest of the project (no new platform requirements).
