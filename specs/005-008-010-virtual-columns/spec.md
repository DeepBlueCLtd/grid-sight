# Feature Specification: Virtual Columns (Sparkline + Cumulative + Compare-Column)

**Feature Branch**: `005-008-010-virtual-columns`
**Created**: 2026-05-19
**Status**: Draft
**Supersedes (planning only, not history)**:
  [`specs/005-sparkline/spec.md`](../005-sparkline/spec.md),
  [`specs/008-cumulative-column/spec.md`](../008-cumulative-column/spec.md),
  [the column-compare half of `specs/010-diff-compare/spec.md`](../010-diff-compare/spec.md)
**Input**: Combine the three features that append derived columns to the right
edge of a table. Each appends one or more `<th>` / `<td>` cells, must coexist
with the others in a defined order, must clean up on Grid-Sight-off, must
register itself with `009-copy-as-csv`'s "include GS virtual columns" toggle,
and must follow the visible-row pipeline from
`002-003-row-visibility`. Most of the work is the shared scaffold; each
feature's own contribution is a small per-cell renderer.

## Why combine

- **Same DOM operation**: append-only `<th>` in `<thead>` plus one appended
  `<td>` per body row, with `<tfoot>` getting empty appended cells for column
  alignment. Already mandated identically by `005` FR-004, `008` FR-007, and
  `010` FR-011/FR-012.
- **Same lifecycle**: activate → render → re-render on visible-row changes →
  detach → leave byte-identical DOM. Quoted identically by all three SC sets.
- **Same ordering problem**: `008` Edge Cases already specify "cumulative
  first, sparkline last"; `010` FR-012 says the compare column "MUST coexist
  with cumulative and sparkline columns per their ordering rules". The
  ordering belongs to the scaffold, not each feature.
- **Same persistence shape**: all three encode per-table directives under the
  shared URL-fragment scheme; reload precedes content-settle by one animation
  frame.
- **Same numeric-column detector**: all three reuse the heatmap/statistics
  detector. Defining the dependency once removes three independent
  "what counts as numeric" answers.
- **Same downstream consumer**: `009-copy-as-csv`'s "include GS virtual
  columns" toggle needs a single registry to enumerate, not three.

Each feature still ships as an independent priority and can be removed without
affecting the others. The combined spec defines the *scaffold* explicitly and
references each feature's own renderer through it.

