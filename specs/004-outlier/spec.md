# Feature Specification: Outlier Marker Enrichment

**Feature Branch**: `004-outlier`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "Add an outlier lozenge on numeric column headers that flags cells beyond N standard deviations from the column mean, with a click-to-cycle 1σ/2σ/3σ threshold, a per-cell tooltip showing sigma distance, an optional outliers list popup, and shareable URL state."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Flag outliers in a numeric column at 2σ (Priority: P1)

A user is reading a table of measurements and wants to see at a glance which cells
in a numeric column are unusually large or small. With Grid-Sight enabled, an
outlier lozenge (**!**) appears in every qualifying numeric column header. Clicking
it activates outlier flagging at the default threshold of **2σ**: every cell whose
value falls more than two standard deviations from the column mean is given a
visible marker (a coloured ring or border) and a hover tooltip showing its value,
the column mean, and the distance in σ. A second visual treatment uses a non-colour
channel (border style) so the marker remains legible without colour vision.

**Why this priority**: Outlier detection is the single most-asked-for "tell me what
is interesting in this column" interaction. Until a reader can see anomalies
without doing the arithmetic in their head, every numeric table is under-read. 2σ
is the textbook default and is the right starting threshold for v1.

**Independent Test**: Open a page with a numeric column containing values where one
or two clearly sit outside `mean ± 2σ`. Toggle Grid-Sight on, click the outlier
lozenge on that column, and confirm those cells receive a visible marker and that
hovering on a marked cell reveals a tooltip stating the value, the column mean,
and the σ distance.

**Acceptance Scenarios**:

1. **Given** a numeric column whose values yield `mean = 100, σ = 10` with one
   cell containing `135` and the rest within `[80, 120]`, **When** the user clicks
   the outlier lozenge once, **Then** the `135` cell receives the outlier marker
   and a hover tooltip reads (for example) `"value 135, mean 100, +3.5σ"`.
2. **Given** outlier flagging is active at 2σ on a column, **When** the user
   hovers any unmarked numeric cell in the same column, **Then** no tooltip is
   shown for that cell and no marker is applied.
