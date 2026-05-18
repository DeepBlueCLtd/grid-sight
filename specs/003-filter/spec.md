# Feature Specification: Column Filter Enrichment

**Feature Branch**: `003-filter`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "Add a filter lozenge on column headers that opens a popup — range inputs for numeric columns, checkbox list for categorical columns — composing across columns with AND, with a clear-all chip and shareable URL state."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter a numeric column by range (Priority: P1)

A user is reading a table of orders and wants to focus on rows whose "Amount" column
falls inside a specific range. With Grid-Sight enabled, a filter lozenge (**▽**)
appears in the column header. Clicking it opens a small popup with two number inputs
(`min` and `max`). Typing or stepping the values immediately dims rows whose "Amount"
cell falls outside the range; clearing both inputs restores all rows. The popup closes
on outside click or `Escape`, and the lozenge displays an "active" indicator while a
filter is in effect.

**Why this priority**: Numeric filtering is the highest-frequency table interaction
after sort. Until a reader can constrain the rows they care about, every other
enrichment (heatmap, sliders, statistics) is reading more data than the reader wants.
Range filtering pays for the whole filter feature on its own.

**Independent Test**: Open a page containing a table with a numeric "Amount" column.
Enable Grid-Sight, click the filter lozenge on "Amount", enter `min=100`, `max=500`,
and confirm that rows outside that range are visibly dimmed while in-range rows
remain at full opacity. Clear both inputs and confirm all rows return.

**Acceptance Scenarios**:

1. **Given** a numeric column "Amount" with values `[50, 150, 300, 450, 800]`,
   **When** the user opens the filter popup and enters `min=100, max=500`,
   **Then** the rows with values `50` and `800` are dimmed and the remaining three
   rows stay at full opacity.
2. **Given** the same column with `min=100` set and `max` left blank, **When** the
   filter is applied, **Then** only the row with value `50` is dimmed; `max=blank`
   is interpreted as "no upper bound".
3. **Given** a filter is active on "Amount", **When** the user clears both inputs
   or presses a "reset this filter" affordance inside the popup, **Then** all rows
   return to full opacity and the lozenge returns to its idle indicator.
4. **Given** a numeric filter is active, **When** the user clicks outside the popup
   or presses `Escape`, **Then** the popup closes but the filter remains applied.

---

### User Story 2 - Filter a categorical column by value list (Priority: P1)

The same table has a "Region" column with a small set of repeated string values
(`North`, `South`, `East`, `West`). The user wants to look at only `North` and
`East`. The filter lozenge on a categorical column opens a popup showing a checkbox
list of every distinct value present in the column (with a count per value). The
user ticks `North` and `East` and the other rows dim. There is a "select all" /
"select none" pair at the top of the list for fast resets.

**Why this priority**: Categorical filtering covers the other half of "show me only
the rows that matter" — the half that range inputs cannot express. Numeric and
categorical filters share the lozenge, the popup chrome, and the persistence model,
so the marginal cost of shipping both together is low.

**Independent Test**: Open a table with a "Region" column. Click the filter lozenge
on "Region", tick `North` and `East`, and confirm rows with other values are
dimmed. Click "select all" and confirm every row returns.

**Acceptance Scenarios**:

1. **Given** a categorical column with distinct values `[North, South, East, West]`,
   **When** the user opens the filter popup, **Then** the popup shows a checkbox
   for each distinct value, each labelled with the value and its row count, all
   ticked by default.
2. **Given** the filter popup is open with all values ticked, **When** the user
   unticks `South` and `West`, **Then** rows whose "Region" cell is `South` or
   `West` are dimmed and the lozenge moves to its active indicator.
3. **Given** the filter popup is open, **When** the user clicks "select none" then
   ticks one value, **Then** only rows matching that one value remain at full
   opacity.

---

### User Story 3 - Compose filters across columns and clear all at once (Priority: P2)

