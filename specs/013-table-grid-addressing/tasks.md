---
description: "Task list for Canonical Table-Grid Addressing Layer"
---

# Tasks: Canonical Table-Grid Addressing Layer

**Input**: Design documents from `/specs/013-table-grid-addressing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/table-grid-api.md, quickstart.md

**Tests**: INCLUDED. The spec's success criteria (SC-001..SC-008) and the plan's
composition matrix make tests a first-class deliverable; constitution §II
mandates them.

**Branch note**: Developed on the session branch `claude/funny-cannon-ojWpI`
(no separate feature branch), per environment constraint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US4 (user-story phases only)
- Single-project layout: `src/…`, tests in per-folder `__tests__/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the module's import surface and the test harness all
later phases depend on.

- [X] T001 Create `src/core/table-grid.ts` with the marker constants (`SCAFFOLD_ATTR='data-gs-injected'`, `VIRTUAL_COL_ATTR='data-gs-virtual-column'`) and exported, typed function stubs for the full surface in `contracts/table-grid-api.md` (throwing `NotImplemented` bodies) so consumers and tests can import against a stable signature.
- [X] T002 [P] Create test files `src/core/__tests__/table-grid.test.ts` and `src/core/__tests__/table-grid.composition.test.ts` with imports + top-level `describe` blocks (placeholder `it.todo`s).
- [X] T003 [P] Create shared test harness `src/core/__tests__/helpers/grid-fixture.ts`: builders for the canonical numeric grid (row headers + numeric body), a helper to capture each author cell's identity, and activation helpers — `enableRowSlider`, `enableColSlider`, `addCumulativeColumn`, `addSparklineColumn`, `applySort` — plus an `activateInOrder(steps, order)` utility that runs a set of activations in a chosen sequence (for both-permutation testing).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The classification + row/cell/value primitives every user story
builds on. **No user story can begin until this phase is complete.**

- [X] T004 Implement `isScaffold` and `isVirtualColumn` in `src/core/table-grid.ts` (attribute reads only).
- [X] T005 Implement row access `gridRows`, `headerRow`, `bodyRows` in `src/core/table-grid.ts` — exclude scaffold rows, exclude `<tfoot>` rows from the body set, keep dimmed rows; reuse the header-detection rule from `src/utils/original-order.ts::getDataRows` (do not duplicate it — import or mirror its logic with a reference comment). (depends on T004)
- [X] T006 Implement cell views `gridCells`, `sourceCells` and counts `sourceColumnCount`, `gridColumnCount` in `src/core/table-grid.ts` — `gridCells` = non-scaffold cells (source then virtual, DOM order); `sourceCells` = also excludes `data-gs-virtual-column`. (depends on T004)
- [X] T007 Implement `cellValue(cell)` in `src/core/table-grid.ts` — return the cell's text excluding Grid-Sight-injected UI (`.gs-lozenge-cluster`, `[data-gs-slider-readout]`, and other GS-owned descendants), trimmed; identity (`textContent.trim()`) for a clean cell. (Foundational because US1/US3/US4 all read values through it.)
- [X] T008 [P] Unit tests in `src/core/__tests__/table-grid.test.ts` for the foundational primitives: classification, `gridRows`/`headerRow`/`bodyRows` (incl. `<thead>` vs implicit-header, `<tfoot>` exclusion, dimmed-kept), `gridCells`/`sourceCells`/counts (incl. virtual ordering), and `cellValue` purity + identity. Assert INV-1/INV-4/INV-6/INV-8.

**Checkpoint**: Primitives implemented and unit-green; translation + consumers can begin.

---

## Phase 3: User Story 1 - Stable column addressing under structural mutation (Priority: P1) 🎯 MVP

**Goal**: Asking for logical column K always returns the author's K-th column —
every body cell, every row — regardless of slider injection or virtual columns.

**Independent Test**: Build the grid, capture author cells, enable row+col
sliders, assert `columnCells(K)` equals the captured author cells for each
source K and `headerCellFor(K)` is the author header.

### Tests for User Story 1 ⚠️ (write first, ensure they FAIL)

- [X] T009 [P] [US1] Unit tests in `src/core/__tests__/table-grid.test.ts` for `cellAt`, `columnCells`, `headerCellFor`, `logicalColIndexOf`: rowspan safety under a row slider (INV-2), virtual columns addressable after source columns, and out-of-range → `null`/`[]`/`-1` (INV-7). Use the harness from T003.

### Implementation for User Story 1

