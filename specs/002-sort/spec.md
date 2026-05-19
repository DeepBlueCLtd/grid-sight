# Feature Specification: Column Sort Enrichment

**Feature Branch**: `002-sort`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "Add a sort lozenge on column headers that toggles ascending / descending / off without mutating the underlying source order, with shareable URL state."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sort a single column ascending / descending / off (Priority: P1)

A user is scanning a table and wants to bring the largest (or smallest) values to the
top of a numeric column, or alphabetise a categorical column, without editing the page
source. With Grid-Sight enabled, a sort lozenge (e.g. **↕**) appears in the column
header. The first click sorts ascending; the second click sorts descending; the third
click restores the original document order. Only one column drives the sort at a time
in this story — clicking the lozenge on a different column moves the sort to that
column.

**Why this priority**: Sorting is the single most-reached-for table interaction. It
makes the Grid-Sight toggle feel essential the first time a viewer uses it, and it
unlocks every other "find the extreme" workflow (outliers, top-N inspection).

**Independent Test**: Open a page with one mixed numeric / categorical table. Toggle
Grid-Sight on, click the sort lozenge on a numeric column three times and verify the
rows reorder asc → desc → original. Repeat on a categorical column and confirm
locale-aware alphabetical order.

**Acceptance Scenarios**:

1. **Given** a numeric column with values `[3, 1, 4, 1, 5]`, **When** the user clicks
   the sort lozenge once, **Then** rows reorder so that the column reads
   `[1, 1, 3, 4, 5]` and the lozenge displays an "ascending" indicator.
2. **Given** the same column already sorted ascending, **When** the user clicks the
   lozenge again, **Then** the column reads `[5, 4, 3, 1, 1]` and the lozenge shows a
   "descending" indicator.
3. **Given** the same column sorted in either direction, **When** the user clicks the
   lozenge a third time, **Then** rows return to their original document order and the
   lozenge reverts to its idle (neutral) indicator.
4. **Given** column A is sorted ascending, **When** the user clicks the sort lozenge on
   column B, **Then** column A's sort is cleared, column B becomes the sort key, and
   only column B's lozenge displays an active indicator.

---

### User Story 2 - Persist sort state in the URL (Priority: P2)

A user finds a useful view of a shared report (e.g. "vendors by spend, descending")
and wants to send the exact view to a colleague. The current sort state is encoded in
the URL fragment using the same per-page persistence model as sliders. Pasting the URL
in a fresh tab reproduces the same sorted view without any prior `localStorage` value.

**Why this priority**: Sharing a view is the natural follow-up to creating it.
Sort-without-share is still useful, but persistence is what turns the enrichment from
a local convenience into a collaboration tool.

**Independent Test**: Sort a column descending, copy the URL, open it in a new private
window. Verify the same column is sorted in the same direction immediately on load,
with no flash of unsorted content beyond one animation frame.

**Acceptance Scenarios**:

1. **Given** a user has sorted column X descending, **When** they reload the page,
   **Then** column X is sorted descending again with the lozenge in the matching
   active state.
2. **Given** a URL containing a sort directive for a column that no longer exists in
   the table (e.g. the page was edited), **When** the URL is opened, **Then** the page
   loads with no sort applied and no error displayed.

---

### Edge Cases

- **Non-monotonic mixed types in a column**: A column containing both numeric and
  non-numeric cells MUST sort using a stable, predictable rule (numerics by value,
  non-numerics by locale-aware string order, with all non-numerics grouped together
  consistently at one end).
- **Blank / missing cells**: Empty cells MUST sort to the end regardless of direction,
  so the user can always see the "real" values first.
- **Tied values**: Ties MUST preserve the original document order (stable sort), so
  two clicks asc → desc on a column with many ties does not scramble unrelated rows.
- **Multi-section tables (thead / tbody / tfoot)**: Only the `tbody` rows MAY be
  reordered. `thead` and `tfoot` rows MUST remain in place.
- **Tables marked with `data-gs-ignore`**: No sort lozenge is shown.
- **Disabling Grid-Sight while a sort is active**: Turning Grid-Sight off MUST restore
  the original document order; turning it back on MUST re-apply the URL-encoded sort.
- **Server-rendered tables with rowspans / colspans on body cells**: Sort lozenge MUST
  NOT be offered; sorting cells with span attributes is out of scope.

## Requirements *(mandatory)*

### Functional Requirements

**Sort affordance**

