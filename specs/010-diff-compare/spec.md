# Feature Specification: Diff / Compare Two Rows or Two Columns

**Feature Branch**: `010-diff-compare`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "A compare mode that lets the user pick two rows (or two columns) and overlays per-cell deltas with directional colour and glyphs, persisted in the URL fragment."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare two rows of a numeric table (Priority: P1)

A user is reading a numeric table (athlete metrics, monthly KPIs, two product
configurations) and wants to see how row B differs from row A across every numeric
column without doing the subtraction in their head. With Grid-Sight enabled, a
table-level lozenge (suggested label **Δ**) appears in the table's corner cluster.
Clicking the lozenge turns on compare mode; the next click on a row header marks
that row as **A**, and the click after that marks another row as **B**. Grid-Sight
then renders a comparison overlay aligned with row B that shows, per numeric cell,
the absolute delta (B − A), with green / ▲ for gains, red / ▼ for losses, and a
neutral indicator for zero.

**Why this priority**: Pairwise comparison is the single most common reason a
user scrolls through a numeric table looking back and forth. Shipping it for
rows first delivers the headline value; columns follow the same pattern.

**Independent Test**: Open a page with one numeric table of at least three rows.
Toggle Grid-Sight on, click the Δ lozenge, click row 1's header, click row 3's
header. Verify a comparison overlay appears under row 3 showing the per-cell
deltas with correct sign and direction glyph.

**Acceptance Scenarios**:

1. **Given** a table where compare mode is off, **When** the user clicks the Δ
   lozenge, **Then** compare mode activates, the lozenge displays an "active"
   indicator, and row headers become selectable as A.
2. **Given** compare mode is active and no row is selected, **When** the user
   clicks the header of row 1, **Then** row 1 is marked as A with a visible
   indicator and an `aria-live` announcement "Row 1 selected as A".
3. **Given** row 1 is marked as A, **When** the user clicks the header of row 3,
   **Then** row 3 is marked as B and a comparison overlay aligned with row 3
   appears, showing per-numeric-cell deltas with sign, colour (green for gains,
   red for losses), and an explicit ▲ / ▼ glyph.
4. **Given** the comparison is showing absolute deltas, **When** the user toggles
   the display to "both", **Then** each comparison cell shows both absolute and
   percent delta separated by a thin space (e.g. "+3.2 kg ▲ +12%").
5. **Given** any of row A, row B, or the delta display preference, **When** the
   user reloads the page, **Then** the same compare state reappears, restored
   from the URL fragment, including the active lozenge state.

---

### User Story 2 - Compare two columns (Priority: P2)

The same compare mode applies to columns: in compare mode, clicking a column
header picks column A, then column B. The comparison overlay appears as an
appended virtual column on the right edge of the table showing B − A for every
row whose A and B cells are both numeric.

**Why this priority**: Column-wise comparison answers a different question
("which rows moved the most?") and is just as useful, but it is only shippable
once the row-wise interaction is stable. The interaction grammar is identical,
which makes this an incremental delivery.

**Independent Test**: Activate compare mode, click the header of column 2,
click the header of column 4. Verify an appended virtual column titled
"Δ <colB> − <colA>" appears on the right edge with per-row deltas.

**Acceptance Scenarios**:

1. **Given** compare mode is active and no row or column has been selected,
   **When** the user clicks a column header, **Then** that column is marked as
   A; the next click on a different column header marks B and the appended
   comparison column appears.
2. **Given** the user has selected row A (or row A and row B) and then clicks
   a column header, **Then** Grid-Sight auto-clears any current row selection,
   switches to column-compare mode, and treats the clicked column as A. The
   same rule applies symmetrically when the user is mid-selection on columns
   and clicks a row header. No confirmation prompt is shown — clicking a
   header on the opposite axis is taken as a clear intent signal to restart on
   that axis.

---

### Edge Cases

- **A and B have incompatible categorical axes** (e.g. comparing a row whose
  cells are dates against one whose cells are dollars per column): refuse with
  a visible explanation in the lozenge tooltip and `aria-live` region; no
  overlay is rendered.
