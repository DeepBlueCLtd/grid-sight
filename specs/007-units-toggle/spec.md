# Feature Specification: Units Toggle Enrichment

**Feature Branch**: `007-units-toggle`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "When a numeric column header parses as a value-with-unit (e.g. 'Weight (kg)', 'Distance / ft', 'Temperature °C'), offer a units-toggle lozenge that cycles compatible units in the same dimension and rewrites both header and visible cell values without mutating the source DOM."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch a column's units inline (Priority: P1)

A user is reading a table that quotes weights in kilograms but they think in pounds
(or vice-versa). With Grid-Sight enabled, the column header `Weight (kg)` displays a
units-toggle lozenge (label `⇌` or `u`) alongside the existing `H` / `#` / `S`
cluster. The first click rewrites the visible header to `Weight (lb)` and recomputes
every displayed cell value in that column from kilograms to pounds. The underlying
DOM source cells are not touched — re-reading them via the DOM still returns the
original kilogram text. A second click cycles to the next compatible unit (e.g.
grams); successive clicks continue around the dimension until the column returns to
its original unit.

**Why this priority**: A unit mismatch is one of the most common causes of
"I can't read this table at a glance". Inline unit conversion is the single biggest
quality-of-life win Grid-Sight can offer for numeric data and is independently
valuable without any of the persistence or accessibility extensions.

**Independent Test**: Open a page with a table containing a `Weight (kg)` column.
Toggle Grid-Sight on, click the units lozenge once, confirm the header now reads
`Weight (lb)` and every cell in the column is the kg-to-lb conversion rounded to the
same decimal count as the source. Click again and confirm cycling to grams; click
through to return to kilograms with values byte-identical to the source.

**Acceptance Scenarios**:

1. **Given** a column header parsed as `Weight (kg)` with cells `[10, 20, 30]`,
   **When** the user clicks the units lozenge once, **Then** the header reads
   `Weight (lb)` and the displayed cells read `[22, 44, 66]` (rounded to zero
   decimals because the source had zero decimals).
2. **Given** the same column has been switched to `lb`, **When** the user clicks
   the lozenge again, **Then** the header reads `Weight (g)` and cells read
   `[10000, 20000, 30000]`.
3. **Given** the column has cycled all the way around, **When** the user clicks
   the lozenge once more, **Then** the header and cell text return to the
   original DOM values exactly.
4. **Given** the column is in a converted unit, **When** the user inspects the
   underlying `<td>` source via the DOM, **Then** the source text is unchanged
   from page load.

---

### User Story 2 - Persist the active unit in the URL (Priority: P2)

A user has switched several columns into their preferred units (mass to lb,
distance to mi) and wants to share that view. The active unit per column is encoded
in the URL fragment using the same per-page persistence scheme as
`src/utils/slider-persistence.ts`. Opening the URL on another machine reproduces
the same column-by-column unit choices without any `localStorage` value.

**Why this priority**: Without persistence, every viewer has to re-click to reach
their preferred reading. With persistence, a sender can choose units once and the
recipient sees the table that way immediately. Layered cleanly on top of Story 1.

**Independent Test**: Switch column A from kg to lb and column B from m to ft, copy
the URL, open it in a new private window. Verify both columns render in lb and ft
respectively at first paint, with no `localStorage` value present.

**Acceptance Scenarios**:

1. **Given** the user has switched a column to lb, **When** they reload the page,
   **Then** the column re-renders in lb with the lozenge showing the next-target
   unit's accessible name.
2. **Given** a URL fragment names a unit Grid-Sight no longer recognises (e.g. a
   future build dropped a unit), **When** the URL is opened, **Then** the column
   renders in its original unit and the directive is silently dropped.

---

### User Story 3 - Sliders and units cooperate predictably (Priority: P3)

A user has enabled a slider on a numeric column (feature 001) and then switches
the column from m to ft. The slider's track labels and the numeric readout MUST
display in feet. The slider's underlying interpolation continues to use the
source values in metres, so the visual position of the thumb does not jump when
the unit is changed.

**Why this priority**: The two enrichments naturally compose; documenting and
testing the interaction prevents a class of subtle bugs where unit conversion
silently changes filter results.

**Independent Test**: Enable a slider on a column with metres, set the thumb to a
middle position, switch units to feet, confirm the slider readout updates to feet
without the thumb moving and that the set of rows below/above the thumb is
unchanged.

**Acceptance Scenarios**:

1. **Given** a slider is active at position P on a metres column, **When** the
   user switches units to feet, **Then** the thumb stays at position P, the
   readout shows the value in feet, and no rows are added to or removed from the
   filtered set.