- [X] T010 [US1] Implement `cellAt`, `columnCells` (rowspan-safe, per-row scaffold filtering), `headerCellFor` (author-colspan rule per research R-6), and `logicalColIndexOf` in `src/core/table-grid.ts`. (depends on Phase 2)
- [X] T011 [US1] Migrate `src/ui/header-utils.ts`: replace its local `nonInjectedRows`/`nonInjectedCells` with imports from `table-grid`; `injectPlusIcons` uses `gridRows`/`gridCells`; `headerColIndex` → `logicalColIndexOf`; `columnHasRowspanBodyCells` and `inferHeaderColumnType` use `columnCells`/`sourceCells` + `cellValue`.
- [X] T012 [P] [US1] Migrate `src/ui/toggle-injector.ts` statistics + frequency **column** sites to the logical index already carried in the event + `columnCells`/`gridCells` + `cellValue` (remove `th.cellIndex` and the ad-hoc per-call injected filters added in the earlier hotfix).
- [X] T013 [P] [US1] Migrate `src/enrichments/sort.ts` comparison reads to `columnCells`/`cellAt` + `cellValue`.
- [X] T014 [P] [US1] Migrate `src/enrichments/filter.ts` and `src/enrichments/filter-helpers.ts` predicate reads to `columnCells`/`cellAt` + `cellValue`.
- [X] T015 [P] [US1] Migrate `src/enrichments/frequency.ts` column extraction to `columnCells` + `cellValue`.
- [X] T016 [P] [US1] Migrate `src/enrichments/heatmap.ts` row lookup (replace `tbody tr:nth-child(index)` in `collectRowCells`) to `bodyRows`/`cellAt`.

**Checkpoint**: Logical column K resolves to the same author cells under `{none, row, col, both}` slider injection; MVP demonstrable.

---

## Phase 4: User Story 2 - Order-independent activation (both permutations) (Priority: P1)

**Goal**: The same end state reached via enrichment-then-slider and
slider-then-enrichment is identical in cell resolution and placement.

**Independent Test**: Run each matrix point under both activation orders and
assert identical results.

### Tests for User Story 2 ⚠️ (write first, ensure they FAIL / drive the work)

- [X] T018 [US2] Composition matrix test in `src/core/__tests__/table-grid.composition.test.ts`: for every point in `{none,row,col,both} × {none,+cumulative,+sparkline} × {unsorted,sorted}`, assert `columnCells(K)` equals the captured author cells for each source K, `headerCellFor(K)` is the author header, and `cellValue` is unpolluted — executed under **both** activation orders via the T003 `activateInOrder` helper. Encodes SC-001/SC-002/SC-003.
- [X] T019 [US2] Placement assertion (extend `src/ui/__tests__/header-utils.slider-placement.test.ts`): statistics/heatmap/sort/filter lozenges sit only on author cells and address the correct column under **both** activation orders.

### Implementation for User Story 2

- [X] T017 [US2] Make `src/enrichments/slider-injection.ts` delegate its `nonInjectedRows`/`nonInjectedCells` to `table-grid` (single source of truth; removes the last copy of the helper).

**Checkpoint**: Both activation orders produce identical resolution and placement (SC-002).

---

## Phase 5: User Story 3 - Stable row identity across sort and filter (Priority: P2)

**Goal**: A row's logical identity is its position in the original author order,
even after sort reorders the DOM; dimmed rows stay addressable.

**Independent Test**: Capture row identities, reverse-sort, assert
`logicalRowIndexOf` unchanged; confirm dimmed rows still enumerated.

### Tests for User Story 3 ⚠️ (write first, ensure they FAIL)

- [X] T020 [P] [US3] Unit tests in `src/core/__tests__/table-grid.test.ts`: `logicalRowIndexOf` invariant under a sort that reverses visual order (INV-5), dimmed (filtered) rows present in `bodyRows` and addressable, and `-1` for a non-body row.

### Implementation for User Story 3

- [X] T021 [US3] Implement `logicalRowIndexOf(table, row)` in `src/core/table-grid.ts` — consult `original-order.ts::getRecord` when present, else index within `bodyRows`. (depends on Phase 2)
- [X] T022 [P] [US3] Migrate `src/ui/toggle-injector.ts` row statistics + row frequency sites (and any remaining `tr.rowIndex` usage) to `bodyRows`/`gridCells`/`logicalRowIndexOf` + `cellValue`.

**Checkpoint**: Row identity stable across sort; dimmed rows addressable.

---

## Phase 6: User Story 4 - Canonical cell value reading (Priority: P2)

**Goal**: Every value-reading consumer gets author data text, never polluted by
injected Grid-Sight UI, regardless of activation order.

**Independent Test**: Inject a lozenge cluster into a header/cell, assert the
consumer reads only the author text; sort/filter/type-detection unaffected.

### Tests for User Story 4 ⚠️ (write first, ensure they FAIL)

- [X] T023 [P] [US4] Tests in `src/core/__tests__/table-grid.test.ts` (+ a targeted case in the composition suite): with lozenge clusters and slider readouts injected, `cellValue` and the migrated readers return unpolluted values for numeric AND categorical columns. Asserts INV-8 broadly across consumers.

