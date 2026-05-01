# Feature Specification: Dynamic Sliders & Interactive Examples

**Feature Branch**: `001-dynamic-sliders`
**Created**: 2026-05-01
**Status**: Ready for planning
**Input**: User description: "Introduce dynamic sliders, with interactive examples. Integrate this behaviour into the existing UI elements. Working behaviour is present on three reference mockup pages: alternate calculation models, synced persistent tables, and dynamic heatmap."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interpolate a value along a numeric axis (Priority: P1)

A user is reading a static lookup table where the row headers are numeric (e.g. Range
1000–21000) and the column headers are numeric (e.g. SL 10–100). They want to know the
value at a Range and SL that falls *between* the discrete header values shown.

They enable Grid-Sight on the table, click the plus icon next to a numeric axis header,
and choose "Add slider". A slider appears alongside that axis with min/max set from the
header values. As they drag the slider, a highlighted indicator moves along the axis and
a "current value" readout updates live, showing the linearly interpolated cell value at
the slider position.

**Why this priority**: This is the core capability the existing requirements already
anticipate ("Interpolation tools (slider alongside relevant axis)") and the simplest
slice that delivers user value on its own.

**Independent Test**: Open a page with one numeric-axis lookup table. Enable Grid-Sight,
add a slider to the row axis, drag it, and verify a continuously updating readout that
matches a hand-computed linear interpolation at the chosen position.

**Acceptance Scenarios**:

1. **Given** a table with numeric row headers and numeric data cells, **When** the user
   adds a slider to the row axis and drags it to a position between two row headers,
   **Then** an interpolated value is displayed live and updates within one animation
   frame of the drag.
2. **Given** a slider already added to a column axis, **When** the user drags the slider
   to a position exactly on a header value, **Then** the readout matches the literal
   cell value (no interpolation rounding error).
3. **Given** a table whose axis headers are non-monotonic or non-numeric, **When** the
   user opens the plus-icon menu, **Then** "Add slider" is not offered for that axis.

---

### User Story 2 - Compare two calculation models side by side (Priority: P2)

A user wants to see the difference between (a) values interpolated from the table data
and (b) values produced by an underlying formula. They view a page that shows the same
table twice, each with an "Enable Interactivity" toggle. Turning interactivity on for
both attaches sliders to both copies. As the user moves either slider, both readouts
update — one labelled "Interpolated from data", one labelled "From equation" — letting
the user spot where the formula diverges from the tabulated data.

**Why this priority**: Demonstrates Grid-Sight's value as an analysis tool, not just a
viewer. Builds on Story 1 by adding a second, parallel calculation model.

**Independent Test**: Load the alternate-calc-models example. Enable interactivity on
both tables. Drag the slider; verify both readouts respond, and that at slider positions
matching exact header values the "Interpolated" readout equals the table cell while the
"Equation" readout may differ.

**Acceptance Scenarios**:

1. **Given** two tables on a page, each with interactivity enabled, **When** the user
   moves the slider on Table A, **Then** Table B's slider and readout move in sync.
2. **Given** a formula has been associated with a table, **When** the slider is at a
   position, **Then** the "From equation" readout reflects the formula evaluated at
   that position, independent of the data cells.

---

### User Story 3 - Sync sliders across multiple tables on a page (Priority: P2)

A user views a page with several tables that share an axis (e.g. North Atlantic and
South Atlantic, both indexed by Range × SL). They want a single slider control whose
position applies to every synced table at once. They turn on interactivity, and a single
slider drives the highlight + readout in both tables. The slider position is reflected
in the URL so the page can be bookmarked at a chosen value.

**Why this priority**: Removes the need to keep multiple sliders manually aligned and
makes sharing a specific scenario (via bookmark) trivial.

**Independent Test**: Open the synced-persistent-tables example. Move the slider; verify
both tables update simultaneously. Copy the URL, paste in a new tab, and verify the
slider lands at the same position with the same readouts.

**Acceptance Scenarios**:

1. **Given** two tables declared as "synced", **When** the user moves a slider on
   either table, **Then** the slider on the other table moves to match and both
   readouts update.
2. **Given** the user has moved a slider, **When** they reload the page or bookmark and
   reopen the URL, **Then** the slider returns to the same position with the same
   readouts.

---

### User Story 4 - Dynamic heatmap driven by slider position (Priority: P3)

A user views a heatmap-coloured table and wants to highlight the row/column intersection
that corresponds to a chosen Range and SL. They add sliders to both axes; a marker
(e.g. a ring or crosshair) moves over the heatmap as they drag, and the interpolated
value at the marker position is shown. Optionally they can adjust a "threshold" slider
that recolours the heatmap so only cells above the threshold are highlighted.

**Why this priority**: Visually compelling and useful, but builds on Stories 1 + 3.
Implementing it last lets the foundation stabilise first.

**Independent Test**: Open the heatmap-demo example. Add sliders to both axes. Drag and
verify a marker moves to the correct interpolated position over the coloured cells.
Move the threshold slider (if present) and verify cells recolour live.

**Acceptance Scenarios**:

