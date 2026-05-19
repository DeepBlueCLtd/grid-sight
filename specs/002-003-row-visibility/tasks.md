# Tasks: Row Visibility & Order (Sort + Filter)

**Input**: Design documents from `/specs/002-003-row-visibility/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓ (`visible-rows-api.md`, `url-fragment-schema.md`), quickstart.md ✓

**Tests**: Tests are **REQUIRED** — Constitution §II (Test Discipline) is a merge gate, and SC-006 explicitly mandates an automated parity check between pipeline output and rendered DOM. Every user story below includes Vitest unit tests, Storybook interaction tests for UI surfaces, and Playwright e2e for the golden flows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Per the plan's "Implementation Streaming" section: the visible-row pipeline lands first as a thin identity-projection scaffold (Phase 2); then sort (US1) and the two filter variants (US2/US3) can proceed in parallel; the compose/chip (US4) and sort-over-filter semantics (US5) close out the combination; URL persistence (US6) ships as a single PR covering both directive shapes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to spec user stories US1–US6
- Every task includes the exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing project scaffolding is ready; no new tooling needed (no new runtime deps, no new build steps).

- [ ] T001 Verify `yarn install` succeeds and `yarn build` passes baseline at repo root (sanity baseline before any feature delta)
- [ ] T002 [P] Record baseline bundle size from `scripts/bundle-size.js` into `specs/002-003-row-visibility/research.md` under R-7 (single sentence, gz number only) so each subsequent PR can be measured against it
- [ ] T003 [P] Add the lozenge glyphs to the shared style sheet at `src/style.css` — `↕` sort lozenge class `gs-lozenge--sort`, `▽` filter lozenge class `gs-lozenge--filter`, plus the `gs-row--dimmed` opacity rule (CSS only; no JS wiring yet)

**Checkpoint**: Baseline build green, lozenge glyphs available, bundle baseline recorded.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the **Visible Row Sequence pipeline as a thin identity-projection scaffold** with the public API frozen. After this phase, US1–US6 can plug in by calling `setSort` / `setFilter` without changing the pipeline shape.

**⚠️ CRITICAL**: No user-story work begins until Phase 2 is complete. The pipeline scaffold MUST land with the contract in `contracts/visible-rows-api.md` frozen — every later phase consumes it.

- [ ] T004 [P] Create the Original Order Record helper at `src/utils/original-order.ts` exporting `captureOnce(table)`, `getRecord(table)`, and `clearRecord(table)` backed by a module-scoped `WeakMap<HTMLTableElement, readonly HTMLTableRowElement[]>` (per data-model.md → OOR)
- [ ] T005 [P] Create the visible-rows pipeline at `src/utils/visible-rows.ts` exporting the surface in `contracts/visible-rows-api.md` (`getVisibleRows`, `onVisibleRowsChange`, `setSort`, `setFilter`, `clearFilters`, `teardown`) plus the `VisibleRowEntry` / `VisibleRowSequence` / `SortDirective` / `FilterPredicate` / `FilterDirective` types — for this task it returns the **identity projection** (no sort, all rows un-dimmed) and the `mergeByOriginalIndex` body is a stub that just returns the visible-rows-in-OOR-order; synchronous emission and `revision` counter MUST be live from day one
- [ ] T006 [US1] [US2] [US3] Extend `src/ui/header-utils.ts` to register two new lozenge slots in `LozengeSpec` (`id: 'sort'` and `id: 'filter'`), wired to no-op handlers for now; this guarantees the lozenge cluster reserves space + a11y order so US1–US3 only need to fill in the click + popup logic
- [ ] T007 [P] Vitest scaffold at `src/utils/__tests__/original-order.test.ts` covering: capture-once semantics, capture survives if `tbody.rows` mutates afterwards, `clearRecord` removes the entry
- [ ] T008 [P] Vitest scaffold at `src/utils/__tests__/visible-rows.test.ts` covering: identity projection on a fresh table, listener fires synchronously on `setSort(null)` is a no-op (no event), `revision` increments monotonically, `getVisibleRows` returns the cached sequence (reference-equal between events), `teardown` is idempotent
- [ ] T009 Update `src/index.ts` to import `teardown` from `src/utils/visible-rows.ts` and call it for every table during the existing `disable()` loop (placed before `removePlusIcons(table)`); also add a Vitest snapshot in `src/__tests__/disable-snapshot.test.ts` that asserts `tbody.innerHTML` byte-identical before init vs after disable on a table that had sort + filter applied (satisfies SC-005 once US1/US2 land — for now the snapshot covers the identity case)

**Checkpoint**: Pipeline scaffold green; identity projection passes; lozenge slots reserved in header-utils; teardown wired into `disable()`. US1/US2/US3 can now proceed in parallel.

---

## Phase 3: User Story 1 — Sort a column ascending / descending / off (Priority: P1) 🎯 MVP

**Goal**: A user clicks the **↕** sort lozenge on any sortable column and gets a three-state asc → desc → original cycle. Only one column drives sort at a time. The sort runs through the pipeline established in Phase 2.

**Independent Test**: Click the sort lozenge on a numeric column three times and verify asc → desc → original. Repeat on a categorical column. `aria-sort` reflects state at every step. Sort completes in < 100 ms on a 1 000-row table (SC-002).

### Tests for User Story 1

- [ ] T010 [P] [US1] Vitest unit test at `src/enrichments/__tests__/sort.test.ts` covering the three-state cycle, single-column-at-a-time invariant (clicking column B while column A is sorted clears A), numeric comparator on `cleanNumericCell` output with `NaN` → end-of-list in both directions, locale-aware categorical comparator via shared `Intl.Collator`, tie stability via Array.sort
- [ ] T011 [P] [US1] Storybook interaction test at `src/ui/__tests__/sort-lozenge.test.ts` (uses `@storybook/addon-vitest`) covering: lozenge renders ↕, `aria-sort="none|ascending|descending"` toggles correctly, accessible name reflects the **next** action ("Sort Amount descending"), keyboard activation via Enter/Space
- [ ] T012 [US1] Playwright e2e at `tests/e2e/sort.spec.ts` exercising the full three-state cycle on the demo page (numeric column then categorical column), asserting render order via `tbody tr` text comparison

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create the sort comparator at `src/enrichments/sort.ts` exporting `makeComparator(column, direction, columnType)` that returns a `(a: HTMLTableRowElement, b: HTMLTableRowElement) => number` using `cleanNumericCell` for numeric columns (NaN → +∞) and a module-level shared `Intl.Collator(undefined, { sensitivity: 'base', numeric: true })` for categorical
- [ ] T014 [P] [US1] Create the sort lozenge button factory at `src/ui/sort-lozenge.ts` exporting `createSortLozenge({ columnIndex, columnKey, columnType, getCurrentSort, onChange })` that returns the `<button>` element, owns the three-state click handler, and updates the column header's `aria-sort` attribute
- [ ] T015 [US1] Wire sort into the pipeline in `src/utils/visible-rows.ts`: replace the Phase-2 stub `mergeByOriginalIndex` with the real implementation per data-model.md (visible rows in sort order, dimmed rows anchor at their OOR positions). When `state.sort` is null, the path remains identity-with-dim-anchors. Also update `aria-sort` on the sort column header inside the same re-evaluation
- [ ] T016 [US1] Register the sort lozenge in `src/ui/header-utils.ts` by replacing the no-op handler from T006 with the real factory from T014, passing `setSort` from `visible-rows.ts` as the `onChange` callback; honour `data-gs-no-sort` and the `rowspan`/`colspan` body-cell suppression rule on the affected column (existing column-type detector + a small new check)
- [ ] T017 [US1] Add the `columnKey` derivation helper at `src/utils/view-state-url.ts` (just `colKey(header, columnIndex)` per `contracts/url-fragment-schema.md` "Column-key derivation"; rest of the codec lands in US6) so sort can populate `SortDirective.columnKey` correctly from day one — this avoids a later refactor when US6 adds persistence

**Checkpoint**: Sort works end-to-end on any sortable column, three-state cycle behaves, `aria-sort` correct, < 100 ms on 1 000 rows, byte-identical disable still holds.

---

## Phase 4: User Story 2 — Filter a numeric column by range (Priority: P1)

**Goal**: Click the **▽** filter lozenge on a numeric column; a popup with Min/Max number inputs appears; out-of-range rows are dimmed (not removed). Popup closes on outside click or Escape; filter state survives the close. Per-popup "Hide empty cells" toggle.

**Independent Test**: Open the numeric filter on a numeric column, set `Min=100, Max=500`, close the popup, observe rows outside the range dimmed via `data-gs-dimmed="true"` + `gs-row--dimmed` class, rows still in DOM, screen reader still announces them.

### Tests for User Story 2

- [ ] T018 [P] [US2] Vitest unit test at `src/enrichments/__tests__/filter.test.ts` (numeric portion) covering the `numericRange({ min, max, hideEmpty })` predicate factory: closed range, open-min, open-max, fully open, hideEmpty true/false on blank cells, `toDirective()` round-trip shape
- [ ] T019 [P] [US2] Storybook interaction test at `src/ui/__tests__/filter-popup-numeric.test.ts` covering: opens on lozenge click, Min/Max inputs accept numbers, "Hide empty cells" checkbox toggles, closes on outside click and on Escape, focus trap inside the popup, focus returns to the lozenge on close, `aria-pressed` on the lozenge reflects predicate-active state
- [ ] T020 [US2] Playwright e2e at `tests/e2e/filter.spec.ts` (numeric scenario only — categorical scenario added in US3) exercising US2 AS-1..AS-4

### Implementation for User Story 2

- [ ] T021 [P] [US2] Create the filter predicate factories at `src/enrichments/filter.ts` exporting `numericRange({ columnIndex, columnKey, min, max, hideEmpty })` returning a `FilterPredicate` whose `test(row)` reads the column cell via `cleanNumericCell` and applies the range with `hideEmpty` semantics, and whose `toDirective()` returns the `kind: 'numeric-range'` shape from data-model.md
- [ ] T022 [P] [US2] Create the numeric filter popup at `src/ui/filter-popup-numeric.ts` exporting `openNumericFilterPopup({ anchorEl, columnIndex, columnKey, current, onApply, onClose })` — owns input rendering, focus-trap, Escape handler, outside-click close, and emits `onApply(predicate | null)` (null clears the filter)
- [ ] T023 [P] [US2] Create the filter lozenge button factory at `src/ui/filter-lozenge.ts` exporting `createFilterLozenge({ columnIndex, columnKey, columnType, getCurrentFilter, onOpenPopup })` — type-aware (it knows whether to open the numeric or categorical popup; categorical wiring lands in US3 but the lozenge factory ships once here) and maintains `aria-pressed`
- [ ] T024 [US2] Register the filter lozenge in `src/ui/header-utils.ts` by replacing the no-op handler from T006 with the real factory from T023; the lozenge dispatches to the numeric popup for `numeric` columns; categorical branch is a no-op stub until US3 (`throw new Error('not yet')` would break US3 in flight, so emit a console.warn and return instead). Honour `data-gs-no-filter` and the `rowspan`/`colspan` suppression rule

**Checkpoint**: Numeric filter works end-to-end; dimming behaves per spec; popup a11y contract honoured; `aria-pressed` correct.

---

## Phase 5: User Story 3 — Filter a categorical column by value list (Priority: P1)

**Goal**: The filter lozenge on a categorical column opens a popup with a count-labelled checkbox list, "Select all" / "Select none", and a type-to-search input. Per-popup "Hide empty cells" toggle.

**Independent Test**: Open the categorical filter on a categorical column, type to narrow the visible checkbox list, uncheck two values, close the popup, observe rows whose cell value is in the unchecked set are dimmed.

### Tests for User Story 3

- [ ] T025 [P] [US3] Vitest unit test at `src/enrichments/__tests__/filter.test.ts` (extend the file from T018 — add a `describe('categorical')` block) covering `categoricalInclusion({ allowed: Set<string>, hideEmpty })` predicate, `toDirective()` `kind: 'categorical'` shape, empty-string membership ruled by `hideEmpty`
- [ ] T026 [P] [US3] Storybook interaction test at `src/ui/__tests__/filter-popup-categorical.test.ts` covering: checkbox list renders with per-value counts, search input narrows the visible list only (does NOT modify the predicate until apply), Select all / Select none affordances, focus trap + Escape close, focus return, `aria-pressed` on lozenge
- [ ] T027 [US3] Extend the Playwright e2e at `tests/e2e/filter.spec.ts` with a categorical scenario (US3 AS-1..AS-3) — same file as T020 since they share the spec but exercise different popups

### Implementation for User Story 3

- [ ] T028 [P] [US3] Extend `src/enrichments/filter.ts` with the `categoricalInclusion({ columnIndex, columnKey, allowed, hideEmpty })` factory returning a `FilterPredicate` whose `test(row)` reads the column cell's `textContent.trim()` and checks Set membership; provide a helper `collectCategoricalValues(table, columnIndex): Map<string, number>` (value → count) used by the popup
- [ ] T029 [P] [US3] Create the categorical filter popup at `src/ui/filter-popup-categorical.ts` exporting `openCategoricalFilterPopup({ anchorEl, columnIndex, columnKey, current, valueCounts, onApply, onClose })` — count-labelled checkbox list, type-to-search input, Select-all / Select-none buttons, focus-trap, Escape + outside-click close
- [ ] T030 [US3] Replace the categorical-branch console.warn stub from T024 in `src/ui/header-utils.ts` (or `src/ui/filter-lozenge.ts`, wherever the dispatch lives after T023) with the real `openCategoricalFilterPopup` call

**Checkpoint**: Both filter variants work end-to-end. AND-composition across columns works for free because the pipeline holds a `Map<columnIndex, FilterPredicate>` from Phase 2.

---

## Phase 6: User Story 4 — Compose filters across columns + clear-all chip (Priority: P2)

**Goal**: Multi-column filters compose with logical AND (already supported by the pipeline from Phase 2). A summary chip lists every active filter as `Column: predicate` with a **Clear all filters** button. Zero-match filter shows an empty-state message.

**Independent Test**: Apply a numeric filter on column A and a categorical filter on column B → only rows passing BOTH are un-dimmed. Chip lists both filters; clicking each filter's "×" clears that one; Clear-all clears all and removes the chip. Apply a filter that matches zero rows → empty-state message appears (still in same DOM, not replacing tbody).

### Tests for User Story 4

- [ ] T031 [P] [US4] Vitest unit test at `src/utils/__tests__/visible-rows.test.ts` (extend) covering AND composition across two predicates: row dimmed if any predicate returns false; clearing one predicate restores rows that only that predicate dimmed
- [ ] T032 [P] [US4] Storybook interaction test at `src/ui/__tests__/filter-chip.test.ts` covering: chip renders with one entry per active filter, per-filter remove button restores that column's rows, "Clear all filters" button removes every filter and the chip itself, chip is keyboard-reachable (Tab order), empty-state message renders when `entries.every(e => e.dimmed)`
- [ ] T033 [US4] Playwright e2e at `tests/e2e/filter.spec.ts` (extend) with: apply two filters → chip lists both; remove via chip; click Clear all; zero-match empty-state

### Implementation for User Story 4

- [ ] T034 [US4] Create the filter chip at `src/enrichments/filter-chip.ts` exporting `mountFilterChip(table)` / `unmountFilterChip(table)` — subscribes to `onVisibleRowsChange`, renders a chip element listing each entry from `seq.filters` as `Column: predicate-summary` with a per-filter remove button, plus a "Clear all filters" button that calls `clearFilters(table)`; the chip element is appended **after** the table inside a `gs-filter-chip-container` div; when `seq.filters.size === 0` the chip is removed
- [ ] T035 [US4] Add the zero-match empty-state inside `mountFilterChip` (same file as T034): when `seq.entries.every(e => e.dimmed)` and at least one filter is active, render a "No rows match the current filters." message in the chip container; remove on the next emission that has any un-dimmed row
- [ ] T036 [US4] Wire `mountFilterChip` into `processTable` in `src/core/table-processor.ts` (or, if that file is too downstream, into `src/index.ts` `processTable`) so every Grid-Sight-enabled table gets a chip subscription; `unmountFilterChip` is called from the pipeline's `teardown(table)` (T005) — add the call there now

**Checkpoint**: Multi-filter AND composition + chip + empty state behave per spec. US1, US2, US3, US4 all green together.

---

## Phase 7: User Story 5 — Sort over a filtered view (Priority: P2, new combination semantics)

**Goal**: With a filter active and a sort then applied, the sort orders only the un-dimmed rows; dimmed rows remain anchored at their original positions (per `mergeByOriginalIndex` rule in data-model.md). Clearing the filter shows all rows in sort order. Clearing the sort restores original document order **within** the un-dimmed set; the filter dimming is unchanged.

**Independent Test**: Apply a numeric filter that dims half the rows, then sort the same column descending. Verify: (a) dimmed rows do not move into the un-dimmed block, (b) the un-dimmed rows are in descending order, (c) clearing the filter shows every row in descending order with no extra click, (d) clearing the sort but keeping the filter restores original document order within the un-dimmed set.

> **Note**: The `mergeByOriginalIndex` algorithm itself was implemented in T015 as part of US1. This phase **verifies** that implementation against the US5 acceptance scenarios and adds the explicit coverage. If T015's algorithm is wrong, this phase fixes it.

### Tests for User Story 5

- [ ] T037 [P] [US5] Vitest unit test at `src/utils/__tests__/visible-rows.test.ts` (extend) covering US5 AS-1..AS-3: filter then sort → dimmed rows at original positions, visible rows descending; sort then clear filter → all rows descending; sort + filter both active → clearing sort restores original order within un-dimmed block while dim flags are unchanged
- [ ] T038 [P] [US5] Storybook interaction test at `src/utils/__tests__/visible-rows-parity.test.ts` for SC-006: after every combination of sort + filter changes on a fixture table, assert `getVisibleRows(table).entries` matches `Array.from(table.tBodies[0].rows)` 1:1 in both order and `dimmed` flag (parity between pipeline output and rendered DOM)
- [ ] T039 [US5] Playwright e2e at `tests/e2e/sort-over-filter.spec.ts` exercising the full US5 golden flow on the demo page (filter Amount 100–500, then sort Amount desc, then clear filter, then clear sort with filter re-applied)

### Implementation for User Story 5

- [ ] T040 [US5] Verify and, if needed, fix the `mergeByOriginalIndex` body in `src/utils/visible-rows.ts` against US5 AS-1 — specifically the "dimmed rows act as anchors; visible rows slot in between them in sort order" rule from data-model.md. The implementation from T015 should already do this; this task is the formal check + any micro-fix the unit test from T037 surfaces
- [ ] T041 [US5] Add the "Restore order" rule from spec Edge Cases: when both sort and filter are toggled off, the pipeline restores `tbody` to the OOR exactly. Confirm by extending the Vitest test at `src/utils/__tests__/visible-rows.test.ts` (no new file needed) with a "both off → tbody.innerHTML byte-equal to pre-init" assertion

**Checkpoint**: SC-006 parity check passes. US5 golden flow green in Playwright. The four MVP user stories (US1–US4) + US5 combination semantics all work.

---

## Phase 8: User Story 6 — Persist and share the combined view via URL (Priority: P2)

**Goal**: Both sort and filter state are encoded under one URL-fragment namespace (`gs.v`) per page, restored before content settles, and reproduce 100% on another machine with no `localStorage` dependency. Missing-target directives are silently dropped. Filters applied before sort on load (FR-VP-007).

**Independent Test**: Apply sort + multi-column filter to a table, copy the URL, open in a fresh browser profile → identical view with no visible flash beyond one animation frame. Hand-edit the URL to reference a non-existent column → page loads with surviving directives applied; missing one silently dropped.

### Tests for User Story 6

- [ ] T042 [P] [US6] Vitest unit test at `src/utils/__tests__/view-state-url.test.ts` covering the full codec round-trip per `contracts/url-fragment-schema.md`: encode → decode → equal for every worked example, lenient decode of malformed directives (returns the rest), missing-column drop, empty-state codec yields no parameter, `gs.s` and `gs.v` coexist without clobbering each other
- [ ] T043 [P] [US6] Vitest unit test at `src/utils/__tests__/view-state-url.test.ts` (same file, separate describe) covering load-order: parser applies filters before sort, so a sort-over-filter URL round-trips identically through the live pipeline
- [ ] T044 [US6] Playwright e2e at `tests/e2e/view-state-url.spec.ts` covering SC-003 + SC-004: open page → apply sort + filter → copy URL → open in a fresh context (Playwright `browser.newContext()`) → assert (i) identical visible-rows entries, (ii) no flash (the first paint already reflects the restored state, measured via screenshot diff against the post-paint frame)

### Implementation for User Story 6

- [ ] T045 [P] [US6] Implement the full codec at `src/utils/view-state-url.ts` per `contracts/url-fragment-schema.md`: `encodeViewState(perTable)` → fragment payload, `decodeViewState(rawHash)` → `{ tableId, sort?, filters: FilterDirective[] }[]`, plus the `gs.v` fragment-parameter read/write helpers that preserve other parameters (mirrors the `slider-persistence.ts` write-other-preserved approach but does NOT share code). T017 already added the `colKey` helper here; extend, don't replace
- [ ] T046 [US6] Add a serialise / hydrate pair on the visible-rows pipeline at `src/utils/visible-rows.ts`: `serialiseTable(table): TableViewDirective | null` (reads current state to a directive) and `hydrateTable(table, directive)` (applies filters then sort in that order per FR-VP-007 by calling the existing `setFilter` / `setSort` paths) — these are the codec's only contact points with the pipeline
- [ ] T047 [US6] Wire URL restore into `src/index.ts` `init()`: read `location.hash` synchronously, parse via `decodeViewState`, for each entry whose table exists call `hydrateTable(table, entry)` **before** the lozenge cluster mounts (so the first paint reflects the restored projection — satisfies SC-003)
- [ ] T048 [US6] Wire URL save: subscribe in `src/index.ts` (or a small new module `src/utils/view-state-url-sync.ts` if `index.ts` grows uncomfortable) to `onVisibleRowsChange` for every processed table; on every emission, recompute the combined `gs.v` payload across all tables via `encodeViewState` and `history.replaceState` to update `location.hash` without polluting browser history (mirrors `slider-persistence.ts` `replaceState` pattern)
- [ ] T049 [US6] Implement the "missing target silently dropped" rule inside `hydrateTable`: if a directive references a column key that does not slug to any current column header, the predicate / sort is dropped, the rest is applied, and no exception is thrown (matches the spec's US6 acceptance + FR-VP-006 prose)

**Checkpoint**: Full feature complete. URL round-trip works across browser profiles. SC-001..SC-006 all measurable and passing.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verify constitution gates, finalise docs, measure bundle delta against the R-7 budget.

- [ ] T050 [P] Run `yarn build` and verify `scripts/bundle-size.js` reports a delta of **≤ 2.0 KB gzipped** vs the baseline recorded in T002. If breached, file a budget note in `tasks.md` and either trim or escalate per Constitution §I
- [ ] T051 [P] Accessibility audit: run the Storybook a11y addon over every new story (sort lozenge, both filter popups, chip) and fix any violation. Cross-check the four Constitution §III hard minimums (keyboard-operable, ARIA roles/names/states, non-colour cue, AT announcement of dimmed rows)
- [ ] T052 [P] Update `README.md` if the public surface changes (per the contract, no new `window.gridSight.*` is exposed in v1 — but mention sort + filter in the feature list)
- [ ] T053 Run `yarn test` (Vitest unit + Storybook) and `yarn test:e2e` (Playwright) — both green is the merge gate per Constitution §II
- [ ] T054 Run the quickstart manual smoke test from `specs/002-003-row-visibility/quickstart.md` "Manual smoke test" section end-to-end on a built demo page and confirm each of the five steps behaves as described
- [ ] T055 Verify SC-002 (1 000-row sort+filter < 100 ms on a mid-range laptop) by running the Playwright e2e on a generated 1 000-row fixture and asserting the time from click to settled DOM is < 100 ms; add the fixture under `tests/e2e/fixtures/thousand-rows.html` and the perf assertion as part of `tests/e2e/sort-over-filter.spec.ts` (extension, not a new file)

**Checkpoint**: Feature ready to merge. All SCs covered.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: No deps; run immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. **BLOCKS all user stories.** The pipeline scaffold + lozenge slots + OOR helper must land first.
- **Phase 3 (US1 — Sort)**: Depends on Phase 2.
- **Phase 4 (US2 — Numeric Filter)**: Depends on Phase 2. **Independent of US1** (different files, different lozenge).
- **Phase 5 (US3 — Categorical Filter)**: Depends on Phase 4 (T023 ships the shared filter lozenge factory). Could be parallelised by splitting T023, but cleaner to land US2 first.
- **Phase 6 (US4 — Chip + Compose)**: Depends on Phase 4 (needs at least one filter to exist for the chip to be meaningful). US3 also recommended before US4 so the chip is exercised against both predicate kinds.
- **Phase 7 (US5 — Sort over Filter)**: Depends on Phase 3 (US1) AND Phase 4 (US2). The `mergeByOriginalIndex` algorithm landed in T015 (US1); this phase verifies it works once filter is real.
- **Phase 8 (US6 — URL persistence)**: Depends on Phase 3, 4, 5, 6 (needs sort + both filter variants + chip to round-trip). Can begin in parallel with Phase 7 since their files don't overlap.
- **Phase 9 (Polish)**: Depends on all user stories landed.

### User-story dependencies

- **US1 (P1, sort)**: Foundation only.
- **US2 (P1, numeric filter)**: Foundation only.
- **US3 (P1, categorical filter)**: US2 (shared lozenge factory).
- **US4 (P2, chip + compose)**: US2 + US3 (chip exercises both).
- **US5 (P2, sort-over-filter)**: US1 + US2.
- **US6 (P2, URL persistence)**: US1 + US2 + US3 + US4 (encodes all of them).

### Within each story

- Tests are written **before** implementation per Constitution §II (the gate is "tests green at merge", but the project's TDD-leaning style writes them first).
- Pipeline-shape changes land in `visible-rows.ts` only via the writers (`sort.ts`, `filter.ts`); UI lives in `src/ui/`.
- Wire-up to `header-utils.ts` is the **last step** in each story so partial work never injects a half-working lozenge.

### Parallel opportunities

- **Setup**: T002 and T003 are independent of T001.
- **Foundation**: T004, T005, T007, T008 can all run in parallel (different files); T006 follows T005; T009 follows T005.
- **Within US1**: T010, T011, T013, T014 are all parallel (different files). T015 / T016 / T017 are sequential against the pipeline.
- **Within US2**: T018, T019, T021, T022, T023 are parallel; T024 is the final wire-up.
- **Across stories**: Once Foundation lands, US1 + US2 can be developed by two workers concurrently (no shared file, only `header-utils.ts` which uses guarded slot registration from T006).

---

## Parallel example: User Story 1 (Sort)

```bash
# Tests-first batch (all parallel — different files):
Task: "Vitest unit test for sort comparator + three-state cycle in src/enrichments/__tests__/sort.test.ts"
Task: "Storybook interaction test for sort lozenge in src/ui/__tests__/sort-lozenge.test.ts"