The user has applied filters to three columns (e.g. `Amount` 100–500, `Region` ∈
{`North`, `East`}, `Status` ∈ {`Open`}). A filter chip element appears near the
table summarising every active filter as a comma-separated list, with a
**Clear all filters** affordance. A row is at full opacity only if it passes every
active filter (logical AND). Clearing all filters restores every row in one click.

**Why this priority**: Single-column filters are useful immediately; compound
filtering is the workflow that turns the feature into an analyst tool. The summary
chip is also the only place a user discovers "I forgot I had a filter on column X"
when scrolling past the header.

**Independent Test**: Apply three filters in sequence and verify that only rows
satisfying all three remain at full opacity, that the chip lists all three, and
that **Clear all filters** restores every row and resets every filter lozenge to
its idle indicator.

**Acceptance Scenarios**:

1. **Given** filters are active on three columns, **When** a row's cells satisfy
   only two of the three filters, **Then** that row is dimmed.
2. **Given** any filter is active, **When** the user reads the filter chip,
   **Then** the chip lists each active filter as `Column: predicate` (e.g.
   `Amount: 100–500`, `Region: North, East`) in column order.
3. **Given** any filter is active, **When** the user clicks **Clear all filters**,
   **Then** every filter is removed, every lozenge returns to its idle indicator,
   and the chip is hidden.

---

### User Story 4 - Persist and share a filtered view via URL (Priority: P2)

A user constructs a useful filtered view and wants to send it to a colleague. The
active filter set is encoded in the URL fragment using the same per-URL-stem scheme
as the existing slider persistence layer. Pasting the URL in a fresh tab reproduces
the same filtered view with no `localStorage` value present.

**Why this priority**: Filtering without sharing is still useful, but persistence
is what makes a constructed view collaborative — the same payoff pattern as sort.

**Independent Test**: Apply a filter, copy the URL, open it in a new private window,
and verify the same rows are dimmed on load with the matching lozenges and chip
visible.

**Acceptance Scenarios**:

1. **Given** the user has applied a numeric range filter and a categorical filter,
   **When** they reload the page, **Then** both filters are restored, their
   lozenges are active, and the chip lists both.
2. **Given** a URL containing a filter directive for a column that no longer exists,
   **When** the URL is opened, **Then** the page loads with that directive silently
   ignored and any remaining valid filter directives applied.

---

### Edge Cases

- **Mixed numeric and text in a "numeric" column**: A column with mostly numeric
  cells but a few text cells (e.g. `"N/A"`) is still treated as numeric for filter
  purposes. Non-numeric cells are filtered out by any range with an explicit `min`
  or `max`; they pass only when both bounds are blank.
- **Empty cells in a filtered column**: Empty cells are kept (treated as
  "no value, do not exclude") by default. A per-popup "Hide empty cells" toggle is
  available; the choice persists in the URL alongside the filter.