2. **Given** the column is in feet and the slider is moved, **When** the user
   switches back to metres, **Then** the same set of rows remains filtered and
   the readout displays metres.

---

### Edge Cases

- **Header parses ambiguously** (e.g. `Length` with no unit, or `Score (high)` where
  `high` is not a unit): The lozenge MUST NOT be offered for that column.
- **Mixed units within a column** (e.g. some cells suffixed `kg`, others `lb`): The
  lozenge MUST be inert (visible but disabled) with a tooltip explaining "Mixed
  units detected — cannot convert".
- **Cells with non-numeric content** within an otherwise numeric column (e.g. "N/A",
  "—", "<5"): Such cells MUST be left untouched by conversion; only cells that
  parse as a finite number are rewritten.
- **Header containing a unit Grid-Sight doesn't recognise** (e.g. `(furlongs)`):
  The lozenge MUST render but be inert, with a tooltip "Unit 'furlongs' is not
  recognised".
- **Unit appears inside the cells but not in the header** (e.g. cells read
  `10 kg`, `20 kg` with header `Weight`): Out of scope for v1 — the lozenge is
  only offered when the header parses.
- **Compound units** (e.g. `kg·m/s²`, `J/(mol·K)`): Out of scope for v1; the
  lozenge is not offered.
- **`data-gs-no-units` opt-out**: A column header carrying this attribute MUST NOT
  show the lozenge regardless of header parse.
- **Precision**: Display precision MUST match the source column's apparent
  precision, computed as the maximum decimal-digit count across the source cells.
  Rounding MUST use banker's rounding to avoid systematic bias.
- **Temperature**: Conversion MUST use the affine formulas
  (`°F = °C × 9/5 + 32`, `K = °C + 273.15`), not a scale factor.
- **Negative or zero values** in conversions whose target unit has a non-zero
  offset (temperature): MUST be converted correctly through the affine formula
  rather than clamped.
- **Disabling Grid-Sight while a unit is active**: Turning Grid-Sight off MUST
  restore the original header and cell text exactly; turning it back on MUST
  re-apply the URL-encoded unit choice.

## Requirements *(mandatory)*

### Functional Requirements

**Header parsing**

- **FR-001**: Grid-Sight MUST parse each body-column header against a small set of
  patterns: `Name (unit)`, `Name / unit`, `Name [unit]`, and `Name unit-symbol`
  where the unit-symbol set includes `°C`, `°F`, `K`, `kg`, `g`, `lb`, `m`, `ft`,
  `km`, `mi`, `kt`, `km/h`, `mph`, `Pa`, `kPa`, `bar`, `psi`, `L`, `mL`, `gal`,
  `s`, `min`, `h`.
- **FR-002**: A column MUST qualify for the units toggle only when its header
  unambiguously parses to a known unit AND every numeric cell in the column is
  consistent with that unit (no per-cell unit suffix conflicts).
- **FR-003**: A `data-gs-no-units` attribute on the column header or table MUST
  suppress the units lozenge for that column / table without affecting other
  enrichments.

**Conversion behaviour**

- **FR-004**: Conversion MUST be pure and deterministic — no network access, no
  external data, no `localStorage` reads.
- **FR-005**: Grid-Sight MUST ship a built-in unit table covering at minimum the
  dimensions **mass** (kg, g, lb), **length** (m, ft, km, mi), **temperature**
  (°C, °F, K), **speed** (kt, km/h, mph), **pressure** (Pa, kPa, bar, psi),
  **volume** (L, mL, gal), and **time** (s, min, h).
- **FR-006**: Clicking the lozenge MUST cycle through compatible units within the
  same dimension in a stable, documented order, returning to the original unit at
  the end of the cycle.
- **FR-007**: Conversion MUST rewrite both the header label (the displayed unit
  token) and the visible cell text in the column. The underlying `<th>` and
  `<td>` source text content MUST NOT be mutated; Grid-Sight MUST overlay or
  swap-render the display without losing the original text.
- **FR-008**: Display precision MUST match the source column's apparent precision,
  computed as the maximum decimal-digit count seen across numeric source cells.
  Rounding MUST use banker's rounding (round-half-to-even).
- **FR-009**: Cells whose source text does not parse as a finite number MUST be
  left visually untouched (no rewrite, no error).
- **FR-010**: Temperature conversion MUST use affine formulas, not a scale factor.

**Mixed and unknown units**

- **FR-011**: When a column's header parses to a unit Grid-Sight does not
  recognise, the lozenge MUST still render but be inert, with a tooltip naming
  the unrecognised unit.
- **FR-012**: When a column's cells contain conflicting unit suffixes, the
  lozenge MUST render inert with a tooltip explaining "Mixed units detected —
  cannot convert".