# Implementation batch 1 (all parallel — different files):
Task: "Sort comparator in src/enrichments/sort.ts"
Task: "Sort lozenge factory in src/ui/sort-lozenge.ts"
Task: "colKey helper in src/utils/view-state-url.ts"

# Sequential tail:
Task: "Wire sort into pipeline (mergeByOriginalIndex) in src/utils/visible-rows.ts"
Task: "Register sort lozenge in src/ui/header-utils.ts"
Task: "Playwright e2e in tests/e2e/sort.spec.ts"
```

---

## Implementation Strategy

### MVP first — US1 only

1. Phase 1 (Setup) → baseline green.
2. Phase 2 (Foundational pipeline + OOR + lozenge slots).
3. Phase 3 (US1 — Sort).
4. **STOP and VALIDATE**: ship a demo page that sorts; constitution gates green.

### Incremental delivery

1. Foundation + US1 → MVP (sort works).
2. Add US2 → numeric filter works.
3. Add US3 → categorical filter works.
4. Add US4 → compose + chip; SC-001 measurable in three interactions.
5. Add US5 → sort-over-filter; SC-006 parity check passes.
6. Add US6 → shareable URL; SC-003 + SC-004 pass.
7. Polish → SC-002 perf budget, SC-005 byte-identical, bundle ≤ 2 KB delta.

### Parallel-team strategy

Once Phase 2 lands:

- Worker A: US1 (sort) end-to-end.
- Worker B: US2 (numeric filter) end-to-end.
- Worker C: US3 (categorical filter) — starts after Worker B lands T023, otherwise rebases.
- Worker D: US6 (URL codec) — can begin alongside US2/3 because the codec is unit-testable against fabricated directives; integration with `init()` waits for US1+US4.

---

## Notes

- `[P]` tasks operate on different files with no incomplete-task dependencies; safe to dispatch in parallel.
- Every story's wire-up to `header-utils.ts` is the final step in that story; this keeps partial work from injecting a half-working lozenge.
- The contract in `contracts/visible-rows-api.md` is frozen as of Phase 2 — later phases extend behaviour but MUST NOT change exported shapes (Development-Phase Posture grants escape hatches but the bar is "PR that updates every downstream consumer in the same commit").
- Commit cadence: at the very least, one commit per phase checkpoint. Within a phase, batch related parallel tasks into a single commit where convenient.
- Tests run in CI on every PR; merging without `yarn test` and `yarn test:e2e` green is a Constitution §II violation.
- Bundle-size measurement runs on every PR via `scripts/bundle-size.js`; the R-7 budget is ≤ 2.0 KB gzipped net delta.
