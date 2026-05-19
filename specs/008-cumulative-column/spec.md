# Feature Specification: Cumulative Column Enrichment

**Feature Branch**: `008-cumulative-column`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "Append a virtual cumulative column derived from a chosen numeric column, with mode cycling (running sum, percent-of-total, …), persisted in the URL fragment."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Append a running-sum column to a numeric column (Priority: P1)

A user is inspecting a table of weekly figures (orders, weights, dollars) and wants to
see the running total alongside the raw values without rewriting the source HTML. With
Grid-Sight enabled, a cumulative lozenge (suggested label **Σ**) appears in the header
of every qualifying numeric column. Clicking the lozenge appends a new virtual column
on the right edge of the table whose header reads e.g. "Σ Weight", and whose cells
hold the running sum of the source column over the rows in their currently visible
order.

**Why this priority**: Running totals are the single most-asked-for derived view on a
numeric column. Shipping running sum first delivers the headline value of the feature
on its own; the other modes are refinements.

**Independent Test**: Open a page with one table containing a numeric column
`Weight = [10, 5, 7, 3]`. Toggle Grid-Sight on, click the Σ lozenge on the Weight
header, and verify a new rightmost column "Σ Weight" appears with cells
`[10, 15, 22, 25]`. Clicking the lozenge again removes the column.

**Acceptance Scenarios**:

1. **Given** a numeric column `Weight = [10, 5, 7, 3]`, **When** the user clicks the
   Σ lozenge on the Weight header, **Then** a new rightmost column titled "Σ Weight"
   appears with cells `[10, 15, 22, 25]` and the lozenge displays an "active" state.
2. **Given** the cumulative column is active in running-sum mode, **When** the user
   clicks the lozenge a second time, **Then** the mode advances to percent-of-total
   and the cells become `[40%, 60%, 88%, 100%]` (rounded to the column's display
   precision) and the header reads "% of total Weight".
3. **Given** the cumulative column is active in percent-of-total mode, **When** the
   user clicks the lozenge a third time, **Then** the appended column is removed and
   the lozenge returns to its idle indicator.
4. **Given** a sort is then applied to the source column descending, **When** the
   cumulative column is re-activated in running-sum mode, **Then** the cumulative
   values reflect the new visible order (largest-first accumulation).

---

### User Story 2 - Multiple cumulative columns and persistence (Priority: P2)

A user wants to compare running sums of two different numeric columns side by side
("Weight" and "Cost") and then share the exact view with a colleague. Each Σ lozenge
appends an independent virtual column on the right edge, in the order the user
activated them. The set of active cumulative columns and each one's mode is encoded
in the URL fragment using the same per-page persistence scheme as
`src/utils/slider-persistence.ts`, so the URL alone reproduces the view.

**Why this priority**: Comparing derived totals across columns and sharing the
view is what turns the enrichment from a single-column convenience into an
analysis tool, but it is only useful once running sum exists.

**Independent Test**: Activate the Σ lozenge on column A in running-sum mode, then
on column B in percent-of-total mode. Copy the URL, open it in a new private window
and verify both appended columns reappear with the same modes and in the same order.

**Acceptance Scenarios**:

1. **Given** the Σ lozenges on columns A and B are both active, **When** the user
   reloads the page, **Then** both appended columns reappear in the same left-to-right
   order they were activated, each in its previous mode.
2. **Given** a URL fragment referring to a cumulative column whose source column no
   longer exists, **When** the page is loaded, **Then** the missing directive is
   silently ignored and any remaining directives still apply.
3. **Given** Grid-Sight is then toggled off via the page toggle, **When** the user
   inspects the DOM, **Then** all appended cumulative columns are removed and no
   trace remains in `thead`, `tbody`, or `tfoot`.

---

### Edge Cases

- **Non-numeric cells in the source column**: Cells that fail numeric parsing MUST be
  skipped during accumulation. The corresponding virtual cell MUST render blank (not
  zero, not "NaN"), and the running total MUST carry forward unchanged.
- **Multiple cumulative columns on one table**: Allowed. Each appended column is
  independent and lives at the right edge, in activation order.
- **Co-existence with the sparkline enrichment**: When both sparkline and cumulative
  columns are appended, cumulative columns MUST appear first (immediately to the
  right of the original last column) and the sparkline column MUST appear last.
- **Sort interaction**: The cumulative column is computed over the currently visible
  row order. Changing the sort MUST recompute the cumulative values.
- **Filter interaction**: Hidden rows MUST be excluded from accumulation. The total
  on the final visible row reflects only the visible rows.
- **Toggling Grid-Sight off while cumulative columns are active**: All appended
  columns MUST be removed and the DOM restored to its pre-enrichment shape.
- **Tables marked with `data-gs-ignore`**: No Σ lozenge is shown.
- **Source column whose data cells use `rowspan` or `colspan`**: Σ lozenge MUST NOT
  be offered for that column.

## Requirements *(mandatory)*

### Functional Requirements

**Affordance**

- **FR-001**: Grid-Sight MUST add a cumulative lozenge (visible label "Σ" or
  equivalent) to every qualifying numeric column header on a qualifying table when
  Grid-Sight is enabled.