1. **Given** a heatmap-coloured table with axis sliders, **When** the user drags a
   slider, **Then** a visible marker on the heatmap moves to the slider position
   within one animation frame.
2. **Given** a threshold slider, **When** the user moves it, **Then** cells whose
   underlying value falls below the threshold are visually de-emphasised
   (e.g. faded), and cells at or above remain saturated.

---

### Edge Cases

- **Sparse data / missing cells**: If interpolation requires a cell that is empty or
  non-numeric, the readout MUST show a clear "no data" indicator rather than `NaN` or
  `0`.
- **Single-row or single-column tables**: A slider on a degenerate axis (only one
  value) MUST be disabled or hidden; "Add slider" MUST NOT be offered.
- **Slider position outside data range**: Sliders are bounded by the min and max of the
  axis headers; the user cannot drag past those endpoints.
- **Non-uniform axis steps**: Header values may not be evenly spaced (e.g. 1000, 6000,
  21000). Interpolation MUST use the actual header values, not assume uniform spacing.
- **Multiple slider sources**: If two synced sliders are dragged simultaneously (e.g.
  via touch on different tables), the most-recent input wins; no race-condition
  flicker.
- **Page with no valid tables**: Loading the script MUST NOT inject slider UI anywhere
  if no table qualifies for sliders.
- **Disabling interactivity**: Turning the toggle off MUST remove the slider, marker,
  and readout cleanly; the table returns to its original static appearance.
- **Bookmark from a different machine**: A URL containing slider state MUST restore
  that state without requiring any prior `localStorage` value to exist.

## Requirements *(mandatory)*

### Functional Requirements

**Slider creation and removal**

- **FR-001**: Grid-Sight MUST offer an "Add slider" option in the plus-icon context
  menu for any axis whose headers are all numeric (with optional unit suffixes) and
  whose values are monotonically increasing.
- **FR-002**: When the user selects "Add slider", the system MUST render a slider
  control alongside the chosen axis with min and max set from the smallest and largest
  header values on that axis.
- **FR-003**: The user MUST be able to remove a slider via the same plus-icon context
  menu (e.g. "Remove slider"), restoring the table to its prior state.

**Interpolation and readouts**

- **FR-004**: While the user drags a slider, the system MUST update the readout and any
  visual highlight within one animation frame of the input event.
- **FR-005**: The system MUST compute interpolated values using linear interpolation
  between the two nearest header values, accounting for non-uniform axis spacing.
- **FR-006**: When a slider is positioned exactly on a header value, the readout MUST
  equal the literal cell value (i.e. interpolation MUST return the exact value at
  endpoints).
- **FR-007**: For axes that span more than one dimension (i.e. interpolating in both
  row and column), the system MUST perform bilinear interpolation between the four
  surrounding cells.

**Alternate calculation models**

- **FR-008**: The system MUST support an alternate "from equation" mode for tables that
  have a formula associated with them, displaying the formula's output in addition to
  (not instead of) the data-interpolated value.
- **FR-009**: The system MUST clearly label which readout came from which model
  (e.g. "Interpolated" vs "From equation") so the user is never in doubt about the
  source.

**Synchronization**

- **FR-010**: Multiple tables on the same page MAY be declared as "synced" via a shared
  axis identity. When synced, moving any one slider MUST move the corresponding sliders
  on every synced table to the same position.
- **FR-011**: The sync mechanism MUST work without flicker when the user is actively
  dragging one slider — non-active sliders update visually but do not fight the drag.

**Persistence**

- **FR-012**: The current slider position MUST be reflected in the URL (e.g. as a query
  parameter or fragment) so the page can be bookmarked at a chosen value.
- **FR-013**: When a user reloads the page (or opens it from a bookmark), every slider
  MUST restore to the position encoded in the URL, falling back to `localStorage` if
  the URL has no slider state, and falling back to a sensible default otherwise.
- **FR-014**: Persistence MUST be scoped per URL stem (matching the existing GridSight
  persistence model) so that slider positions on one page do not bleed into others.

**Heatmap interaction**

- **FR-015**: When sliders are added to both axes of a heatmap-coloured table, the
  system MUST render a visible marker on the heatmap at the interpolated position and
  move it live as the user drags.
- **FR-016**: The system MAY offer a threshold slider that visually de-emphasises
  cells whose underlying value is below the threshold; the original cell colours MUST
  return when the threshold is removed.

**Existing UI integration**

- **FR-017**: Slider controls MUST be added through the existing plus-icon menu — no
  new top-level UI affordance — so the user's mental model is unchanged.
- **FR-018**: A page-level "Enable Interactivity" toggle MAY be exposed for demo
  contexts, but Grid-Sight's default behaviour MUST be that sliders are off until
  explicitly added per-axis through the plus-icon menu.

**Accessibility**

- **FR-019**: Each slider MUST be keyboard-operable (arrow keys to step, Page Up/Down
  for larger jumps, Home/End for endpoints) and expose appropriate ARIA role/name/value
  to assistive technology, in line with constitution Principle III.