3. **Given** outlier flagging is not yet active on a numeric column, **When** the
   user views the lozenge, **Then** it is rendered in an idle state with an
   accessible name describing the next action (e.g. "Mark outliers in column
   'Latency' at 2σ").

---

### User Story 2 - Cycle the sigma threshold by repeated clicks (Priority: P1)

The user wants to tighten or relax the outlier criterion without leaving the page.
Repeated clicks on the same outlier lozenge cycle the threshold through the order
`idle → 2σ → 1σ → 3σ → idle`. The lozenge displays the current threshold (e.g. a
small `2`, `1`, `3` superscript on the `!`) so the user always knows which
threshold is in effect. Cells re-evaluate on every cycle change; the tooltip
reflects the current threshold's σ distance, not a fixed multiple.

**Why this priority**: Different domains have different "what counts as
surprising" thresholds. Cycling lets a user explore the column at three sensible
sensitivities in three clicks, without a popup, slider, or settings dialog.

**Independent Test**: Click the outlier lozenge on a numeric column four times.
Confirm the marked-cell set grows (2σ → 1σ), then shrinks (1σ → 3σ), then empties
(3σ → idle), and that the lozenge label updates each click.

**Acceptance Scenarios**:

1. **Given** outlier flagging is idle on a column, **When** the user clicks the
   lozenge once, **Then** the threshold becomes 2σ and the lozenge shows a `2`
   indicator.
2. **Given** the lozenge is at 2σ, **When** the user clicks it, **Then** the
   threshold becomes 1σ, more cells receive markers, and the lozenge shows a
   `1` indicator.
3. **Given** the lozenge is at 1σ, **When** the user clicks it, **Then** the
   threshold becomes 3σ, fewer cells (often none) receive markers, and the
   lozenge shows a `3` indicator.
4. **Given** the lozenge is at 3σ, **When** the user clicks it, **Then** the
   threshold returns to idle, every marker is removed, and the lozenge returns
   to its neutral indicator.

---

### User Story 3 - List all outliers in a column, sorted by distance (Priority: P2)

For a column with many flagged cells, a user wants a single summary view of every
outlier ranked by how far out it is. A secondary affordance on the active lozenge
(an explicit "show list" icon attached to the lozenge while flagging is active,
or `Shift`+click on the lozenge) opens a popup listing each outlier as
`row label — value — σ distance`, sorted by descending absolute σ. Clicking an
entry scrolls the corresponding row into view and briefly highlights it.

**Why this priority**: The per-cell marker answers "where" but not "which is
most extreme". The list view answers the second question in one click and turns
the enrichment into a triage tool. Marker without list is still useful, so this
ships at P2.

**Independent Test**: Activate outlier flagging on a column with at least five
outliers at 1σ. Open the outliers list, confirm entries are sorted from most-
distant to least-distant, and confirm clicking the top entry brings the
corresponding row into view.

**Acceptance Scenarios**:

1. **Given** outlier flagging is active on a column with three flagged cells,
   **When** the user activates the "show list" affordance on the lozenge,
   **Then** a popup opens listing those three cells in descending |σ| order
   with each entry showing the row label, the cell value, and the σ distance.
2. **Given** the outliers list popup is open, **When** the user clicks an entry,
   **Then** the popup remains open and the corresponding row is scrolled into
   view and briefly highlighted.
3. **Given** the outliers list popup is open, **When** the user presses `Escape`
   or clicks outside it, **Then** the popup closes and focus returns to the
   lozenge.

---

### User Story 4 - Persist and share an outlier view via URL (Priority: P2)

A user has set up a useful outlier view (e.g. "Latency at 1σ, Error rate at 3σ")
and wants to send it to a colleague. The set of active outlier flags — per table,
per column, per threshold — is encoded in the URL fragment using the same per-
URL-stem scheme as `src/utils/slider-persistence.ts`. Pasting the URL in a fresh
tab reproduces the same flagged view immediately on load.

**Why this priority**: Outlier setup is the user's investment; sharing turns that
investment into a collaboration artefact. Same payoff shape as sort and filter.

**Independent Test**: Activate outlier flagging on two columns at different
thresholds, copy the URL, open it in a private window, and verify both columns
show the same flagged cells at the same thresholds with the matching lozenge
indicators.

**Acceptance Scenarios**:

1. **Given** outlier flagging is active on column A at 1σ and column B at 3σ,
   **When** the user reloads the page, **Then** both columns are flagged at
   their original thresholds and both lozenges display the correct indicators.
2. **Given** a URL containing an outlier directive for a column that no longer
   exists in the table, **When** the URL is opened, **Then** the page loads with
   that directive silently ignored and any remaining valid directives applied.

---

### Edge Cases

- **Column with fewer than three numeric cells**: A column with `n < 3` numeric
  cells does not yield a meaningful σ. The lozenge MUST NOT be offered for
  such columns; the rest of the header lozenge cluster is unaffected.
- **All-equal numeric values (σ = 0)**: When every numeric cell has the same
  value, σ is zero and no cell can be more than 0σ from the mean. The lozenge
  MUST still be rendered (the column has `n ≥ 3` numeric cells) but MUST be
  inert: clicking it MUST NOT enter a flagging state, and its tooltip MUST
  explain "All values equal; no outliers to flag".
- **Non-numeric cells in the column**: Non-numeric cells (text, blank,
  whitespace, `"N/A"`) MUST be excluded from the mean and σ calculation. They
  MUST NOT receive an outlier marker regardless of threshold.
- **Single extreme value distorting σ**: This is the expected behaviour of σ
  (one outlier pulls the mean and σ up, hiding itself or other anomalies). v1
  uses the textbook population σ unmodified; robust estimators (MAD, trimmed
  σ) are out of scope.
- **Interaction with the filter enrichment**: When rows are dimmed by an active
  filter (see `specs/003-filter/spec.md`), the σ and mean MUST be recomputed
  over the currently un-dimmed rows. Adding or clearing filters MUST trigger a
  re-evaluation of the outlier marks. See Assumptions for rationale.
- **Interaction with the sort enrichment**: Sort reorders `tbody` rows but
  does not change which cells are outliers; outlier marks MUST follow their
  rows through sort.
- **`data-gs-ignore` on the table**: No outlier lozenges are offered; the
  table is fully ignored by Grid-Sight.
- **`data-gs-no-outlier` on the table**: No outlier lozenges are offered, but
  other enrichments (heatmap, sliders, statistics, sort, filter) continue to
  function.
- **Toggling Grid-Sight off**: All outlier markers and tooltips MUST be
  removed; the encoded threshold state MUST remain in the URL fragment so
  toggling Grid-Sight back on restores the same flagging.

## Requirements *(mandatory)*

### Functional Requirements

**Outlier affordance**

- **FR-001**: Grid-Sight MUST add an outlier lozenge with the visible label
  **!** to every qualifying numeric column header when Grid-Sight is enabled.
  The lozenge MUST live in the existing header lozenge cluster created by
  `src/ui/header-utils.ts`, alongside `H`, `#`, `S`, and the filter lozenge.
- **FR-002**: A column MUST qualify for outlier flagging if it has at least
  **3 numeric body cells** AND its numeric cells are not all equal (the
  all-equal case still renders the lozenge but in an inert state; see FR-009).
  Columns whose body cells use `rowspan` MUST NOT qualify.
- **FR-003**: The lozenge MUST cycle through four states on each click in the
  order `idle → 2σ → 1σ → 3σ → idle`. The active states (2σ, 1σ, 3σ) MUST each
  show a distinct indicator (e.g. the threshold digit appended to the `!`
  glyph). Idle MUST show a neutral indicator.
- **FR-004**: While flagging is active, the lozenge MUST display an
  `aria-pressed="true"` state with an accessible name that includes the
  current threshold (e.g. "Outliers in column 'Latency' at 1σ; click for 3σ").

**Per-cell marking**

- **FR-005**: When flagging is active on a column at threshold `Nσ`,
  Grid-Sight MUST mark every numeric cell in that column whose value `v`
  satisfies `|v − mean| > N · σ`. Non-numeric cells MUST NOT be marked.
- **FR-006**: The marker MUST be conveyed by at least two visual channels
  (e.g. coloured ring AND a border-style change) so it remains perceivable to
  users with colour-vision deficiencies. Colour alone MUST NOT be sufficient.
- **FR-007**: A marked cell MUST expose a tooltip on hover and on keyboard
  focus that includes the cell's value, the column mean, and the cell's
  signed σ distance (e.g. `"value 135, mean 100.0, +3.5σ"`).
- **FR-008**: σ MUST be computed as the population standard deviation of the
  column's numeric body cells, after excluding non-numeric cells, and (when
  any filter from `specs/003-filter/spec.md` is active) after excluding rows
  that are currently dimmed by that filter. See Assumptions.