### Implementation for User Story 4

- [X] T024 [P] [US4] Migrate `src/core/type-detection.ts` and `src/core/table-detection.ts` cell reads to `sourceCells` + `cellValue`.
- [X] T025 [P] [US4] Migrate `src/enrichments/sparkline-column.ts`, `src/enrichments/compare-column.ts`, and `src/enrichments/cumulative-column.ts` source reads to `columnCells`/`sourceCells` + `cellValue`.
- [X] T026 [P] [US4] Migrate `src/enrichments/slider-threshold.ts` cell reads to `gridCells` + `cellValue`.
- [X] T027 [US4] Verify/migrate `src/enrichments/slider-injection.ts` header/data parsing (`readRawAxisHeaders`, `parseCell`) to read via `cellValue` so axis binding is robust when lozenges are present at slider-activation time (the slider-before/after-buttons permutation).

**Checkpoint**: All value readers immune to injected-UI pollution under any order.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 [P] Grep audit across migrated consumers — confirm no live-DOM physical access (`cellIndex`, `.cells[`, `.rows[`, `tr:nth-child`) remains where the layer should be used (SC-006); document any intentionally-retained internal use inside `table-grid.ts`.
- [X] T029 [P] Optionally delegate `src/utils/view-state-url.ts::colKeyAt` to `headerRow`/`gridCells` from `table-grid` (consolidation; behaviour already correct).
- [X] T030 Run `yarn build` + `node scripts/bundle-size.js` — confirm IIFE within the 10 KB ceiling and net delta ≤ 0.5 KB gzipped, no new runtime dependency (SC-007, constitution §I).
- [X] T031 Run `yarn test` (Vitest unit + Storybook) and `yarn test:e2e` (Playwright) — all green, no regressions (SC-005).
- [X] T032 [P] Run `quickstart.md` validation end-to-end; update `CLAUDE.md`/`README.md` references if the module surface shifted during implementation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**.
- **US1 (Phase 3)**: depends on Foundational. The MVP.
- **US2 (Phase 4)**: depends on US1 (the matrix exercises US1's translation + migrated consumers).
- **US3 (Phase 5)**: depends on Foundational; independent of US1/US2 (touches row identity + row sites).
- **US4 (Phase 6)**: depends on Foundational; `cellValue` exists from Phase 2, so US4 is adoption + edge cases. Independent of US1/US3 except shared file `slider-injection.ts` (sequence T027 after T017).
- **Polish (Phase 7)**: after all targeted stories complete.

### Critical sequencing notes

- T010 before T011–T016 (consumers need the translation funcs).
- T017 (slider-injection delegation) before T027 (same file; keep ordered).
- T012 and T022 both touch `toggle-injector.ts` (column sites vs row sites) — sequence T022 after T012 to avoid edit conflicts even though they target different branches.
- Tests T009/T020/T023 authored before their implementation tasks (TDD per constitution §II).

### Parallel Opportunities

- Setup: T002, T003 in parallel after T001.
- Foundational: T004 first; then T005 and T006 in parallel; T007 in parallel with T005/T006; T008 after.
- US1: after T010, the consumer migrations T012–T016 are different files → parallel; T011 (header-utils) also parallel with them.
- US4: T024, T025, T026 are different files → parallel; T027 sequenced after T017.

---

## Parallel Example: User Story 1

```bash
# After T010 (translation funcs) lands, migrate consumers in parallel:
Task: "T012 Migrate toggle-injector.ts statistics/frequency column sites"
Task: "T013 Migrate sort.ts comparison reads"
Task: "T014 Migrate filter.ts + filter-helpers.ts predicates"
Task: "T015 Migrate frequency.ts column extraction"
Task: "T016 Migrate heatmap.ts row lookup"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational (CRITICAL — blocks everything).
2. Phase 3 US1 → **STOP and VALIDATE**: column K resolves to the same author
   cells under all slider permutations; the originally-reported statistics
   button bug is now fixed *systematically*, not by ad-hoc filtering.
3. This is a shippable increment on its own.

### Incremental Delivery

1. Foundational ready → US1 (MVP, column correctness + both-direction placement via US2 matrix) → US3 (row identity) → US4 (value purity) → Polish.
2. Each story adds an enduring guarantee without breaking the previous.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- The earlier hotfix (commit on this branch) already filters `data-gs-injected`
  in `header-utils.ts`, `toggle-injector.ts`, and `view-state-url.ts`. These
  tasks **generalise** that fix into the shared layer and extend it to virtual
  columns, row identity, and value purity — then remove the now-duplicated
  inline filters. Keep the existing regression test (`header-utils.slider-placement.test.ts`).
- No new DOM, markers, runtime deps, or network. Byte-identical teardown preserved.