- **FR-020**: Readouts MUST be exposed to screen readers as live regions so that
  values are announced (or queryable) as the slider moves, without flooding the AT with
  every intermediate frame.

**Offline / air-gapped**

- **FR-021**: All slider behaviour MUST function with no network access, in line with
  constitution Principle VI (Offline-First). The library MUST NOT fetch any resource at
  runtime to support sliders.

**Slider position resolution**

- **FR-022**: Slider position MUST be continuous (pixel-precise) along the axis range.
  The system MUST NOT quantise input to discrete steps. Keyboard input (arrow keys)
  MUST step by 1% of the range; Page Up/Down MUST step by 10%; Home/End MUST jump to
  min/max. The readout MUST update on every movement.

**Sync identity**

- **FR-023**: Grid-Sight MUST auto-detect synced tables: any two tables on the same
  page whose numeric axis headers (the full ordered header sequence on a given axis)
  are identical MUST share slider state on that axis. No explicit markup is required.
  A page MAY suppress sync via a `data-gs-no-sync` attribute on either table.

**Heatmap threshold**

- **FR-024**: The threshold slider described in Story 4 IS in scope for v1. When the
  user adds a "Threshold" slider to a heatmap-coloured table, cells whose underlying
  numeric value falls below the threshold MUST be visually de-emphasised (faded /
  desaturated); cells at or above MUST retain their full heatmap colour. Removing the
  threshold slider MUST restore all cells to their original colour.

### Key Entities

- **Slider**: A user-facing control bound to a specific axis (row or column) of a
  specific table, OR to a heatmap threshold. Holds: min, max, current position
  (continuous, pixel-precise), axis reference, and an auto-derived sync key (the
  ordered header sequence) for cross-table sync.
- **Axis Binding**: The connection between a slider and the numeric headers of a
  table's row or column axis. Encodes whether the binding is monotonic-increasing or
  monotonic-decreasing.
- **Readout**: A live-updating textual value derived from the slider position via
  interpolation (data-driven) or formula (equation-driven). May appear inline beside
  the slider or in a dedicated cell.
- **Sync Key**: An auto-derived identifier formed from a table's ordered numeric axis
  headers. Tables on the same page whose sync keys match share slider state on that
  axis unless suppressed by `data-gs-no-sync`.
- **Persisted Slider State**: The set of `(slider_id → position)` pairs persisted to
  the URL and to `localStorage` per the existing GridSight persistence model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a slider to any qualifying axis in **3 clicks or fewer**
  starting from the page (Grid-Sight toggle → plus icon → "Add slider").
- **SC-002**: Sliders deliver visible feedback within **one animation frame** (≤ 16 ms
  on a mid-range laptop) of any drag or keyboard input event.
- **SC-003**: A user can reproduce another user's view by sharing a URL — **100% of
  slider positions** restore correctly from URL alone, with no `localStorage`
  dependency.
- **SC-004**: For tables with up to 10 rows × 10 columns, slider drag MUST sustain
  **≥ 60 FPS** during continuous interaction on a mid-range laptop.
- **SC-005**: When sliders are added to two synced tables, the lag between the driven
  slider and its synced partner MUST be **imperceptible** (≤ 1 animation frame).
- **SC-006**: A keyboard-only user can move a slider end-to-end (min → max) using arrow
  / Page / Home / End keys in **under 5 seconds** on a 100-step slider.
- **SC-007**: Interpolation accuracy: for any slider position that lands exactly on a
  header value, the readout MUST match the cell value to **machine precision** (no
  rounding artefact).

## Assumptions

- The existing Grid-Sight enrichment toggle, plus-icon menu, and per-URL `localStorage`
  persistence model (documented in `documents/GridSight_Requirements.md`) are reused
  unchanged. This feature integrates with them rather than replacing them.
- "Numeric axis" is decided by the existing detection logic: all headers are numbers
  (optionally with a unit suffix). Sliders are not offered for categorical or mixed
  axes.
- Linear interpolation (1-D) and bilinear interpolation (2-D) are sufficient for the
  v1 scope. Higher-order interpolation (cubic, spline) is out of scope.
- "Equation mode" is opt-in per table: a formula is supplied by the page (e.g. via a
  data attribute or registration call) and Grid-Sight evaluates it. This feature does
  NOT include a formula-authoring UI.
- The threshold-slider sub-feature in Story 4 is in scope for v1 (per Q3 answer).
- Slider position is continuous (pixel-precise). Because positions rarely land
  exactly on a header value, FR-006 ("readout equals literal cell at header value")
  is a property of the interpolation function, not a snap behaviour — readouts
  smoothly approach the literal value as the slider nears a header.
- No telemetry, no internet fetches, no new runtime dependencies are added by this
  feature (constitution principles I and VI).
- Browser support follows the constitution baseline (any evergreen browser ≤ 2 years
  old). Internet Explorer is explicitly out of scope.
- The mockup pages on `deepbluecltd.github.io/Fi3ldMan/...` are reference
  implementations whose *behaviour* is the authoritative source; their *code* is not
  necessarily the basis for the Grid-Sight implementation.