- **FR-002**: A column MUST qualify if it is detected as numeric by the same
  numeric-column detector used by the existing heatmap and statistics enrichments.
- **FR-003**: The lozenge MUST cycle through states on each click in the order
  `idle → running-sum → percent-of-total → idle`. The idle state MUST display a
  neutral indicator; each active mode MUST display a distinct indicator and tooltip.

**Computation modes**

- **FR-004**: In running-sum mode, the value at visible row *i* MUST equal the sum
  of the numeric values at visible rows 1..*i* in the source column, ignoring
  non-numeric cells.
- **FR-005**: In percent-of-total mode, the value at visible row *i* MUST equal the
  running sum at row *i* divided by the sum of all visible numeric values in the
  source column, rendered as a percentage to the source column's display precision
  (default one decimal place if none can be inferred).
- **FR-006**: Running-mean and percent-of-max modes are documented as future modes
  and MUST NOT be reachable from the lozenge cycle in v1.

**DOM and layout**

- **FR-007**: The cumulative column MUST be appended to the right edge of the
  table. The original DOM cells of the source column and of every other column
  MUST NOT be modified.
- **FR-008**: The appended column header MUST read "<mode-glyph> <source header>"
  (e.g. "Σ Weight", "% of total Weight"), preserving the original header's display
  formatting where reasonable.
- **FR-009**: When multiple cumulative columns are active on one table, each MUST
  be appended in the order it was activated, and all cumulative columns MUST appear
  to the left of any sparkline column (see edge cases).
- **FR-010**: Removing a cumulative column (third click) MUST leave the table's
  remaining columns in their previous positions.

**Re-computation triggers**

- **FR-011**: The cumulative column MUST recompute whenever the visible row order
  changes (sort) or the visible row set changes (filter).
- **FR-012**: Non-numeric source cells MUST be skipped in accumulation and MUST
  render the corresponding virtual cell as blank.

**Persistence**

- **FR-013**: The set of active cumulative columns (table identity, source column
  identity, mode) MUST be encoded in the URL fragment using the same per-page
  scheme as `src/utils/slider-persistence.ts`.
- **FR-014**: On page load, Grid-Sight MUST decode any cumulative directive from
  the URL fragment and re-apply it before the user sees the table content settle.
- **FR-015**: Directives referencing a missing table or missing source column MUST
  be silently ignored.

**Accessibility**

- **FR-016**: Each Σ lozenge MUST be keyboard-operable (Enter / Space activates
  it) and MUST expose its current mode to assistive technology via an accessible
  name that names the *next* mode (e.g. "Show percent of total for Weight").
- **FR-017**: The appended column's header cell MUST have a programmatic name
  that includes both the mode and the source column ("Cumulative sum of Weight").

**Integration**

- **FR-018**: The Σ lozenge MUST live in the existing header lozenge cluster
  defined in `src/ui/header-utils.ts` alongside `H` and `#`.
- **FR-019**: A `data-gs-no-cumulative` attribute on a table MUST suppress all
  cumulative lozenges for that table without affecting other enrichments.
- **FR-020**: Toggling Grid-Sight off MUST remove every appended cumulative
  column from the DOM with no residual nodes or attributes on host elements.

### Key Entities

- **Cumulative Directive**: A `(table, sourceColumn, mode)` tuple, where mode is
  one of `sum`, `pct-of-total` in v1. Multiple directives MAY be active per table.
- **Visible Row Sequence**: The ordered list of `tbody` rows currently rendered
  to the user, after any active sort and filter. Cumulative values are computed
  over this sequence.
- **Appended Column Record**: The injected `<th>` / `<td>` nodes that make up a
  cumulative column, tagged so they can be cleanly removed.
- **Persisted Cumulative State**: A serialisation of all active cumulative
  directives on the page, written to the URL fragment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can append a running-sum column in **one click** from a
  Grid-Sight-enabled page.
- **SC-002**: For tables up to 1 000 rows, activating or recomputing the
  cumulative column MUST complete in **under 100 ms** on a mid-range laptop.
- **SC-003**: A view containing one or more cumulative columns MUST reproduce
  from its URL **100% of the time** on another machine with no `localStorage`
  dependency.
- **SC-004**: Toggling Grid-Sight off MUST restore the table to a **byte-identical
  DOM** to its pre-enrichment state (excluding any GS-injected lozenge nodes).
- **SC-005**: Resorting a table with an active cumulative column MUST update the
  cumulative cells within **one animation frame** of the sort completing.

## Assumptions

- The existing per-URL-stem persistence model used by
  `src/utils/slider-persistence.ts` is reused unchanged.
- The numeric-column detector used by the heatmap and statistics enrichments is
  the canonical definition of "numeric column" for this feature.
- v1 ships `running sum` and `percent of total`. `running mean` and
  `percent of max` are explicitly out of scope for v1 and tracked as next.
- Tables whose source-column body cells use `rowspan` or `colspan` are out of
  scope.
- No new runtime dependency is introduced; computation uses platform arithmetic
  and `Intl.NumberFormat` for display formatting.
- Co-existence ordering with the sparkline enrichment (cumulative columns first,
  sparkline last) is enforced at append time by both enrichments.