- **FR-013**: Columns whose headers do not parse to any unit at all MUST NOT
  show the lozenge.

**Persistence**

- **FR-014**: The active unit for each converted column MUST be encoded in the
  URL fragment using the same per-URL-stem scheme as
  `src/utils/slider-persistence.ts`.
- **FR-015**: On page load, Grid-Sight MUST decode any unit directives from the
  URL fragment and apply them before the user sees the table content settle.
- **FR-016**: A URL directive naming a unit Grid-Sight no longer recognises, or a
  column that no longer parses, MUST be silently ignored.

**Integration with other enrichments**

- **FR-017**: When sliders (feature 001) are active on a column with a unit
  toggle, the slider's displayed labels and numeric readout MUST render in the
  currently active unit.
- **FR-018**: Slider interpolation, comparison, and filtering logic MUST continue
  to operate on source values in the column's original unit; switching units
  MUST NOT change the set of rows below/above the thumb.
- **FR-019**: The units lozenge MUST live in the existing header lozenge cluster
  alongside `H`, `#`, and `S` so the user's mental model is unchanged.

**Accessibility**

- **FR-020**: The lozenge MUST be keyboard-operable (Enter / Space activates it).
- **FR-021**: The lozenge's accessible name MUST reflect the **next-target** unit
  (e.g. "Switch column 'Weight' to lb"), updating after each click.
- **FR-022**: The parent header cell's `aria-label` MUST be updated to reflect
  the currently displayed unit (e.g. "Weight, pounds") when a unit is active, so
  screen-reader users hear the same unit sighted users see.
- **FR-023**: Colour MUST NOT be the sole channel indicating an active conversion;
  the visible unit token in the header text is the primary indicator.

### Key Entities

- **Dimension**: A family of compatible units (mass, length, temperature, speed,
  pressure, volume, time). Conversions only cycle within a single dimension.
- **Unit**: A `(symbol, dimension, toBase, fromBase)` record. `toBase` and
  `fromBase` are pure functions converting between this unit and the dimension's
  canonical base unit (SI where applicable). For temperature these are affine;
  for all other supported units they are linear.
- **Column Unit State**: A `(table, column, active-unit)` tuple recording which
  unit a column is currently displayed in. At most one active unit per column.
- **Persisted Unit State**: The serialisation of all active column-unit choices
  on the page, written to the URL fragment.
- **Precision Profile**: Per-column metadata recording the maximum decimal-digit
  count of source values, used to round converted values to a consistent
  precision.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch a numeric column to a different unit in **one
  click** once Grid-Sight is enabled.
- **SC-002**: For tables up to 1 000 rows, a unit switch MUST visibly rewrite the
  column in **under 100 ms** on a mid-range laptop, in line with the runtime
  budget in the constitution.
- **SC-003**: Round-tripping through every unit in a dimension and back MUST
  reproduce the original displayed values **byte-identically** to the source
  text (subject to the documented precision rules).
- **SC-004**: A URL with active unit directives MUST reproduce the same
  per-column unit display on another machine **100% of the time** with no
  `localStorage` dependency.
- **SC-005**: The full feature (parser, unit table, lozenge, persistence) MUST
  add no more than **1.5 KB gzipped** to the IIFE bundle, in line with the
  Lightweight & Minimal Dependencies constitutional principle.
- **SC-006**: When a slider and a unit toggle are both active on the same
  column, switching units MUST NOT change the filtered row set in **100%** of
  cases.

## Assumptions

- The existing per-URL-stem persistence model (URL fragment, same scheme as
  `src/utils/slider-persistence.ts`) is reused unchanged.
- The built-in unit table covers the dimensions listed in FR-005 and no others
  in v1. Arbitrary or compound units (`kg·m/s²`, `J/(mol·K)`, currency, custom
  domain units) are out of scope; users with such columns will see no lozenge.
- Header parsing relies on the unit symbol appearing in the header text in one
  of the documented patterns. Inferring units from cell content when the header
  has none is out of scope for v1.
- Per-column precision is derived from the source DOM once at load time and is
  not re-derived after a user-driven conversion.
- Slider interpolation continues to operate on source values; this means a
  slider configured in metres and viewed in feet has its underlying min/max in
  metres. The slider's persisted thumb position MUST be stored as a normalised
  0..1 fraction along the source-unit axis range, so that shared URLs survive
  later unit toggles unchanged: the display layer translates the fraction back
  into whichever unit is currently active on read.
- No new runtime dependency is introduced; conversions and parsing are
  hand-rolled against the constitutional zero-runtime-deps principle.
- The lozenge inherits the existing lozenge styling and keyboard handling from
  `src/ui/header-utils.ts`.
