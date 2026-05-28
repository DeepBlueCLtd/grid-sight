---
description: "Task list for Outlier Marker Enrichment (spec 004)"
---

# Tasks: Outlier Marker Enrichment

**Input**: Design documents from `/specs/004-outlier/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED. Constitution Principle II (Test Discipline) makes automated
tests a merge gate, and the spec ships explicit acceptance scenarios + independent
tests. Each user story carries Vitest unit and Playwright e2e tasks.

**Organization**: Tasks are grouped by user story so each can be implemented and
tested independently. The binding ship checklist is `docs/adding-an-enrichment.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 (maps to spec.md user stories); Setup/Foundational/Polish carry no story label
- Exact file paths are in every task

## Path Conventions

Single project, existing layout: `src/{core,ui,enrichments,utils}`, unit tests under
`src/**/__tests__/`, e2e under `tests/e2e/`, stories under `src/stories/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Assets shared by multiple stories; no behaviour yet.

- [ ] T001 [P] Create `src/enrichments/outlier-styles.ts` — an injected-CSS module (mirroring `src/enrichments/slider-styles.ts`) defining the two-channel marker (`.gs-outlier-cell`: coloured ring/outline **and** a distinct border-style), the per-cell tooltip element, the list-popup row-highlight class, and popup chrome classes. Export an idempotent `ensureOutlierStyles()` injector and a remover for teardown. (FR-006)
- [ ] T002 [P] Add demo + story fixtures: extend one page under `demo/` and add a table to `src/stories/tables/` containing a numeric column with one clear 2σ/3σ outlier and several at ~1σ, plus a σ=0 (all-equal) column and a <3-numeric column, for manual/e2e/Storybook use.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared compute layer and pure logic every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 [P] Create `src/core/column-statistics.ts` per [contracts/outlier-enrichment-api.md](./contracts/outlier-enrichment-api.md) §1: `columnNumericValues(table, colIndex, {excludeDimmed})` (reads via `columnCells`+`cellValue` from `table-grid.ts`, parses via `cleanNumericCell`, excludes non-numeric and—when `excludeDimmed`—rows with `entry.state==='dimmed'` from `getVisibleRows`), `populationStdDev(values, mean?)` (÷ n), and `computeColumnStatistics` returning `{mean, stdDev, numericCount}`; empty set → `numericCount:0`, never throws. (FR-008, research R-1)
- [ ] T004 [P] Unit tests `src/enrichments/__tests__/column-statistics.test.ts`: population σ matches hand-computed values; `excludeDimmed` drops dimmed rows; non-numeric excluded; empty/empty-after-filter → `numericCount:0` without throwing.
- [ ] T005 Migrate `src/enrichments/statistics.ts` to derive `mean` and `stdDev` from `computeColumnStatistics`/`populationStdDev` (population σ; drop the `simple-statistics.standardDeviation` σ path); update `statistics`-related tests to expect population σ; add a contract assertion that the popup value and an outlier tooltip value derive from one call. (FR-024, SC-006; depends on T003)
- [ ] T006 [P] Create `src/enrichments/outlier-marks.ts` per contracts §2: define `OutlierThreshold` (`1|2|3`) and `OutlierMark` types (owned here, re-exported by `outlier.ts`); `nextThreshold` (idle→2→1→3→idle), `computeMarks(cells, stats, threshold)` (strict `|v−mean| > Nσ`; σ=0 → `[]`), `sortMarksByDistance` (desc |σ|, doc-order ties), `formatOutlierTooltip` (`"value 135, mean 100.0, +3.5σ"`). Pure, DOM-free. (FR-003, FR-005, FR-009, FR-012)
- [ ] T007 [P] Unit tests `src/enrichments/__tests__/outlier-marks.test.ts`: cycle order; strict-`>` boundary; σ=0 → empty; non-numeric excluded; sort desc |σ| with doc-order tie-break; tooltip string format.
- [ ] T008 Create orchestrator skeleton `src/enrichments/outlier.ts` per contracts §3: per-table `WeakMap<HTMLTableElement, OutlierTableState>` (directives + marks maps, `unsubscribeVisibleRows`); implement `getOutlierThreshold`, `getOutlierMarks`, and `setOutlierThreshold` to update state and recompute marks via `computeColumnStatistics({excludeDimmed:true})` + `computeMarks` (no DOM paint or persistence yet); export `applyOutliers`/`tearDownOutliers` stubs and `qualifiesForOutliers(table, colIndex)` (≥3 numeric cells). (data-model §5; depends on T003, T006)

**Checkpoint**: Shared stats + pure mark logic + orchestrator state exist and are unit-tested.

---

## Phase 3: User Story 1 — Flag outliers at 2σ (Priority: P1) 🎯 MVP

**Goal**: Clicking the `!` lozenge once flags every cell beyond 2σ with a two-channel marker and a hover/focus tooltip showing value, mean, and σ distance.

**Independent Test**: On a numeric column with one cell outside `mean ± 2σ`, enable Grid-Sight, click `!` once → that cell gets a marker; hover/focus shows `value …, mean …, +N.Nσ`; unmarked cells show no tooltip.

- [ ] T009 [P] [US1] Create `src/ui/outlier-tooltip.ts`: show/hide a managed tooltip element on `mouseenter`/`mouseleave` **and** `focus`/`blur`, with text from `formatOutlierTooltip`; mirror text to an `aria-describedby` target on the cell; expose a remover that clears nodes + attribute. (FR-007, FR-019)
- [ ] T010 [US1] In `src/enrichments/outlier.ts` implement marker paint/unpaint: on active directive add `gs-outlier-cell` class + `data-gs-outlier` (signed σ) + `tabindex="0"` to marked cells and attach the tooltip; `tearDownOutliers` removes all classes/attrs/`tabindex`/tooltip nodes/`aria-describedby` and any open popup — DOM byte-identical to pre-flagging. Calls `ensureOutlierStyles()`. (FR-005, FR-021, SC-005; depends on T008, T009, T001)
- [ ] T011 [P] [US1] Create `src/ui/outlier-lozenge.ts` per contracts §4 — **single-activation slice**: `<button data-gs-lozenge-id="outlier" class="gs-lozenge …">`, glyph `!` (idle) / `!2` (active 2σ), `aria-pressed`, idle `aria-label` "Mark outliers in column 'X' at 2σ", internal `refresh()` reading `getCurrent()`; `inert:true` (σ=0) → click is a no-op with title "All values equal; no outliers to flag". Full cycle deferred to US2. (FR-001, FR-009, FR-018)
- [ ] T012 [US1] Register behaviour in `src/ui/header-utils.ts` per contracts §8: `registerEnrichment({ id:'outlier', appliesTo (column + numeric + not `data-gs-no-outlier` on table/header + not `columnHasRowspanBodyCells` + `qualifiesForOutliers`), isActive: getOutlierThreshold!==null, mount: createOutlierLozenge wired to setOutlierThreshold })`. (FR-001, FR-002, FR-010, FR-022; depends on T011, T008)
- [ ] T013 [US1] Flip the `outlier` entry in `src/core/enrichment-registry.ts` to `shipped:true` with `tearDown: tearDownOutliers, apply: applyOutliers`; in `src/index.ts` call `applyOutliers(table)` inside `processTable` gated on `isEnrichmentEnabled('outlier')`, and ensure `disable()` removes all outlier DOM. (FR-021, FR-023, checklist §1–§3; depends on T010)
- [ ] T014 [P] [US1] Unit tests `src/ui/__tests__/outlier-lozenge.test.ts`: idle→2σ on click; `aria-pressed`/accessible-name update; inert click is a no-op with correct title.
- [ ] T015 [P] [US1] Unit tests `src/enrichments/__tests__/outlier.test.ts`: marks at 2σ painted on the right cells; tooltip text correct; teardown leaves byte-identical DOM (SC-005); σ=0 inert; `appliesTo` false for <3 numeric / rowspan / `data-gs-no-outlier`.
- [ ] T016 [P] [US1] E2e `tests/e2e/outlier.spec.ts`: enable Grid-Sight, click `!` once → marked cell shows the marker; hover and keyboard-focus each reveal `value …, mean …, +N.Nσ`; an unmarked cell shows no tooltip. (spec US1 scenarios 1–3)

**Checkpoint**: One-click 2σ flagging with accessible marker + tooltip works end-to-end (MVP, SC-001).

---

## Phase 4: User Story 2 — Cycle the σ threshold (Priority: P1)

**Goal**: Repeated clicks cycle `idle → 2σ → 1σ → 3σ → idle`, re-evaluating cells and updating the lozenge indicator each click.

**Independent Test**: Click the lozenge four times → marked set grows (2σ→1σ), shrinks (1σ→3σ), empties (3σ→idle); glyph shows `!2`/`!1`/`!3`/`!`.

- [ ] T017 [US2] Extend `src/ui/outlier-lozenge.ts` to the full four-state cycle using `nextThreshold`: render `!2`/`!1`/`!3` indicators; `aria-label`/`title` state current + next action (e.g. "Outliers in column 'X' at 1σ; click for 3σ"); keep `aria-pressed` accurate. (FR-003, FR-004; depends on T011)
- [ ] T018 [US2] Ensure `setOutlierThreshold` in `src/enrichments/outlier.ts` recomputes and repaints marks on every cycle change and the tooltip reflects the current threshold's σ distance (not a fixed multiple). (FR-005 re-eval; depends on T010)
- [ ] T019 [P] [US2] Add cycle cases to `src/ui/__tests__/outlier-lozenge.test.ts`: full 4-state order; indicator + aria update each step.
- [ ] T020 [P] [US2] Add a cycle case to `tests/e2e/outlier.spec.ts`: four clicks; assert marked-set grows then shrinks then empties and the glyph updates each click. (spec US2 scenarios 1–4)

**Checkpoint**: US1 + US2 both work — flag and re-tune sensitivity without leaving the page.

---

## Phase 5: User Story 3 — Outliers list popup (Priority: P2)

**Goal**: A secondary affordance on the active lozenge opens a focus-trapped dialog listing outliers by descending |σ|; clicking an entry scrolls its row into view and highlights it.

**Independent Test**: At 1σ on a column with ≥5 outliers, open the list → entries sorted most→least distant; clicking the top entry brings its row into view; Escape closes and refocuses the lozenge.

- [ ] T021 [US3] Add the secondary affordance to `src/ui/outlier-lozenge.ts`: a small "show list" icon button rendered next to the lozenge only while active (mouse) **and** `Shift`+`Enter` while the lozenge is focused (keyboard), both invoking an `onShowList` callback. (FR-011; depends on T017)
- [ ] T022 [P] [US3] Create `src/ui/outlier-popup.ts` per contracts §5 on `popup-chrome.ts`: `role="dialog"` + `aria-label` "Outliers in column 'X' at Nσ"; list `row label — value — σ distance` via `sortMarksByDistance`; each entry a focusable button that on activation does `scrollIntoView({block:'nearest'})` + brief row-highlight **without** closing; `installPopupChrome` for Escape/Tab-trap/outside-click/return-focus; returns `dispose()`. (FR-012, FR-013, FR-014, FR-020)
- [ ] T023 [US3] Wire `onShowList` in the `header-utils.ts` mount to `openOutlierPopup({ getMarks: () => getOutlierMarks(table, colIndex), … })`; a second activation calls the returned `dispose()`. (FR-011, FR-014; depends on T021, T022, T012)
- [ ] T024 [P] [US3] Unit tests `src/ui/__tests__/outlier-popup.test.ts`: entries sorted by descending |σ| with doc-order ties; entry activation scrolls/highlights and keeps the popup open; Escape and outside-click close and return focus to the anchor.
- [ ] T025 [P] [US3] E2e `tests/e2e/outlier-list.spec.ts`: activate 1σ on a ≥5-outlier column; open the list (icon and `Shift`+`Enter`); assert sort order; click the top entry → its row is in view and highlighted. (spec US3 scenarios 1–3)

**Checkpoint**: US1–US3 work — marker, cycle, and a triage list.

---

## Phase 6: User Story 4 — Persist & share via URL (Priority: P2)

**Goal**: Active outlier state (per table, per column, per threshold) is encoded in the URL fragment under `gs.o` and restored on load with no `localStorage` dependency.

**Independent Test**: Flag two columns at different thresholds, copy the URL, open in a private window → identical flagged view + glyphs; a directive naming a removed column is ignored while others apply.

- [ ] T026 [P] [US4] Create `src/utils/outlier-persistence.ts` per contracts §6 and [contracts/url-fragment-schema.md](./contracts/url-fragment-schema.md): `encodeOutlierFragment`/`decodeOutlierFragment` (grammar `tableId(colKey:threshold;…),…`; never throws; threshold∉{1,2,3} and bad colKey skipped; dup→last-wins), URL read/write preserving other `&` params, `localStorage` mirror via `urlStem()`/`storageKeyFor('outliers')`, `persistOutliers` (URL via `history.replaceState` + storage), `resolveInitialOutliers` (URL > LS > empty). (FR-015, FR-016, FR-017, SC-004)
- [ ] T027 [P] [US4] Unit tests `src/utils/__tests__/outlier-persistence.test.ts`: round-trip the schema examples; malformed input → empty state; `gs.s`/`gs.v` preserved on write; out-of-range threshold and bad colKey skipped; duplicate colKey last-wins.
- [ ] T028 [US4] Wire persistence into `src/enrichments/outlier.ts`: `setOutlierThreshold` calls `persistOutliers` after each change; `applyOutliers` reads `resolveInitialOutliers()` and applies directives, silently skipping missing tables/columns and columns that no longer qualify (<3 numeric / rowspan / σ=0). (FR-016, FR-017; depends on T026, T010)
- [ ] T029 [P] [US4] E2e `tests/e2e/outlier-url-share.spec.ts`: flag two columns at different thresholds; reload restores both with correct glyphs; a fresh browser context (no `localStorage`) opening the URL reproduces the view (SC-004); a URL naming a removed column is ignored while valid directives apply. (spec US4 scenarios 1–2)

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Correctness refinements and ship-checklist items spanning stories.

- [ ] T030 Filter-aware live recompute in `src/enrichments/outlier.ts`: subscribe `onVisibleRowsChange(table, …)` while any column on the table is active; on each emission recompute `computeColumnStatistics({excludeDimmed:true})` + marks for active columns and repaint; unsubscribe when the last directive clears or on teardown. (FR-008, spec Assumption "Recompute on filter changes", research R-3)
- [ ] T031 [P] E2e `tests/e2e/outlier-filter-and-toggle.spec.ts`: applying/clearing a `gs.v` filter recomputes marks over the un-dimmed rows; toggling Grid-Sight off removes all markers/tooltips/popup (byte-identical) while `gs.o` remains in the URL so toggling on restores the view. (FR-021, SC-005)
- [ ] T032 [P] Create `src/stories/outlier.stories.ts`: interaction stories for the lozenge cycle and the list popup (Storybook test project).
- [ ] T033 [P] Finish the `demo/` outlier section started in T002 and verify it works from `file://` with no network (constitution §VI).
- [ ] T034 Reconcile capability surfaces per `docs/adding-an-enrichment.md` §4 so no parallel enrichment-id list drifts (registry, menu/items, any capability filters); tick every checklist section in the PR description.
- [ ] T035 Run merge gates: `yarn test` (Vitest + Storybook) green; `yarn test:e2e` (Playwright) green; `yarn build` green with IIFE ≤ 10 KB gzipped (net delta ≤ ~1.5 KB) via `scripts/bundle-size.js`; then run the `quickstart.md` manual smoke. (constitution §Development Workflow, SC-002, SC-003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001, T002 — no dependencies; can start immediately.
- **Foundational (Phase 2)**: depends on Setup. Internal order: T003 → T004/T005; T006 → T007; T008 depends on T003+T006. **Blocks all user stories.**
- **User Stories (Phase 3–6)**: all depend on Foundational. US1 is the MVP; US2 extends the US1 lozenge; US3 and US4 depend on US1's orchestrator/registration but are otherwise independent of each other.
- **Polish (Phase 7)**: depends on the stories it touches (T030/T031 need US1; T032/T033 need US1–US3; T035 needs everything).

### User Story Dependencies

- **US1 (P1)**: after Foundational. The MVP.
- **US2 (P1)**: after US1 (extends `outlier-lozenge.ts` and `setOutlierThreshold`).
- **US3 (P2)**: after US1 (needs `getOutlierMarks` + the active lozenge); independent of US2/US4.
- **US4 (P2)**: after US1 (needs `setOutlierThreshold`/`applyOutliers`); independent of US2/US3.

### Within Each User Story

- Write the unit/e2e tests alongside implementation; they MUST be green before merge.
- Pure logic (Foundational) before DOM paint; lozenge before its header registration; registration before e2e.

### Parallel Opportunities

- Setup: T001 ‖ T002.
- Foundational: {T003, T006} in parallel; their tests {T004, T007} in parallel after each.
- US1: T009 ‖ T011 (different files) before T010/T012; tests T014 ‖ T015 ‖ T016.
- Across stories once US1 lands: US3 and US4 can proceed in parallel (different files), and US2 in parallel with them except where it re-touches `outlier-lozenge.ts`/`outlier.ts`.

---

## Parallel Example: Foundational

```bash
# After Setup, launch the two independent foundational modules together:
Task: "Create src/core/column-statistics.ts (population σ, filter-aware)"   # T003
Task: "Create src/enrichments/outlier-marks.ts (pure mark math)"            # T006
# Then their tests in parallel:
Task: "Unit tests column-statistics.test.ts"                                # T004
Task: "Unit tests outlier-marks.test.ts"                                    # T007
```

## Parallel Example: User Story 1

```bash
# Independent files first:
Task: "Create src/ui/outlier-tooltip.ts"                                    # T009
Task: "Create src/ui/outlier-lozenge.ts (single-activation slice)"          # T011
# Then the US1 test trio in parallel:
Task: "Unit tests outlier-lozenge.test.ts"                                  # T014
Task: "Unit tests outlier.test.ts"                                          # T015
Task: "E2e outlier.spec.ts (one-click 2σ + tooltip)"                        # T016
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL — blocks all) → 3. Phase 3 US1 → **STOP and validate**: one-click 2σ flagging with accessible marker + tooltip (SC-001). Demoable.

### Incremental Delivery

Foundation → US1 (MVP) → US2 (cycle) → US3 (list) → US4 (share) → Polish. Each story adds value without breaking the previous; stop at any checkpoint to validate independently.

### Parallel Team Strategy

After Foundational + US1 land, one developer takes US2, another US3, another US4 (mostly different files); reconcile in Polish (T030–T035).

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- The shared `src/core/column-statistics.ts` (T003/T005) is what makes the outlier tooltip and the statistics popup agree (FR-024/SC-006) — do not fork it.
- The `outlier` registry entry already exists as `shipped:false`; T013 flips it on with `tearDown`/`apply`.
- Byte-identical teardown (SC-005) is verified in T015 (unit) and T031 (e2e); keep every injected class/attr/`tabindex`/node removable.
- Commit after each task or logical group; keep the suite green before merge.