- **Non-numeric operand cells**: For each cell where either A or B is
  non-numeric, the comparison cell MUST render an em-dash placeholder ("—")
  with an `aria-label` of "Not comparable".
- **Zero divisor for percent delta**: When A is zero and percent display is
  requested, the comparison cell MUST display the absolute delta only, with a
  short note "no percent (A is 0)" in its `aria-label`.
- **Comparing a row (or column) to itself**: No overlay is rendered; the
  lozenge surfaces a hint "Pick a different row to compare".
- **`data-gs-no-compare` attribute**: A table or row carrying this attribute is
  excluded — the row cannot be selected as A or B; a table with the attribute
  shows no Δ lozenge at all.
- **Filter interaction**: If row A or row B is hidden by a filter while
  comparison is active, the overlay MUST be paused (visually dimmed plus a
  visible "Compare paused: row A filtered out" indicator) and MUST resume
  automatically when the row reappears.
- **Sort interaction**: Sorting MUST NOT clear the A / B selection. The overlay
  for row B follows row B to its new position.
- **Toggling Grid-Sight off**: Compare mode MUST exit cleanly; all overlays and
  the appended comparison column MUST be removed.

## Requirements *(mandatory)*

### Functional Requirements

**Affordance and mode**

- **FR-001**: Grid-Sight MUST add a compare lozenge (visible label "Δ" or
  equivalent) to every qualifying table's corner cluster when Grid-Sight is
  enabled.
- **FR-002**: A table MUST qualify for the compare lozenge if it contains at
  least one column whose data cells are detected as numeric and is not marked
  with `data-gs-no-compare`.
- **FR-003**: The Δ lozenge MUST cycle `idle → compare-mode-on → idle`. While
  compare mode is on, the table MUST expose row headers and column headers as
  selectable targets.

**Selection**

- **FR-004**: In compare mode, the first click on a row or column header MUST
  mark that row or column as **A**. The next click on a different row or
  column header MUST mark it as **B** and trigger the comparison.
- **FR-005**: Re-clicking the A target MUST clear A. Re-clicking the B target
  MUST clear B. Clicking a third target replaces B.
- **FR-006**: Row-mode and column-mode are mutually exclusive within a single
  active comparison. While mid-selection on one axis, clicking a header on the
  opposite axis MUST auto-clear the current selection and treat the clicked
  header as A on the new axis; no confirmation prompt is shown.
- **FR-007**: Each selection change MUST be announced via an `aria-live`
  region (e.g. "Row 3 selected as B").

**Comparison computation**

- **FR-008**: For numeric operand pairs `(a, b)`, the absolute delta MUST be
  computed as `b − a` and the percent delta as `(b − a) / a × 100`, displayed
  to the cell's existing display precision or one decimal place if none can be
  inferred.
- **FR-009**: When either operand is non-numeric, the comparison cell MUST
  render "—" and expose `aria-label="Not comparable"`.
- **FR-010**: When `a` is zero and percent display is requested, the percent
  component MUST be suppressed and the cell's `aria-label` MUST note "no
  percent (A is 0)".

**Display**

- **FR-011**: The comparison overlay for row-compare MUST be rendered as an
  appended row at the bottom of the table body, echoing the layout pattern
  used by the cumulative-column enrichment. The row's leading header cell
  MUST label the row "Δ <rowB> − <rowA>" and each comparison cell sits in the
  same column as its source operands. Inline-under-row-B annotations are
  explicitly out of scope for v1.
- **FR-012**: The comparison column for column-compare MUST be appended at the
  right edge of the table with a header "Δ <colB> − <colA>" and MUST coexist
  with cumulative and sparkline columns per their ordering rules.
- **FR-013**: Delta display modes MUST cycle `absolute → percent → both →
  absolute` on a dedicated control within the comparison overlay.
- **FR-014**: Direction MUST be conveyed by colour (green = gain, red = loss)
  *and* by an explicit glyph (▲ for gain, ▼ for loss, en-dash for zero), so
  colour is never the sole channel.

**Filter and sort interaction**

