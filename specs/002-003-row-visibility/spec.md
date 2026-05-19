# Feature Specification: Row Visibility & Order (Sort + Filter)

**Feature Branch**: `002-003-row-visibility`
**Created**: 2026-05-19
**Status**: Draft
**Supersedes (planning only, not history)**:
  [`specs/002-sort/spec.md`](../002-sort/spec.md),
  [`specs/003-filter/spec.md`](../003-filter/spec.md)
**Input**: Combine the two column-header lozenges that *together* determine
the table's visible-row projection: sort (the order rows are shown in) and
filter (which rows are visible). Both write URL-fragment state with the same
per-URL-stem scheme as `src/utils/slider-persistence.ts`. Downstream features
(`005-sparkline`, `008-cumulative-column`, `009-copy-as-csv`,
`010-diff-compare`) read this projection rather than the raw DOM order, so a
single shared "visible rows" pipeline is the natural unit of work.

## Why combine

- **Shared contract**: both features answer the same question — *"in what order,
  and of which rows, do downstream enrichments see the table?"* That contract
  belongs in one module (`utils/visible-rows.ts`), built once.
- **Shared infrastructure**: column-header lozenge slot, qualifier rules
  (`data-gs-ignore`, `rowspan` exclusions), URL persistence shape, restore-on-
  toggle-off semantics, "directive for missing column → silently dropped"
  handling, and the lozenge keyboard contract from `ui/header-utils.ts`.
- **Shared SC envelope**: both features quote the same numbers — 1 000-row tables
  re-evaluate in under 100 ms, restore within one animation frame, no
  `localStorage` dependency, byte-identical DOM on toggle-off.
- **The two interact directly**: a sort over a filtered view, and the
  cumulative/sparkline/copy/compare features that read "visible rows", all
  require a single composed pipeline rather than two independent ones with a
  resolution layer bolted on later.

The two features ship as separate priorities (each is independently valuable),
but they are designed against one data model and one persistence schema.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sort a column ascending / descending / off (Priority: P1)

[Carried over from `002-sort` US1.] A user clicks a sort lozenge (**↕**) on a
column header. The first click sorts ascending; the second descending; the
third restores the original document order. Only one column drives sort at a
time.

**Independent Test**: Click the sort lozenge on a numeric column three times
and verify asc → desc → original. Repeat on a categorical column.

**Acceptance Scenarios**: see `002-sort/spec.md` US1 AS1–AS4 (unchanged).

---

### User Story 2 - Filter a numeric column by range (Priority: P1)

[Carried over from `003-filter` US1.] A filter lozenge (**▽**) on a numeric
column header opens a popup with **Min** / **Max** number inputs. Out-of-range
rows are *dimmed* (not removed). Popup closes on outside click or `Escape`;
filter state survives the close.

**Acceptance Scenarios**: see `003-filter/spec.md` US1 AS1–AS4 (unchanged).

---

### User Story 3 - Filter a categorical column by value list (Priority: P1)

[Carried over from `003-filter` US2.] The filter lozenge on a categorical
column opens a popup with a count-labelled checkbox list, "select all" /
"select none", and a type-to-search input.

**Acceptance Scenarios**: see `003-filter/spec.md` US2 AS1–AS3 (unchanged).

---

### User Story 4 - Compose filters across columns, plus a clear-all chip (Priority: P2)

[Carried over from `003-filter` US3.] Multi-column filters compose with logical
AND. A summary chip lists every active filter as `Column: predicate` with a
**Clear all filters** affordance.

**Acceptance Scenarios**: see `003-filter/spec.md` US3 AS1–AS3 (unchanged).

---

### User Story 5 - Sort over a filtered view (Priority: P2, **new in the combined spec**)

The user filters "Amount" to `100–500` and then sorts the table by "Amount"
descending. The sort applies only to the rows that pass the filter — dimmed
rows do not move into the sorted block. Toggling the filter off restores the
sort's effect over the full row set in the same direction. Toggling the sort
off restores the original document order *within the still-filtered view*.

**Why this priority**: Combining sort and filter is the dominant real-world
workflow ("show me orders over $100, biggest first"). Without explicit rules
for the composition, downstream features (cumulative running totals, sparkline
shared scale, copy-as-CSV "current view") would each have to invent their own
answer.

**Independent Test**: Apply a numeric range filter that dims half the rows.
Then sort the same column descending. Verify (a) dimmed rows do not move into
the un-dimmed block, (b) the un-dimmed rows are in descending order, (c)
clearing the filter shows every row in descending order with no extra click,
and (d) clearing the sort but keeping the filter restores original document
order within the un-dimmed set.

