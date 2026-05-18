# Feature Specification: Row Sparkline Enrichment

**Feature Branch**: `005-sparkline`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "Add a table-level lozenge that appends a virtual 'Trend' column rendering an inline SVG sparkline per row across the table's numeric body columns, with a per-row vs shared scaling mode and shareable URL state."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a per-row trend across numeric columns (Priority: P1)

A user is reading a table whose body has three or more numeric columns (e.g.
quarterly figures `Q1`, `Q2`, `Q3`, `Q4`). They want to see at a glance the shape
of each row's values — going up, going down, spiking — without scanning four
numbers per row. With Grid-Sight enabled, a sparkline lozenge (**⌇**) appears in
the table's corner lozenge cluster (alongside `S`). Clicking it appends a virtual
"Trend" column to the table: each body row gets a small inline SVG mini bar
chart summarising that row's values across the eligible numeric columns. The
column header reads "Trend" (or the localised equivalent) and is styled to match
the table's existing header.

**Why this priority**: A row sparkline is the single highest-bandwidth visual
addition Grid-Sight can offer for a multi-column numeric table. It replaces N
columns of mental arithmetic with one glance. Until a reader can see row shape,
they cannot triage rows efficiently. This is the feature.

**Independent Test**: Open a page with a table having columns
`[Region, Q1, Q2, Q3, Q4]` where each `Qn` is numeric. Toggle Grid-Sight on,
click the sparkline lozenge in the corner cluster, and confirm a new "Trend"
column appears at the right of the table with one SVG mini bar chart per row,
each chart rendering four bars whose heights reflect that row's `Q1`–`Q4` values.

**Acceptance Scenarios**:

1. **Given** a table with three numeric body columns and five body rows,
   **When** the user activates the sparkline lozenge, **Then** a new "Trend"
   column appears at the right of the table with five SVG mini bar charts,
   each containing three bars in column order.
2. **Given** the sparkline column is rendered, **When** the user inspects the
   DOM, **Then** none of the original body cells have been modified; the new
   "Trend" column is appended as additional `th` / `td` cells outside the
   original cell set.
3. **Given** the sparkline lozenge is active, **When** the user clicks it
   again, **Then** the "Trend" column is removed and every appended `th` /
   `td` cell is cleaned up.

---

### User Story 2 - Hover a sparkline to highlight context and read its values (Priority: P2)

The user wants to know, for a specific row's sparkline, the underlying numbers and
which columns the bars belong to. Hovering over a row's sparkline (or focusing it
by keyboard) reveals a small tooltip showing the row's min, max, and last value,
and at the same time highlights the corresponding header cells above (the
numeric columns the sparkline summarises). Moving away from the sparkline
removes both the tooltip and the highlight.

**Why this priority**: The sparkline shows shape; the tooltip and header
highlight answer "what columns are these bars" and "what are the actual values".
Without this pairing, the sparkline is decorative; with it, the sparkline is a
navigable summary.

**Independent Test**: Activate the sparkline column on a table with eligible
numeric columns. Hover or focus on one row's sparkline, confirm a tooltip shows
that row's min / max / last value, and confirm the four corresponding header
cells above receive a visible highlight while the focus / hover is held.

**Acceptance Scenarios**:

1. **Given** the sparkline column is rendered, **When** the user hovers a row's
   sparkline, **Then** a tooltip appears showing that row's min, max, and last
   value labelled (e.g. `"min 12, max 47, last 30"`).
2. **Given** the user is hovering a sparkline, **When** the tooltip is visible,
   **Then** the header cells of every column the sparkline summarises are
   visibly highlighted, and no other header cell is.
3. **Given** the user moves the pointer away or blurs the focus, **When** focus
   leaves the sparkline, **Then** the tooltip is dismissed and the header
   highlight is cleared.

---

### User Story 3 - Switch between per-row and shared scaling (Priority: P2)

The user wants to choose between two readings of the same sparkline column:
- "Each row scales to its own min / max" (default). Shapes are comparable
  across rows; absolute magnitudes are not.
- "Shared scale" (global min / max across every row). Absolute magnitudes are
  comparable; small-range rows show as nearly-flat.

A small mode toggle near the "Trend" header (or accessible from the sparkline
lozenge) flips between the two. The current mode is shown by the toggle's
state and persisted in the URL fragment.

**Why this priority**: The two scaling modes answer different questions
("which rows are shaped like a spike?" vs "which rows are biggest?"). v1 ships
both because a per-row-only default hides absolute comparison, and a shared-only
default hides shape on heterogeneous tables.

**Independent Test**: Activate the sparkline column on a table where one row's
values are an order of magnitude larger than the rest. Confirm that in per-row
mode every row's sparkline fills the available vertical space; switch to shared
scale and confirm the small-range rows become nearly flat while the large-range
row fills its space.