**Inert states**

- **FR-009**: When a column has `n ≥ 3` numeric cells but every numeric cell
  has the same value, the lozenge MUST be rendered but MUST be inert:
  activation MUST NOT change state, and the lozenge MUST expose an
  explanatory tooltip such as "All values equal; no outliers to flag".
- **FR-010**: When a column has fewer than 3 numeric cells, the lozenge
  MUST NOT be rendered at all.

**Outliers list popup**

- **FR-011**: While flagging is active, the lozenge MUST expose a secondary
  affordance that opens an "outliers list" popup. The secondary affordance
  MUST be reachable both by mouse (a small icon attached to the active
  lozenge) and by keyboard (`Shift`+`Enter` while focused on the lozenge, or
  an explicit button in the cluster).
- **FR-012**: The outliers list popup MUST list every currently-marked cell
  in the column as `row label — value — σ distance`, sorted by descending
  absolute σ distance, with stable tie-breaking by document order.
- **FR-013**: Clicking or activating an entry in the popup MUST scroll the
  corresponding row into view and briefly highlight it without closing the
  popup.
- **FR-014**: The popup MUST close on outside click, on `Escape`, and on a
  second activation of the secondary affordance. On close, focus MUST return
  to the lozenge.

**Persistence**

- **FR-015**: Active outlier state (per table: per column: threshold ∈ {1, 2,
  3}) MUST be encoded in the URL fragment using the same per-URL-stem scheme
  as `src/utils/slider-persistence.ts`.
- **FR-016**: On page load, Grid-Sight MUST decode any outlier directives
  from the URL fragment and apply them before the user sees the table
  content settle.
- **FR-017**: A URL directive referring to a missing table or missing column
  MUST be silently ignored; other valid directives MUST still apply.

**Accessibility**

- **FR-018**: The outlier lozenge MUST be keyboard-operable (Enter / Space
  cycles the threshold) and MUST expose its current threshold via
  `aria-pressed` and an updated accessible name.
- **FR-019**: The per-cell tooltip MUST be reachable by keyboard focus on the
  marked cell, not by mouse hover alone.
- **FR-020**: The outliers list popup MUST be a focus-trapping dialog with a
  discernible accessible name (e.g. "Outliers in column 'Latency' at 1σ");
  `Escape` MUST close it and return focus to the lozenge.

**Integration**