- **FR-015**: When row A or row B is hidden by a filter, the comparison MUST
  pause: the overlay MUST be dimmed and a visible indicator MUST display
  "Compare paused: row <id> filtered out". When the row reappears, the
  overlay MUST resume automatically.
- **FR-016**: Sorting MUST NOT clear the A / B selection. The row overlay MUST
  follow row B to its new visible position.

**Persistence**

- **FR-017**: The active compare state (table identity, axis row-or-column,
  A identity, B identity, delta display mode) MUST be encoded in the URL
  fragment using the same per-page scheme as `src/utils/slider-persistence.ts`.
- **FR-018**: On page load, Grid-Sight MUST decode any compare directive from
  the URL fragment and re-apply it before the user sees the table content
  settle.
- **FR-019**: A URL directive referring to a missing table, missing row, or
  missing column MUST be silently ignored.

**Accessibility**

- **FR-020**: The Δ lozenge MUST be keyboard-operable (Enter / Space).
- **FR-021**: Each row or column header MUST become keyboard-focusable while
  compare mode is on, and Enter / Space MUST select it as A or B.
- **FR-022**: Each comparison cell MUST expose an `aria-label` of the form
  "Row B vs A, +3.2 kg, +12%" or the column-mode equivalent.
- **FR-023**: Selection changes and pause/resume events MUST be announced via
  `aria-live="polite"`.

**Opt-out and integration**

- **FR-024**: A `data-gs-no-compare` attribute on a table MUST suppress the Δ
  lozenge entirely. On a row, it MUST exclude that row from being selectable
  as A or B.
- **FR-025**: The Δ lozenge MUST live in the table's corner cluster defined
  by `src/ui/header-utils.ts`, alongside other table-level lozenges.
- **FR-026**: Toggling Grid-Sight off MUST exit compare mode, remove all
  overlays, and restore the DOM to its pre-enrichment shape.

### Key Entities

- **Compare Directive**: A `(table, axis, A, B, deltaMode)` tuple where axis
  is one of `row` or `column`, A and B identify rows or columns, and deltaMode
  is one of `absolute`, `percent`, `both`.
- **Comparison Overlay**: The GS-injected nodes (row, annotations, or appended
  column) carrying the per-cell deltas for the current directive.
- **Pause State**: A transient state indicating that A or B is currently
  invisible (filtered out) and the overlay is suspended.
- **Persisted Compare State**: A serialisation of the active compare directive
  per page, written to the URL fragment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can produce a row comparison in **three clicks or fewer**
  from a Grid-Sight-enabled page (Δ lozenge, A header, B header).
- **SC-002**: For tables up to 1 000 rows × 20 columns, computing and
  rendering a comparison MUST complete in **under 100 ms** on a mid-range
  laptop.
- **SC-003**: A compare state shared by URL MUST reproduce on another machine
  **100% of the time** with no `localStorage` dependency.
- **SC-004**: Direction MUST be distinguishable to users with red-green
  colour-vision deficiency in **100% of comparison cells**, verified by the
  presence of an explicit ▲ / ▼ / en-dash glyph in every non-neutral cell.
- **SC-005**: Toggling Grid-Sight off MUST restore the DOM to a
  **byte-identical state** to its pre-enrichment shape (excluding GS-injected
  lozenge nodes).

## Assumptions

- The existing per-URL-stem persistence model used by
  `src/utils/slider-persistence.ts` is reused unchanged.
- The numeric-column detector used by the heatmap and statistics enrichments
  is the canonical definition of "numeric" for cell-level comparability.
- Pairwise comparison is sufficient for v1. N-way comparison (A, B, C, …) is
  out of scope.
- Custom comparators per column type (dates, durations, currencies) reuse the
  existing cell-parsing layer; comparing across different units is out of
  scope.
- The corner-cluster slot for the Δ lozenge is available alongside the copy
  lozenge from spec `009-copy-as-csv`; both share the same cluster contract
  from `src/ui/header-utils.ts`.
- No new runtime dependency is introduced; deltas are computed with platform
  arithmetic and rendered with `Intl.NumberFormat`.