**Acceptance Scenarios**:

1. **Given** the sparkline column is rendered in per-row mode (default),
   **When** the user inspects two rows whose absolute values differ by an
   order of magnitude, **Then** both sparklines fill the available vertical
   space (each scaled to its own min / max).
2. **Given** the user switches the mode to shared scale, **When** the same
   two rows are inspected, **Then** the small-range row's bars are visibly
   shorter than the large-range row's bars (both scaled to the global min /
   max).
3. **Given** the user has switched to shared scale, **When** they reload the
   page, **Then** the sparkline column is restored in shared-scale mode.

---

### User Story 4 - Persist and share the sparkline view via URL (Priority: P2)

A user has activated the sparkline column on a report and switched to shared
scaling, and wants to send the view to a colleague. The per-table sparkline
state (active / inactive, scaling mode, and — once more styles ship — the
style) is encoded in the URL fragment using the same per-URL-stem scheme as
`src/utils/slider-persistence.ts`. Pasting the URL in a fresh tab reproduces
the same sparkline view immediately on load.

**Why this priority**: Same payoff shape as the other enrichments — sharable
state turns a one-user view into a collaboration artefact.

**Independent Test**: Activate the sparkline column on a table and switch to
shared scaling. Copy the URL, open it in a private window, and confirm the
sparkline column is present in shared-scale mode on load.

**Acceptance Scenarios**:

1. **Given** the sparkline column is active in shared-scale mode, **When** the
   user reloads the page, **Then** the sparkline column is present and in
   shared-scale mode after first paint.
2. **Given** a URL containing a sparkline directive for a table that no longer
   qualifies (e.g. the table now has fewer than three numeric body columns),
   **When** the URL is opened, **Then** the directive is silently ignored and
   the page renders normally.

---

### Edge Cases

- **Table with fewer than 3 numeric body columns**: The sparkline lozenge MUST
  NOT be offered. The rest of the corner lozenge cluster is unaffected.
- **Non-contiguous eligible numeric columns**: When the numeric body columns
  are not adjacent (e.g. `[Region, Q1, Notes, Q2, Q3]`), the sparkline MUST
  summarise the numeric columns in document order, skipping non-numeric
  columns silently.
- **Row with one or more non-numeric body cells across the eligible columns**:
  That row's sparkline MUST be omitted; the appended `td` for that row MUST
  show a dim placeholder (e.g. an em-dash or a low-contrast `–`) with a
  tooltip explaining "incomplete numeric values for this row".
- **Row where every eligible cell is numerically equal** (zero range): The
  sparkline MUST render as a flat baseline at the lowest position rather than
  dividing by zero. The tooltip MUST still show the single repeated value.
- **`data-gs-ignore` on the table**: No sparkline lozenge is offered; the
  table is fully ignored by Grid-Sight.
- **`data-gs-no-sparkline` on the table**: No sparkline lozenge is offered,
  but other enrichments (heatmap, sliders, statistics, sort, filter, outlier)
  continue to function.
- **Table with `colgroup` / `col` declarations**: The appended "Trend" column
  MUST NOT be expected to inherit any `col` styling; Grid-Sight is responsible
  for the appended column's width and alignment.
- **Sparkline column interacting with sort**: When a sort reorders `tbody`
  rows, each row's sparkline MUST follow its row. In shared-scale mode, the
  global min / max is unaffected by sort.
- **Sparkline column interacting with filter**: When rows are dimmed by an
  active filter, their sparklines MUST be dimmed with the row. The shared-
  scale min / max MUST be recomputed over the currently un-dimmed rows so the
  visible sparklines remain meaningfully scaled. See Assumptions.
- **Toggling Grid-Sight off**: The appended "Trend" `th` and every appended
  `td` MUST be removed cleanly; the original table DOM MUST be restored. The
  encoded sparkline state MUST remain in the URL fragment so toggling
  Grid-Sight back on re-creates the column.

## Requirements *(mandatory)*

### Functional Requirements

**Sparkline affordance**

- **FR-001**: Grid-Sight MUST add a sparkline lozenge with the visible label
  **⌇** to the corner lozenge cluster of every qualifying table when
  Grid-Sight is enabled. The lozenge MUST live alongside the existing
  table-level lozenges (notably `S`, the sliders lozenge).
- **FR-002**: A table MUST qualify for the sparkline lozenge if it has at
  least **3 body columns whose cells are predominantly numeric** (the same
  numeric-column detection used by the heatmap and statistics enrichments).
  Tables with fewer qualifying columns MUST NOT receive the lozenge.
- **FR-003**: Clicking the lozenge MUST toggle the sparkline column on or
  off for that table. The active state MUST be reflected by an
  `aria-pressed="true"` indicator and a visible "active" treatment on the
  lozenge.