The row-compare half of `010-diff-compare` is **not** part of this combined
spec — it renders an appended row, not an appended column, and stays in
`010-diff-compare/spec.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Append a running-sum column (Priority: P1)

[Carried from `008-cumulative-column` US1.] A Σ lozenge on a numeric column
header appends a "Σ <header>" column on the right. Second click cycles to
percent-of-total. Third click removes it.

**Acceptance Scenarios**: see `008-cumulative-column/spec.md` US1 AS1–AS4.

---

### User Story 2 - Append a row sparkline column (Priority: P1)

[Carried from `005-sparkline` US1.] A ⌇ lozenge in the table's corner cluster
appends a "Trend" column rendering an inline SVG mini-bar-chart per row across
the table's numeric body columns.

**Acceptance Scenarios**: see `005-sparkline/spec.md` US1 AS1–AS3.

---

### User Story 3 - Append a column-comparison column (Priority: P2)

[Carried from `010-diff-compare` US2.] In compare mode, picking column A then
column B appends a "Δ <colB> − <colA>" column on the right edge with per-row
deltas.

**Acceptance Scenarios**: see `010-diff-compare/spec.md` US2 AS1–AS2.

---

### User Story 4 - Sparkline hover, focus, tooltip, header highlight (Priority: P2)

[Carried from `005-sparkline` US2.] Sparkline cells are focusable; hover or
focus shows a tooltip (min/max/last) and highlights the source-column
headers.

**Acceptance Scenarios**: see `005-sparkline/spec.md` US2 AS1–AS3.

---

### User Story 5 - Sparkline per-row vs shared scaling (Priority: P2)

[Carried from `005-sparkline` US3.] A mode toggle near the "Trend" header
flips between per-row (default) and shared scaling. The state is persisted.

**Acceptance Scenarios**: see `005-sparkline/spec.md` US3 AS1–AS3.

---

### User Story 6 - Multiple virtual columns coexist in a defined order (Priority: P2, **new in the combined spec**)

The user activates a cumulative column on "Weight", then a cumulative column
on "Cost" (percent-of-total mode), then the sparkline column, then a
column-compare overlay between "Q1" and "Q4". The appended columns appear, in
left-to-right order:

1. Every cumulative column, in activation order;
2. The column-compare column (at most one);
3. The sparkline column (at most one — always last).

Removing any virtual column leaves the others in their previous positions.

**Why this priority**: The three features explicitly cross-reference each
other on ordering. Without one spec defining the order, each ordering rule
ends up in the wrong feature's edge-cases section, and the inevitable fourth
appendable feature has to amend three specs at once.

**Independent Test**: Activate three cumulative columns, the sparkline, and
the column-compare overlay. Confirm the appended column order is
`[Σ A, Σ B, Σ C, Δ, Trend]`. Remove Σ B; confirm the order becomes
`[Σ A, Σ C, Δ, Trend]` with no other reflow.

**Acceptance Scenarios**:

1. **Given** two cumulative columns (`Σ Weight`, `Σ Cost`) are active in that
   order, **When** the user activates the sparkline column, **Then** the
   appended columns read left-to-right `[Σ Weight, Σ Cost, Trend]`.
2. **Given** the above plus an active column-compare overlay between two
   numeric columns, **When** the user inspects the DOM, **Then** the appended
   columns read left-to-right `[Σ Weight, Σ Cost, Δ, Trend]`.
3. **Given** the above ordering, **When** the user removes `Σ Weight`,
   **Then** the appended columns read left-to-right `[Σ Cost, Δ, Trend]` with
   no other column moving more than the single position vacated.

---

### User Story 7 - Persist and share every appended column via URL (Priority: P2)

[Combines `005-sparkline` US4, `008-cumulative-column` US2 (persistence
half), and `010-diff-compare` FR-017 column-mode portion.] All virtual-column
directives are encoded in the URL fragment under a single per-page namespace
and reproduce on another machine 100% of the time, restored within one
animation frame.

**Acceptance Scenarios**: union of `005` US4 AS1–AS2, `008` US2 AS1–AS3,
`010` AS5 (column-mode subset).

---

### User Story 8 - Cooperate with the visible-row pipeline (Priority: P2, **new in the combined spec**)

[Reconciles `005` FR-024/FR-025, `008` FR-011, `010` FR-015/FR-016.] When the
visible-row pipeline from `002-003-row-visibility` emits a change event:

- The sparkline `<td>` for each row follows the row to its new position; in
  shared-scale mode, the scale is recomputed over the currently un-dimmed
  rows.
- Every cumulative column recomputes over the new Visible Row Sequence
  (dimmed rows excluded from accumulation).
- A column-compare overlay is unaffected by row order; if it consumes per-row
  values, it walks the Visible Row Sequence so the overlay column aligns row-
  for-row with the source body.

**Independent Test**: Sort a table with all three virtual columns active.
Verify (a) sparkline cells move with their rows, (b) cumulative values update
to reflect the new order, (c) the compare column's per-row delta cells move
with their source rows.

**Acceptance Scenarios**:

1. **Given** sparkline + cumulative + compare columns are active and a sort
   directive then fires, **When** the sort completes, **Then** all appended
   cells in each row move with their row and recompute (if order-dependent)
   within one animation frame.
2. **Given** a filter then dims half the rows, **When** the dim event
   propagates, **Then** cumulative columns exclude dimmed rows from
   accumulation and the shared-scale sparkline window recomputes over the
   un-dimmed subset.

---

### Edge Cases (union of source specs, plus new combinations)

Carried verbatim from source specs:

- Sparkline qualifier: `≥ 3 predominantly-numeric body columns` (`005` FR-002).
- Sparkline incomplete row → em-dash placeholder (`005` FR-009).
- Sparkline zero-range row → flat baseline (`005` Edge Cases).
- Cumulative non-numeric cells skipped, virtual cell rendered blank
  (`008` FR-012).
- Cumulative + sparkline ordering (`008` Edge Cases) — promoted to US6.
- Compare non-numeric operand → "—" placeholder (`010` FR-009).
- Compare zero divisor for percent (`010` FR-010).
- `data-gs-ignore`, `data-gs-no-sparkline`, `data-gs-no-cumulative`,
  `data-gs-no-compare` opt-outs (all three specs).
- Toggle Grid-Sight off → all appended cells removed, byte-identical DOM
  (all three specs' SC-005-equivalents).
- `colgroup` / `col` declarations do not apply to appended columns
  (`005` Edge Cases) — generalised in the scaffold.
- `rowspan` / `colspan` on source body cells suppress the offering
  (`008` Edge Cases).

New / clarified combination cases:

- **Order conflict**: if a URL directive describes an activation order that
  would violate US6 (e.g. sparkline before cumulative), the scaffold MUST
  re-apply the canonical order on restore and emit no error.
- **Removing a cumulative column mid-list**: documented in US6 AS3.
- **Visible-row pipeline change events fire once per frame**: all virtual
  columns subscribe to the same event source and re-render in dependency
  order (cumulative first, then sparkline shared-scale, then compare).
- **Copy-as-CSV registry**: every virtual column registers itself with the
  copy module's "include GS virtual columns" enumeration (`009-copy-as-csv`).
  Deactivating a virtual column MUST deregister it.

## Requirements *(mandatory)*

### Functional Requirements

The combined requirements set is the union of `005-sparkline` FR-001..FR-028,
`008-cumulative-column` FR-001..FR-020, and `010-diff-compare` FR-011/FR-012
(column-mode appended column only), *with the following additions and
reconciliations*:

**Virtual-column scaffold (new, replaces the equivalent fragments in each
source spec)**

- **FR-VC-001**: Grid-Sight MUST expose, internally, a single virtual-column
  scaffold (`enrichments/virtual-column.ts`) responsible for:
  - appending one `<th>` to every header row in `<thead>`,
  - appending one `<td>` to every body row in `<tbody>`,
  - appending one empty `<td>` to every `<tfoot>` row,
  - assigning a stable internal id to each appended column,
  - removing every appended cell cleanly on detach.
- **FR-VC-002**: Each feature MUST register a renderer with the scaffold via
  a typed registration call (`registerVirtualColumn({ kind, ... })`) and MUST
  NOT touch `<th>` / `<td>` cells directly outside its renderer's per-cell
  output node.
- **FR-VC-003**: The scaffold MUST own column ordering across features. The
  canonical left-to-right order is:
  1. Every cumulative column in activation order;
  2. The column-compare column (at most one);
  3. The sparkline column (at most one — always last).
- **FR-VC-004**: When the visible-row pipeline emits a change event, the
  scaffold MUST notify every registered renderer in dependency order
  (cumulative → compare → sparkline-shared-scale) within one animation frame.
- **FR-VC-005**: The scaffold MUST register every active virtual column with
  the copy-as-CSV registry (`009-copy-as-csv`) and deregister on detach.
- **FR-VC-006**: Detaching the scaffold MUST leave the host table's DOM
  byte-identical to the pre-activation snapshot, except for any GS-injected
  lozenge nodes outside the scaffold's scope.
- **FR-VC-007**: The scaffold MUST enforce the qualifier rules of each
  feature it hosts (numeric column for cumulative, ≥ 3 numeric body columns
  for sparkline, no `rowspan` / `colspan` on source body cells) before
  rendering. Renderers MUST refuse activation on disqualified tables.

**Per-feature renderers**

- Cumulative-column renderer: implements `008-cumulative-column` FR-004,
  FR-005 (computation), FR-008 (header text), FR-011 (recompute triggers,
  via FR-VC-004), FR-012 (skip non-numeric), FR-016/FR-017 (a11y).
- Sparkline renderer: implements `005-sparkline` FR-005 (inline SVG, no
  external refs), FR-008..FR-011 (bar style, scaling modes), FR-012..FR-014
  (hover/focus, tooltip, header highlight), FR-015/FR-016 (mode toggle),
  FR-020..FR-023 (a11y).
- Compare-column renderer: implements `010-diff-compare` FR-008..FR-010
  (delta computation), FR-012 (header text "Δ <colB> − <colA>"), FR-013
  (delta display modes), FR-014 (direction by colour + glyph), FR-022 (per-
  cell `aria-label`).

**Lozenges and affordances (carried)**

- Cumulative Σ lozenge in the existing column-header cluster
  (`008` FR-001/FR-002, FR-018).
- Sparkline ⌇ lozenge in the table's corner cluster
  (`005` FR-001, alongside the sliders S lozenge).
- Compare Δ lozenge in the table's corner cluster
  (`010` FR-001, FR-025). Note: the compare lozenge governs *both* row-mode
  (out of scope here — see `010-diff-compare/spec.md`) and column-mode (in
  scope here).

**Persistence**

- **FR-VC-008**: All virtual-column directives MUST be encoded under a
  single per-page URL-fragment namespace (one block per table) with one entry
  per active appended column.
- **FR-VC-009**: Restoration MUST be applied before the user sees content
  settle (one animation frame after first paint). Directives referring to
  missing tables, missing source columns, or missing rows MUST be silently
  dropped; surviving directives MUST still apply.
- **FR-VC-010**: A URL directive describing an activation order that
  contradicts FR-VC-003 MUST be silently re-canonicalised on restore. No
  error is emitted.

**Integration**

- **FR-VC-011**: The scaffold consumes the Visible Row Sequence from
  `utils/visible-rows.ts` exclusively. It MUST NOT read raw `tbody` order
  except to capture the original-order snapshot at first activation.
- **FR-VC-012**: Toggling Grid-Sight off MUST detach the scaffold (FR-VC-006)
  while leaving the URL state intact, so toggling back on restores every
  active virtual column.
- **FR-VC-013**: `data-gs-ignore` on a table suppresses the scaffold
  entirely. `data-gs-no-sparkline` / `data-gs-no-cumulative` /
  `data-gs-no-compare` each suppress only their feature's lozenge without
  affecting other appended columns on the same table.

### Key Entities

- **Virtual Column Directive**: `(table, kind, id, ...kind-specific-fields)`
  where `kind ∈ {cumulative, compare, sparkline}`. Multiple cumulative
  directives may coexist per table; at most one compare directive (column-
  mode); at most one sparkline directive.
- **Appended Column Record**: the injected `<th>` / `<td>` nodes for a single
  virtual column, tagged with the directive's id.
- **Virtual Column Registry**: the per-table set of active directives, in
  canonical left-to-right order. Consumed by the copy-as-CSV registry.
- **Persisted Virtual Column State**: the single per-page URL-fragment
  serialisation containing every active directive across every table.
- Per-feature entities (carried unchanged): Sparkline Eligible Column Set /
  Row Series / Scaling Window (`005`); Cumulative Visible Row Sequence
  (`008`; superseded here by the shared Visible Row Sequence from
  `002-003-row-visibility`); Comparison Overlay / Pause State (`010`).

## Success Criteria *(mandatory)*

The combined feature inherits every measurable outcome from the three source
specs. Where source specs quoted equivalent numbers, the combined number is
the *max* of them (i.e. the budget covers the combined re-render).

- **SC-001**: A user can activate any one virtual column (cumulative,
  sparkline, or compare-column) in **one click** (cumulative, sparkline) or
  **three clicks** (compare: Δ, col A, col B) from a Grid-Sight-enabled
  page.
- **SC-002**: For tables up to 1 000 rows × up to 10 numeric body columns,
  activating any virtual column, switching its mode, or recomputing it on a
  visible-row pipeline event MUST complete in **under 200 ms** (sparkline
  initial render) or **under 100 ms** (cumulative / compare / sparkline
  mode-flip) on a mid-range laptop.
- **SC-003**: A URL containing virtual-column directives MUST restore them
  with no visible flash beyond **one animation frame** after first paint.
- **SC-004**: A shared URL MUST reproduce on another machine **100% of the
  time** with no `localStorage` dependency.
- **SC-005**: Toggling Grid-Sight off MUST detach every appended column with
  **byte-identical DOM** to the pre-enrichment state (excluding GS-injected
  lozenge nodes anywhere on the page).
- **SC-006**: Every appended cell MUST have a non-empty accessible name
  (`005` SC-006 generalised) — an automated audit on fixture tables finds
  zero empty `aria-label`s on appended cells across all three feature
  variants.
- **SC-007 (new)**: With all three virtual-column variants active on one
  table, the appended-column order MUST be canonical (FR-VC-003) on first
  render and after every visible-row pipeline event, verified by an
  automated parity check.

## Assumptions

Union of source specs, with the following additions and reconciliations:

- **Append-only DOM**, no mutation of source cells (`005` Assumptions,
  carried scaffold-wide).
- **Numeric-column detection is shared** across all three features
  (`005`, `008` Assumptions) — the same detector used by heatmap and
  statistics.
- **Visible-row pipeline is the only source of order and dim-state** for
  virtual-column renderers (FR-VC-011). Renderers MUST NOT read raw
  `tbody.rows` to make per-cell decisions.
- **Single sparkline column, single compare column, multiple cumulative
  columns** per table. v1 does not support multiple sparkline or compare
  columns; the URL parser ignores extras silently.
- **v1 sparkline style is bar only** (`005` Assumptions); the style
  identifier exists in the persisted state for forward compatibility.
- **v1 cumulative modes are sum and percent-of-total only** (`008`
  Assumptions); running mean and percent-of-max are out of scope for v1.
- **Column-compare is pairwise** (`010` Assumptions); N-way is out of scope.
- **No new runtime dependency** (`005`, `008`, `010` all assert this; the
  scaffold inherits the same constraint).
- **Constitution bundle budget** (`.specify/memory/constitution.md`, ≤ 10 KB
  gzipped) is respected by the combined feature. Sharing the scaffold *is*
  the headline efficiency win against that ceiling.
- **Row-compare overlay stays in `010-diff-compare/spec.md`**: this combined
  spec covers only the column-mode appended column from `010`.

## Implementation Streaming

Each user story is shippable independently against the shared scaffold:

1. **Scaffold first** (FR-VC-001..FR-VC-013) lands as a no-op pass through
   that registers no renderers but freezes the registration API and the
   ordering policy.
2. **US1 (cumulative running sum)** and **US2 (sparkline)** can then be
   implemented in parallel by different workers, each plugging into the
   scaffold.
3. **US4 (sparkline tooltip / header highlight)** and **US5 (scaling mode
   toggle)** layer onto US2 without further scaffold work.
4. **US3 (compare-column)** layers onto the row-compare interaction from
   `010-diff-compare`, but is shippable independently as soon as the
   scaffold can host it.
5. **US6 (ordering)** is a property of the scaffold, demonstrated by an
   integration test once any two of the three renderers are present.
6. **US7 (URL persistence)** lands as a single PR covering the combined
   directive shape; before then, each renderer may persist into a
   per-feature subkey for development convenience.
7. **US8 (visible-row pipeline cooperation)** requires the pipeline from
   `002-003-row-visibility` and the scaffold change-event plumbing; it lands
   when both are available.