**Acceptance Scenarios**:

1. **Given** a filter dims rows `[1, 3]` and a sort is then applied descending
   on the same column, **When** the sort completes, **Then** rows `[2, 4, 5]`
   appear in descending order at the top of `tbody` and rows `[1, 3]` remain
   dimmed in their original positions relative to each other.
2. **Given** sort is active and a filter is then cleared, **When** the page
   re-renders, **Then** every row appears in the sort's direction with no
   user re-interaction.
3. **Given** sort and filter are both active, **When** the user clicks the
   sort lozenge to return it to idle, **Then** the un-dimmed rows return to
   original document order; the filter dimming is unchanged.

---

### User Story 6 - Persist and share the combined view via URL (Priority: P2)

[Carries `002-sort` US2 and `003-filter` US4 together.] Both sort and filter
state are encoded under one URL-fragment namespace per page, restored before
content settles, and reproduce 100% on another machine with no `localStorage`
dependency. Directives referring to missing tables, missing columns, or
no-longer-present categorical values are silently dropped; surviving
directives still apply.

**Acceptance Scenarios**: union of `002-sort` US2 AS1–AS2 and `003-filter` US4
AS1–AS2 (unchanged).

---

### Edge Cases (union of source specs, plus new combinations)

Carried verbatim from the source specs:

- Non-monotonic mixed types in a sort column (`002` Edge Cases).
- Blank / missing cells under sort and filter (`002`, `003` Edge Cases).
- Tied sort values (stable sort) (`002` Edge Cases).
- Multi-section tables — only `tbody` reordered (`002` Edge Cases).
- `rowspan` / `colspan` on body cells — both lozenges suppressed
  (`002`, `003` Edge Cases).
- Categorical column with many distinct values (`003` Edge Cases).
- Empty-cells default policy and per-popup "Hide empty cells" toggle
  (`003` Edge Cases).
- Zero-match filter empty-state message (`003` Edge Cases).
- Opt-out attributes: `data-gs-ignore`, `data-gs-no-sort`, `data-gs-no-filter`.
- Toggling Grid-Sight off restores original order and full opacity; URL state
  remains so toggling back on re-applies both (`002`, `003` Edge Cases).

New / clarified combination cases:

- **Sort interaction with active filter**: Sort operates on the visible
  (un-dimmed) row block only. Dimmed rows remain in their original-document
  position within the body and are never lifted into the visible block by a
  sort. (Resolves a question both source specs left implicit.)
- **Filter empty-state during sort**: When sort is active and a filter then
  matches zero rows, the empty-state message from `003` US3 takes precedence
  over the sort indicator (the sort is still in effect, but no rows are
  visible to demonstrate it).
- **Restore order**: "Original document order" is captured **once**, at first
  enrichment activation per table, before any sort or filter has been applied.
  Subsequent toggle-off / toggle-on cycles restore against that snapshot.

## Requirements *(mandatory)*

### Functional Requirements

The combined requirements set is the union of `002-sort` FR-001..FR-016 and
`003-filter` FR-001..FR-026, *with the following additions and reconciliations*:

**Visible-row pipeline (new)**

- **FR-VP-001**: Grid-Sight MUST maintain, per table, a derived **Visible Row
  Sequence**: the ordered list of `tbody` rows after applying (a) the active
  filter set (dimming, not removal) and (b) the active single-column sort.
- **FR-VP-002**: The Visible Row Sequence MUST be exposed via a stable internal
  API (`utils/visible-rows.ts`) returning `{ row: HTMLTableRowElement,
  dimmed: boolean, sourceIndex: number }[]`. This API is the *only* way
  downstream enrichments (sparkline, cumulative-column, copy-as-CSV,
  diff-compare) MAY read row order or visibility.
- **FR-VP-003**: The pipeline MUST emit a synchronous change event whenever
  its output changes, so downstream enrichments re-render within one
  animation frame (carries `008` SC-005).
- **FR-VP-004**: Sort operates only on rows where `dimmed = false`; dimmed
  rows retain their `sourceIndex` position and are never re-ordered by sort.
- **FR-VP-005**: The Original Order Record (from `002` Key Entities) MUST be
  captured the first time either sort or filter activates on a table, not the
  first time sort activates alone.

**URL persistence shape (reconciled)**

- **FR-VP-006**: Sort and filter share a single per-page URL-fragment
  namespace. Each table gets one directive object with optional `sort` and
  `filters` fields, e.g.
  `{ table: "<id>", sort?: { column, dir }, filters?: [...] }`.
- **FR-VP-007**: A URL directive's `sort` block MUST be applied *after* its
  `filters` block, mirroring the runtime order, so a sort-of-filtered-view is
  reproduced identically on load.