- **Zero-match filter**: When a filter combination matches zero rows, the table
  shows an empty-state message inside or just below the `tbody` ("No rows match
  the current filters") with a one-click **Clear all filters** affordance.
- **`data-gs-ignore` on the table**: No filter lozenges are shown; the table is
  fully ignored by Grid-Sight.
- **`data-gs-no-filter` on the table**: No filter lozenges are shown, but other
  enrichments (heatmap, sliders, statistics, sort) continue to function.
- **Toggling Grid-Sight off**: All rows return to full opacity (dimmed rows
  un-dim), the chip is hidden, and any "Hide empty" or "Hide non-matching" choice
  is cleared from the visible DOM. Toggling Grid-Sight back on re-applies the
  URL-encoded filters.
- **Categorical column with many distinct values**: The popup MUST remain usable
  when a column has up to a few hundred distinct values (scrollable list with a
  type-to-search filter inside the popup); columns above that scale are filtered
  with a "too many values, use a custom filter" notice and no checkbox list.
- **Tables with `rowspan` on body cells**: Filter lozenges MUST NOT be offered on
  columns whose cells span rows; the dimming model has no defined behaviour there.

## Requirements *(mandatory)*

### Functional Requirements

**Filter affordance**

- **FR-001**: Grid-Sight MUST add a filter lozenge with the visible label **▽** to
  every body-column header on a qualifying table when Grid-Sight is enabled.
- **FR-002**: The lozenge MUST live in the existing header lozenge cluster created
  by `src/ui/header-utils.ts`, alongside `H`, `#`, and `S`.
- **FR-003**: A column MUST qualify for filtering if it has at least one
  non-empty body cell. Columns whose cells use `rowspan` MUST NOT qualify.
- **FR-004**: Clicking the filter lozenge MUST open a popup anchored to the
  lozenge. Clicking the lozenge again, clicking outside the popup, or pressing
  `Escape` MUST close it. The filter state itself MUST NOT change on close.
- **FR-005**: The lozenge MUST display a distinct "active" indicator (visual
  change plus an `aria-pressed="true"` state) whenever the column has a
  non-empty filter applied, and revert to its idle indicator when the filter is
  cleared.

**Numeric filtering**

- **FR-006**: For a numeric column, the popup MUST present two number inputs
  labelled "Min" and "Max". A blank input MUST be treated as "no bound on that
  side".
- **FR-007**: A row MUST be considered matching for a numeric filter when its
  cell value is a finite number and falls within the closed interval `[min, max]`
  using the supplied bounds. Non-numeric cells in a numeric-filtered column MUST
  fail any filter that has at least one bound set, and MUST pass when both bounds
  are blank.
- **FR-008**: The popup MUST offer a "Reset this filter" affordance that returns
  the column to its idle (unfiltered) state without closing the popup.

**Categorical filtering**

- **FR-009**: For a categorical column, the popup MUST present a checkbox list of
  every distinct text value present in that column's body cells, each labelled
  with the value and its row count, sorted by descending count then alphabetically.
- **FR-010**: A row MUST be considered matching for a categorical filter when the
  cell's text matches one of the ticked values exactly (after trim).
- **FR-011**: The popup MUST provide "Select all" and "Select none" affordances
  and a type-to-search input that narrows the visible checkbox list.
- **FR-012**: When a column has more than the supported distinct-value count
  (an internal limit; see Assumptions), the popup MUST display a notice and MUST
  NOT render an unbounded checkbox list.

**Composition and clear-all**

- **FR-013**: When multiple column filters are active, a row MUST be at full
  opacity if and only if it satisfies every active filter (logical AND).
- **FR-014**: Rows that fail at least one active filter MUST be dimmed visually
  (not removed from the DOM). The dim treatment MUST be a non-colour-only signal
  (e.g. opacity reduction) so the table remains readable to users with
  colour-vision deficiencies.
- **FR-015**: A "filter chip" element MUST be rendered near the table whenever
  one or more filters are active. The chip MUST list every active filter as
  `Column: predicate` in column order and MUST expose a **Clear all filters**
  affordance that, when activated, clears every filter on the table.
- **FR-016**: When the active filter set matches zero rows, Grid-Sight MUST
  show an empty-state message in or just below the `tbody` with a
  **Clear all filters** affordance.

**Persistence**

- **FR-017**: Active filter state (per table: per column: range bounds or
  ticked-value list, plus the per-column "Hide empty cells" choice) MUST be
  encoded in the URL fragment using the same per-URL-stem scheme as
  `src/utils/slider-persistence.ts`.
- **FR-018**: On page load, Grid-Sight MUST decode any filter directives from the
  URL fragment and apply them before the user sees the table content settle.
- **FR-019**: A URL directive referring to a missing table, missing column, or
  ticked value that no longer exists MUST be silently ignored; other valid
  directives MUST still apply.

**Accessibility**

- **FR-020**: Each filter lozenge MUST be keyboard-operable (Enter / Space opens
  the popup) and MUST expose its active / idle state via `aria-pressed`.
- **FR-021**: The popup MUST be a focus-trapping dialog with a discernible
  accessible name (e.g. "Filter column 'Amount'"). `Escape` MUST close it and
  return focus to the lozenge.
- **FR-022**: The filter chip MUST be reachable in the tab order and the
  **Clear all filters** affordance MUST be a real button.
- **FR-023**: Dimmed rows MUST remain in the accessibility tree and MUST be
  marked with `aria-hidden="false"` (i.e. still announced) so that screen-reader
  users are not silently filtered.

**Integration**

- **FR-024**: Toggling Grid-Sight off MUST visually un-dim every row, hide the
  filter chip, and remove all popups. The encoded filter state MUST remain in
  the URL fragment so toggling Grid-Sight back on restores the same filtered
  view.
- **FR-025**: A `data-gs-no-filter` attribute on a table MUST suppress all
  filter lozenges for that table without affecting other enrichments.
- **FR-026**: A `data-gs-ignore` attribute on a table MUST suppress every
  Grid-Sight enrichment on it, filters included.

### Key Entities

- **Filter Predicate**: One of (a) a numeric range `(min?, max?, hideEmpty)` or
  (b) a categorical inclusion set `(values[], hideEmpty)`. Each predicate is
  attached to a single `(table, column)` pair.
- **Active Filter Set**: The collection of filter predicates currently applied to
  a table. Rows match the set under logical AND across predicates.
- **Filter Chip**: A visible summary element rendered per table whenever the
  Active Filter Set is non-empty, exposing **Clear all filters**.
- **Persisted Filter State**: The serialisation of all Active Filter Sets on the
  page, written to the URL fragment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can apply a numeric range filter in **three interactions or
  fewer** from a Grid-Sight-enabled page (open lozenge, enter min, enter max).
- **SC-002**: For tables up to 1 000 rows, applying or changing a filter MUST
  re-evaluate row visibility in **under 100 ms** on a mid-range laptop.
- **SC-003**: Re-opening a URL containing one or more filter directives MUST
  restore the filtered view with no visible flash of unfiltered content beyond
  **one animation frame** after first paint.
- **SC-004**: A filtered view shared by URL MUST reproduce on another machine
  **100% of the time** with no `localStorage` dependency.
- **SC-005**: Toggling Grid-Sight off MUST restore every row to full opacity
  with **byte-identical DOM** to the pre-filter state (excluding GS-injected
  nodes).

## Assumptions

- **Dim, not hide**: Non-matching rows are *dimmed* (visually de-emphasised),
  not removed from the DOM or set to `display: none`. Rationale: dimming
  preserves row context, keeps row-relative enrichments (sparklines, sliders)
  meaningful, leaves rows accessible to assistive technology, and avoids
  surprising scroll-position shifts when filters change. A future "hide
  instead" preference may be added but is out of scope for v1.
- **Empty cells default to "keep"**: The default policy for empty cells is to
  leave them matching every filter. The per-popup "Hide empty cells" toggle is
  the opt-out and is persisted alongside the rest of the filter state.
- **AND-only composition**: Cross-column composition is fixed at AND. Per-column
  OR within a categorical checkbox list (any ticked value matches) is implicit
  and is the only OR semantics supported in v1.
- **Distinct-value cap for categorical popups**: A column with more than ~200
  distinct values is treated as "too wide for a checkbox list" and the popup
  shows an explanatory notice instead. The exact cap is an implementation
  detail and not part of this spec. [NEEDS CLARIFICATION: should the cap be
  configurable per-table via an attribute, or is a fixed internal constant
  acceptable for v1?]
- **No custom filter expressions**: Free-form text predicates ("contains
  'foo'", regex, comparison operators on strings) are out of scope for v1.
- **No new runtime dependency**: Filter evaluation uses only platform APIs
  (`Number`, `String.prototype.trim`, `Intl.Collator` if needed). No filter
  engine library is added.
- **Single chip per table**: One filter chip is rendered per filtered table,
  positioned consistently relative to the table (e.g. immediately above). The
  exact placement is a UI decision, not a spec requirement.
- **The lozenge inherits the existing lozenge styling and keyboard handling
  from `src/ui/header-utils.ts`.**