**Sparkline column structure**

- **FR-004**: When active, Grid-Sight MUST append a single virtual column to
  the right of the table: one `th` cell in `thead` (labelled "Trend", or the
  localised equivalent) and one `td` cell per body row in `tbody`. Footer
  rows in `tfoot` MUST receive an empty appended `td` (no sparkline) so
  column alignment is preserved.
- **FR-005**: Each appended body `td` MUST contain a single inline SVG
  rendering the row's sparkline. The SVG MUST be self-contained: no external
  references, no font dependencies, no script.
- **FR-006**: The appended cells MUST NOT modify any original `th` or `td`
  in the table; they are strictly additive.
- **FR-007**: When the sparkline lozenge is deactivated, every appended
  `th` and `td` MUST be removed and the original table DOM MUST be returned
  to its pre-activation state.

**Sparkline rendering**

- **FR-008**: The v1 sparkline style MUST be a mini bar chart: one bar per
  eligible numeric column, in document order, with bar height proportional
  to the value under the current scaling mode (FR-010 / FR-011).
- **FR-009**: A row whose cells across the eligible columns include one or
  more non-numeric values MUST NOT receive a bar chart; its appended `td`
  MUST render a dim placeholder (e.g. `–`) and a tooltip explaining
  "incomplete numeric values for this row".
- **FR-010**: In **per-row scaling mode** (default), each row's bars MUST be
  scaled to that row's own min and max across the eligible columns. If the
  row's min equals its max, the bars MUST render as a flat baseline rather
  than as undefined heights.
- **FR-011**: In **shared scaling mode**, every row's bars MUST be scaled to
  the global min and max across every un-omitted row's eligible cells (and,
  when any filter is active, restricted to the currently un-dimmed rows;
  see Assumptions).

**Hover, focus, tooltip, header highlight**

- **FR-012**: Each row's sparkline `td` MUST be keyboard focusable. On hover
  or keyboard focus, Grid-Sight MUST display a tooltip showing the row's
  min, max, and last value (the last value being the value in the last
  eligible numeric column in document order), with explicit labels.
- **FR-013**: While a sparkline is hovered or focused, the header cells of
  every eligible numeric column MUST receive a visible highlight (a non-
  colour-only signal — e.g. an underline or border in addition to any colour
  change) so the user can see which columns the bars belong to.
- **FR-014**: On blur or pointer-leave, the tooltip and the header highlight
  MUST be cleared.

**Scaling mode toggle**

- **FR-015**: A scaling mode toggle MUST be exposed near the "Trend" header
  (or via the sparkline lozenge), with two states: "Per-row scale" (default)
  and "Shared scale". The toggle MUST be a real button reachable in the
  tab order with an accessible name describing the mode it will switch to.
- **FR-016**: Switching the scaling mode MUST re-render every existing row
  sparkline in place; no DOM teardown of unrelated cells is permitted.

**Persistence**

- **FR-017**: Active sparkline state (per table: active flag, scaling mode,
  and reserved style identifier — see Assumptions) MUST be encoded in the
  URL fragment using the same per-URL-stem scheme as
  `src/utils/slider-persistence.ts`.
- **FR-018**: On page load, Grid-Sight MUST decode any sparkline directives
  from the URL fragment and apply them before the user sees the table
  content settle.
- **FR-019**: A URL directive referring to a table that no longer qualifies
  (e.g. fewer than 3 numeric body columns) MUST be silently ignored; other
  valid directives MUST still apply.

**Accessibility**

- **FR-020**: The sparkline lozenge MUST be keyboard-operable (Enter / Space
  toggles the column) and MUST expose its active / idle state via
  `aria-pressed`.
- **FR-021**: Each appended sparkline `td` MUST have an accessible name
  summarising the row (e.g. `"Trend for Region 'North': min 12, max 47,
  last 30"`) so screen-reader users receive the same summary that the
  tooltip provides visually.
- **FR-022**: The appended "Trend" header cell MUST have a discernible text
  label, not a glyph-only label, so column purpose is conveyed without
  hovering.
- **FR-023**: The scaling mode toggle MUST expose its current state to
  assistive technology (e.g. `aria-pressed` or a state-bearing label).

**Integration**

- **FR-024**: When a sort directive (`specs/002-sort/spec.md`) reorders
  `tbody` rows, each row's appended sparkline `td` MUST move with its row.
- **FR-025**: When a filter directive (`specs/003-filter/spec.md`) dims a
  row, that row's appended sparkline `td` MUST be dimmed identically (the
  sparkline is part of the row visually). In shared-scale mode, the global
  min / max MUST be recomputed over currently un-dimmed rows.
- **FR-026**: Toggling Grid-Sight off MUST remove every appended `th` /
  `td` and clear any sparkline-related listeners. The encoded sparkline
  state MUST remain in the URL fragment.