- **FR-021**: Toggling Grid-Sight off MUST remove every outlier marker,
  every per-cell tooltip, and any open outliers list popup. The encoded
  threshold state MUST remain in the URL fragment so toggling Grid-Sight back
  on restores the same flagging.
- **FR-022**: A `data-gs-no-outlier` attribute on a table MUST suppress all
  outlier lozenges for that table without affecting other enrichments.
- **FR-023**: A `data-gs-ignore` attribute on a table MUST suppress every
  Grid-Sight enrichment on it, outliers included.
- **FR-024**: The outlier enrichment MUST coexist with the existing
  statistics enrichment (`#`); the column mean and σ used by both MUST be
  computed consistently from the same numeric-cell set, so users do not see
  contradictory numbers between the statistics popup and an outlier tooltip.

### Key Entities

- **Outlier Directive**: A `(table, column, threshold)` tuple where
  `threshold ∈ {1, 2, 3}` and is absent when the column is idle. At most one
  directive is active per column.
- **Column Statistics**: A `(mean, σ, numericCount)` record computed over the
  column's numeric body cells (restricted to currently un-dimmed rows when
  any filter is active). Shared with the statistics enrichment so the two
  views never disagree.
- **Outlier Mark**: A per-cell record `(cell, value, sigmaDistance)`
  associated with a marked cell while flagging is active. Marks are
  recomputed whenever the directive changes, the filter set changes, or the
  underlying DOM changes.
- **Persisted Outlier State**: The serialisation of all Outlier Directives on
  the page, written to the URL fragment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can flag outliers at the default 2σ threshold on a
  numeric column in **one click** from a Grid-Sight-enabled page.
- **SC-002**: For tables up to 1 000 numeric cells per column, activating or
  cycling the outlier threshold MUST mark or update the affected cells in
  **under 100 ms** on a mid-range laptop.
- **SC-003**: Re-opening a URL containing one or more outlier directives
  MUST restore the flagged view with no visible flash of unmarked content
  beyond **one animation frame** after first paint.
- **SC-004**: An outlier view shared by URL MUST reproduce on another
  machine **100% of the time** with no `localStorage` dependency.
- **SC-005**: Toggling Grid-Sight off MUST remove every outlier marker and
  tooltip with **byte-identical DOM** to the pre-flagging state (excluding
  GS-injected nodes).
- **SC-006**: The mean and σ shown in any outlier tooltip MUST agree to
  within floating-point round-off with the mean and σ shown by the
  statistics enrichment (`#`) on the same column.

## Assumptions

- **Population σ, unmodified**: σ is computed as the population standard
  deviation (divide by `n`, not `n − 1`) over the column's numeric cells.
  Robust estimators (MAD, trimmed σ, IQR-based fences) are out of scope for
  v1.
- **Recompute on filter changes**: When any filter from
  `specs/003-filter/spec.md` is active, σ and the mean are computed over the
  rows that are currently un-dimmed by the filter, and outlier marks are
  recomputed whenever the filter set changes. Rationale: the user has
  declared the visible subset to be the "real" data; flagging an outlier
  against the full unfiltered population would misrepresent that intent. The
  alternative (always use the unfiltered population) is rejected for v1 but
  may return as a per-table option later.
- **Default threshold is 2σ**: The first activation goes to 2σ because the
  68 / 95 / 99.7 rule makes 2σ the textbook "unusual" cut-off. 1σ is too
  permissive to be a default; 3σ is too strict.
- **Threshold cycle is fixed**: The cycle `idle → 2σ → 1σ → 3σ → idle` is
  hard-coded in v1. Arbitrary thresholds (e.g. 1.5σ, 2.5σ) and per-table
  custom thresholds are out of scope.
- **Label glyph**: The visible label is `!`. Alternatives considered:
  `±`, `σ`, `▲`. `!` won because it reads as "attention" without claiming
  any specific statistical commitment and is unambiguous in a single
  character. [NEEDS CLARIFICATION: confirm `!` does not collide with any
  existing or planned lozenge in the cluster.]
- **No new runtime dependency**: Mean and σ are computed in plain
  TypeScript over a numeric array; no statistics library is added.
- **Rides on existing statistics infrastructure**: The numeric-cell
  detection, value parsing, and column traversal are shared with the
  existing statistics enrichment under `src/ui/statistics-popup.ts`. The
  outlier enrichment adds a per-cell readout on top of that shared layer;
  it does not replace it.
- **The lozenge inherits the existing lozenge styling and keyboard handling
  from `src/ui/header-utils.ts`.**