- **FR-001**: Grid-Sight MUST add a sort lozenge (visible label "↕" or equivalent) to
  every body-column header on a qualifying table when Grid-Sight is enabled.
- **FR-002**: A column MUST qualify for sort if its data cells are all numeric, all
  string-typed, or a mix of numeric and string with no cells containing block-level
  content.
- **FR-003**: The lozenge MUST cycle through three states on each click in the order
  `idle → ascending → descending → idle`. Idle MUST display a neutral indicator;
  ascending and descending MUST each display a distinct directional indicator.

**Sort behaviour**

- **FR-004**: When a sort is applied, Grid-Sight MUST reorder `tbody` rows so that
  the chosen column reads in the requested direction. Rows MUST NOT be removed from
  the DOM during sort; reordering is positional only.
- **FR-005**: Numeric comparison MUST use numeric value (not string lexicographic
  order). Locale-aware string comparison MUST be used for non-numeric values.
- **FR-006**: The sort MUST be stable — rows with equal sort keys MUST retain their
  prior relative order.
- **FR-007**: Empty, whitespace-only, or non-comparable cells MUST be grouped at the
  end of the sorted output regardless of direction.
- **FR-008**: Only one column at a time MAY drive the sort. Activating sort on a new
  column MUST clear the previous column's sort state.
- **FR-009**: Returning a column to the idle state MUST restore the original
  document order of `tbody` rows exactly as they were on page load.

**Persistence**

- **FR-010**: Active sort state (table identity, column identity, direction) MUST be
  encoded in the URL fragment using the same per-URL-stem scheme as the existing
  slider persistence layer.
- **FR-011**: On page load, Grid-Sight MUST decode any sort directive from the URL
  fragment and apply it before the user sees the table content settle.
- **FR-012**: A URL directive referring to a missing table or missing column MUST be
  silently ignored.

**Accessibility**

- **FR-013**: Each sort lozenge MUST be keyboard-operable (Enter / Space activates it)
  and MUST expose its current state to assistive technology via `aria-sort` on the
  parent header cell (`ascending` / `descending` / `none`).
- **FR-014**: The lozenge MUST have a discernible accessible name (e.g.
  "Sort column 'Range' ascending") that reflects the *next* action, updating after
  each click.

**Integration**

- **FR-015**: The sort lozenge MUST live in the existing header lozenge cluster
  alongside `H` and `#` so the user's mental model is unchanged.
- **FR-016**: A `data-gs-no-sort` attribute on a table MUST suppress all sort
  lozenges for that table without affecting other enrichments.

### Key Entities

- **Sort Directive**: A `(table, column, direction)` tuple where direction is one of
  `asc`, `desc`, or absent. At most one directive is active per table.
- **Original Order Record**: A snapshot of the original `tbody` row order captured
  the first time a sort is applied, used to restore the idle state.
- **Persisted Sort State**: A serialisation of all active sort directives on the
  page, written to the URL fragment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can sort a column in **two clicks or fewer** from a Grid-Sight
  enabled page (one click on the page toggle is not counted because Grid-Sight is
  often pre-enabled).
- **SC-002**: For tables up to 1 000 rows, a sort click MUST visibly reorder rows
  in **under 100 ms** on a mid-range laptop.
- **SC-003**: Re-opening a URL containing a sort directive MUST restore the sorted
  view with no visible flash of unsorted content beyond **one animation frame**
  after first paint.
- **SC-004**: A sort state shared by URL MUST reproduce on another machine **100% of
  the time** with no `localStorage` dependency.
- **SC-005**: Toggling Grid-Sight off MUST restore the original row order with
  **byte-identical DOM** to the pre-sort state (excluding GS-injected nodes).

## Assumptions

- The existing per-URL-stem persistence model (URL fragment + `localStorage`
  fallback) is reused unchanged.
- Single-column sort is sufficient for v1. Multi-column sort (with priority
  indicators and shift-click semantics) is out of scope.
- Custom comparators per column (e.g. natural sort for "Chapter 1, Chapter 2,
  Chapter 10") are out of scope for v1 — numeric / locale string is enough.
- Sorting tables whose body cells use `rowspan` or `colspan` is out of scope.
- No new runtime dependency is introduced; sort is implemented with the platform
  `Array.prototype.sort` and `Intl.Collator`.
- The lozenge inherits the existing lozenge styling and keyboard handling from
  `ui/header-utils.ts`.