- **FR-027**: A `data-gs-no-sparkline` attribute on a table MUST suppress
  the sparkline lozenge for that table without affecting other enrichments.
- **FR-028**: A `data-gs-ignore` attribute on a table MUST suppress every
  Grid-Sight enrichment on it, sparklines included.

### Key Entities

- **Sparkline Directive**: A `(table, active, scalingMode, style)` tuple
  where `active ∈ {true, false}`, `scalingMode ∈ {"per-row", "shared"}`,
  and `style ∈ {"bar"}` for v1 (reserved for future `"line"`, `"win-loss"`
  — see Assumptions). At most one directive per table.
- **Eligible Column Set**: The ordered list of body column indices on a
  qualifying table whose cells are predominantly numeric. Determined per
  table on activation and refreshed when the table DOM changes.
- **Row Series**: For each body row, the ordered list of numeric values
  read from the Eligible Column Set. Rows with any non-numeric value in
  that set are flagged "incomplete" and skip rendering (see FR-009).
- **Scaling Window**: For per-row mode, the `(min, max)` over a single
  Row Series. For shared mode, the `(min, max)` over the union of every
  un-omitted, currently un-dimmed Row Series.
- **Persisted Sparkline State**: The serialisation of all Sparkline
  Directives on the page, written to the URL fragment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a row sparkline column to a qualifying table
  in **one click** from a Grid-Sight-enabled page.
- **SC-002**: For tables up to 1 000 rows × 10 numeric columns, activating
  the sparkline column MUST render every row's SVG in **under 200 ms** on a
  mid-range laptop. Subsequent scaling-mode flips MUST re-render in under
  100 ms.
- **SC-003**: Re-opening a URL containing a sparkline directive MUST
  restore the sparkline column with no visible flash of the unenriched
  table beyond **one animation frame** after first paint.
- **SC-004**: A sparkline view shared by URL MUST reproduce on another
  machine **100% of the time** with no `localStorage` dependency.
- **SC-005**: Toggling Grid-Sight off MUST remove the appended "Trend"
  column and every appended `td` with **byte-identical DOM** to the
  pre-sparkline state (excluding GS-injected nodes anywhere else on the
  page).
- **SC-006**: Every appended sparkline `td` MUST have a non-empty
  accessible name; an automated audit run over a fixture table MUST find
  zero appended cells with empty accessible names.

## Assumptions

- **Append-only DOM**: The sparkline column is implemented by appending
  `th` and `td` cells to the existing `thead` and `tbody` rows. Original
  cells are never mutated, preserving the source DOM for accessibility,
  copy-paste, and tear-down.
- **v1 ships only `bar`**: The style identifier exists in the persisted
  state for forward compatibility, but v1 implements only the bar style.
  `line` and `win-loss` are noted as future styles; the URL directive
  parser MUST treat any unknown style as the default `bar` for v1.
- **Per-row is the default mode**: Per-row scaling answers "what shape is
  this row?", which is the more common first question. Shared scale is
  offered as an explicit alternative; both modes are first-class.
- **Recompute shared scale on filter changes**: When any filter from
  `specs/003-filter/spec.md` is active, the shared scaling window
  recomputes over currently un-dimmed rows. Rationale matches the outlier
  enrichment's analogous decision (`specs/004-outlier/spec.md`): the
  visible subset is the user's declared "real" data.
- **"Last value" semantics**: In the per-row tooltip, "last" is the value
  in the last eligible numeric column in document order — not the
  chronologically most recent value, since Grid-Sight does not interpret
  column semantics. [NEEDS CLARIFICATION: should the tooltip label this as
  "last" or "rightmost" to avoid implying time order on columns that are
  not temporal?]
- **Glyph for the lozenge**: `⌇` is proposed; `~` is the fallback if `⌇`
  renders inconsistently across the supported evergreen browsers. The
  glyph choice does not change any other requirement and is an
  implementation decision recorded in the plan, not the spec.
- **No new runtime dependency**: SVG is hand-emitted; no charting library
  is added. The IIFE bundle size budget in the constitution
  (`.specify/memory/constitution.md`) is respected.
- **Numeric column detection is shared**: The same predominantly-numeric
  column detection used by the heatmap and statistics enrichments is
  reused. A column flips between "numeric" and "non-numeric"
  classification only when the underlying DOM changes, not on a
  per-render basis.
- **Single appended column, fixed position**: v1 appends exactly one
  "Trend" column at the right of the table. Multiple sparkline columns
  (e.g. one per metric group) and a movable column position are out of
  scope.
- **Lozenge keyboard handling is shared**: The lozenge inherits the
  existing lozenge styling and keyboard handling from
  `src/ui/header-utils.ts`, even though this particular lozenge lives in
  the corner cluster rather than a column header.