- **FR-VP-008**: Restoration MUST complete before the user sees content settle
  (one animation frame after first paint — combined SC).

**Carried from the source specs (unchanged numbering may be renormalised at
plan time)**

- Sort affordance and behaviour: `002-sort/spec.md` FR-001..FR-009, plus
  FR-013..FR-016. Re-clarified per FR-VP-004 to operate on the un-dimmed
  block.
- Filter affordance, numeric / categorical popups, composition, chip, empty
  state: `003-filter/spec.md` FR-001..FR-016.
- Filter persistence (numeric bounds, ticked values, "Hide empty" choice):
  `003-filter/spec.md` FR-017..FR-019, subsumed by FR-VP-006.
- Sort persistence (per-page, missing-column drop): `002-sort/spec.md`
  FR-010..FR-012, subsumed by FR-VP-006.
- Accessibility: `002-sort` FR-013/FR-014 (`aria-sort`, next-action accessible
  name) and `003-filter` FR-020..FR-023 (`aria-pressed`, focus-trap, chip
  reachable, dimmed rows remain announced) apply in full.
- Integration / opt-outs: `002-sort` FR-015/FR-016 and `003-filter`
  FR-024..FR-026.

### Key Entities

- **Sort Directive** (from `002`): `(table, column, direction ∈ {asc, desc})`
  with at most one per table.
- **Filter Predicate** (from `003`): numeric range or categorical inclusion
  set per `(table, column)`.
- **Active Filter Set** (from `003`): all predicates on a table, composed with
  AND.
- **Visible Row Sequence** (new, shared): the ordered, dim-flagged projection
  of `tbody` rows. Output of the pipeline; input to every downstream feature.
- **Original Order Record** (reconciled): one snapshot per table, captured at
  first activation of either sort or filter.
- **Persisted View State** (new): single per-page URL serialisation containing
  both sort and filter directives.

## Success Criteria *(mandatory)*

The combined feature inherits every measurable outcome from both source specs.
Where the two specs quoted equivalent numbers, the combined number is the
*max* (i.e. the budget covers the combined re-evaluation).

- **SC-001**: A user can sort a column in **two clicks or fewer**, and apply
  a numeric range filter in **three interactions or fewer**, from a
  Grid-Sight-enabled page. (Union of `002` SC-001, `003` SC-001.)
- **SC-002**: For tables up to 1 000 rows, a sort *or* filter change *or* a
  combined re-evaluation (filter then sort) MUST update the visible row order
  in **under 100 ms** on a mid-range laptop.
- **SC-003**: Re-opening a URL containing any combination of sort and filter
  directives MUST restore the view with no visible flash beyond **one
  animation frame** after first paint.
- **SC-004**: A shared URL MUST reproduce on another machine **100% of the
  time** with no `localStorage` dependency.
- **SC-005**: Toggling Grid-Sight off MUST restore the table to a
  **byte-identical DOM** to the pre-enrichment state (excluding GS-injected
  nodes anywhere on the page).
- **SC-006 (new)**: With sort and filter both active, downstream consumers
  reading via `utils/visible-rows.ts` MUST see the exact same row order and
  dim-flag set as the rendered DOM, verified by an automated parity check in
  the test suite.

## Assumptions

Union of source specs, with the following additions:

- **Pipeline ordering is filter-then-sort, always**. There is no user-exposed
  knob to invert this.
- **Dim, not hide**, as in `003`. Sort never lifts dimmed rows into the
  visible block.
- **Single-column sort** in v1 (`002`). Multi-key sort and per-column custom
  comparators remain out of scope.
- **AND-only composition** across filters (`003`). Per-column OR within a
  categorical checkbox list is the only OR semantics.
- **No new runtime dependency**. Comparison uses platform `Array.prototype.sort`
  and `Intl.Collator`; filtering uses platform `Number`, `String.prototype.trim`,
  and `Intl.Collator` where needed.
- **One URL-fragment namespace per table**, holding both sort and filter under
  a single directive object (FR-VP-006). The exact key shape is finalised
  during `/speckit-plan`.

## Implementation Streaming

Even though the two features ship as separate priorities, both are designed
against this single spec so that:

- The visible-row pipeline lands first as a thin scaffold returning the
  identity projection (no sort, no filter), with the public API frozen.
- US1 (sort) and US2/US3 (filter) can then be implemented in parallel by
  different workers, each plugging into the pipeline.
- US4 (filter chip / compose) and US5 (sort-over-filter) close out the
  combination semantics.
- US6 (URL persistence) lands as a single PR covering both directive shapes.
