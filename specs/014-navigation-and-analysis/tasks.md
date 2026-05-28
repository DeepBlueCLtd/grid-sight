---

description: "Task list for spec 014 — Large-Table Navigation & Analysis (Tier 1)"
---

# Tasks: Large-Table Navigation & Analysis (Tier 1)

**Input**: Design documents from `/specs/014-navigation-and-analysis/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: INCLUDED. The spec mandates them (SC-008) and the constitution
requires test discipline (§II). Write each test set first and confirm it FAILS
before implementing the story.

**Organization**: Grouped by user story (US1–US4), each independently
implementable, testable, and demoable in priority order (P1 → P4). Each story is
a self-contained enrichment increment; US1 alone is a viable MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies).
- Paths are exact, per `plan.md` Source Code layout.

## Path notes

- Enrichment logic → `src/enrichments/`; UI → `src/ui/`; registry →
  `src/core/enrichment-registry.ts`; apply wiring → `src/index.ts`.
- Unit/interaction tests → `src/enrichments/__tests__/`; stories →
  `src/stories/`; e2e → `e2e/`.
- **Shared files (NOT [P] across stories)**: `src/core/enrichment-registry.ts`,
  `src/index.ts`, `public/index.html`, and the id/count tests
  (`enrichment-registry.test.ts`, `capability-filtering-toggle.spec.ts`) are
  touched additively by multiple stories — serialize those edits.

---

## Phase 1: Setup (Shared)

- [X] T001 Confirm a green baseline and record the bundle delta origin: run
  `yarn test` and `yarn test:e2e` (must be green) and
  `node scripts/bundle-size.js --soft`; note the current gzipped size in the PR
  as the baseline for the ≤ 4 KB combined budget.
  <!-- BASELINE 2026-05-28: yarn test = 510 pass (66 files); e2e = 77 pass;
       bundle = 41.24 KB gzipped (enforced ceiling 42 KB → only ~0.76 KB
       headroom, so the combined ≤4 KB delta will require raising the ceiling
       per T045). -->

---

## Phase 2: Foundational

**None required.** The four pieces are independent enrichments built entirely on
existing primitives (table-grid addressing, visible-rows pipeline, registry +
`registerEnrichment`/`isEnrichmentEnabled`, `popup-chrome`,
`slider-persistence`). No blocking shared infrastructure to build first; each
story may start immediately after Setup. (A possible shared visible-column
extraction helper is deferred to Polish T049 to preserve story independence.)

---

## Phase 3: User Story 1 — `freeze-panes` (Priority: P1) 🎯 MVP

**Goal**: Sticky header row + frozen key column while scrolling a large table.

**Independent Test**: On a tall/wide table in a scroll region, enable
`freeze-panes`, scroll down and right — header and key column stay visible and
aligned; disable → DOM byte-identical.

### Tests for US1 (write first, must fail)

- [X] T002 [P] [US1] Unit test in `src/enrichments/__tests__/freeze-panes.test.ts`:
  `applyFreezePanes` tags `headerRow` cells + `gridCells(row)[0]` per row (NOT
  `:first-child` when a slider scaffold is present); corner carries both classes;
  `removeFreezePanes` leaves byte-identical DOM; no-op when no grid rows.
- [X] T003 [P] [US1] Storybook story `src/stories/freeze-panes.stories.ts` with a
  `play` asserting the sticky classes/`position` on a scrollable fixture.
- [X] T004 [P] [US1] Playwright in `e2e/navigation-and-analysis.spec.ts` (freeze
  section): header pinned on vertical scroll, key column pinned on horizontal
  scroll, and the disable→enable toggle-panel round-trip restores without reload.

### Implementation for US1

- [X] T005 [US1] Implement `src/ui/freeze-panes-styles.ts` `ensureFreezeStyles()`
  — pre-minified injected `<style id=gs-freeze-styles>` scoped under `.gs-freeze`
  (sticky header `top:0`, key `left:0`, corner z-index, opaque backgrounds).
- [X] T006 [US1] Implement `src/enrichments/freeze-panes.ts`
  `applyFreezePanes`/`removeFreezePanes` per `contracts/freeze-panes.md` (key
  column via addressing layer; idempotent; byte-identical teardown). Depends: T005.
- [X] T007 [US1] Add the `freeze-panes` entry (`apply`/`tearDown`) to
  `src/core/enrichment-registry.ts`. Depends: T006. *(shared file)*
- [X] T008 [US1] Wire `applyFreezePanes(table)` in `src/index.ts` `processTable`,
  gated on `isEnrichmentEnabled('freeze-panes')`. Depends: T006, T007. *(shared file)*
- [X] T009 [US1] Update the shipped-id/count assertions in
  `enrichment-registry.test.ts` and `capability-filtering-toggle.spec.ts`.
  Depends: T007. *(shared files)*
- [X] T010 [P] [US1] Demo `public/demo/freeze-panes/index.html` — a tall/wide
  scientific results table in a scroll container, nav bar consistent with
  siblings, `pageConfig.enrichments` includes `freeze-panes`.
- [X] T011 [US1] Add a demo card linking the freeze-panes page to
  `public/index.html`. *(shared file)*
- [X] T012 [US1] `node scripts/bundle-size.js --soft` (≤ 0.6 KB delta) + a11y
  monochrome check (frozen edge legible without colour; no keyboard regressions).

**Checkpoint**: `freeze-panes` works and toggles independently — shippable MVP.

---

## Phase 4: User Story 2 — `statistics` extension (Priority: P2)

**Goal**: Richer numeric profile in the **existing** statistics popup — missing
%, distinct, Q1/Q3, mini histogram — computed over visible rows, with an
empty-state instead of a throw. **No new id, no second lozenge.**

**Independent Test**: Open the statistics lozenge on a numeric column with
blanks — see the new figures + histogram; filter rows and reopen — figures
recompute over only visible rows.

### Tests for US2 (write first, must fail)

- [X] T013 [P] [US2] Extend `src/enrichments/__tests__/statistics.test.ts`:
  `missing`/`missingPct`/`distinct`/`q1`/`q3`/`histogram` correctness; empty
  input returns a zero-count result (no throw); 10-bin edges incl. all-equal
  collapse.
- [X] T014 [P] [US2] jsdom popup test: new rows render, inline SVG histogram with
  `<title>` per bar, empty-state copy when count 0.
- [X] T015 [P] [US2] Playwright (statistics section of
  `e2e/navigation-and-analysis.spec.ts`): figures computed over visible rows and
  recompute live when a filter is applied while the popup is open.

### Implementation for US2

- [X] T016 [US2] Extend `StatisticsResult` + `calculateStatistics(values,
  missing?)` in `src/enrichments/statistics.ts` (quantile Q1/Q3 via
  `simple-statistics`, distinct set, 10-bin histogram, no-throw empty result).
- [X] T017 [US2] Render the new figures + inline SVG mini histogram + empty state
  in `src/ui/statistics-popup.ts` (reuse `sparkline-svg` approach; `show`/
  `onClose` signatures unchanged). Depends: T016.
- [X] T018 [US2] Switch `extractNumericColumnValues`/`…RowValues`/`…TableValues`
  in `src/ui/toggle-injector.ts` to read `getVisibleRows(table).current()` and
  return the missing count; subscribe via `onVisibleRowsChange` while the popup
  is open and unsubscribe in `onClose`. Depends: T016. *(shared file)*
- [X] T019 [P] [US2] Demo `public/demo/statistics/index.html` — a numeric table
  with blank cells and a skewed distribution; nav bar; `pageConfig.enrichments`
  includes `statistics`.
- [X] T020 [US2] Add a demo card for the statistics page to `public/index.html`.
  *(shared file)*
- [X] T021 [US2] `node scripts/bundle-size.js --soft` (≤ 0.8 KB delta) + a11y
  (histogram `<title>`s, keyboard reach unchanged). *(No id/count test change —
  `statistics` is already a shipped id.)*

**Checkpoint**: numeric profiling is richer; categorical stays with `frequency`.

---

## Phase 5: User Story 3 — `summary-row` (Priority: P3)

**Goal**: Per-column aggregate footer (sum/avg/min/max/count) over visible rows,
choice persisted per page.

**Independent Test**: Enable `summary-row`, confirm a footer sum over visible
rows; switch a column to average; apply a filter and watch it recompute; reload
and confirm the choice persists.

### Tests for US3 (write first, must fail)

- [X] T022 [P] [US3] Unit `src/enrichments/__tests__/summary-row.test.ts`:
  `aggregate()` math (numeric excludes blank/non-numeric; `count` counts
  non-blank); persistence codec round-trip + malformed-ignored + storage-
  unavailable degrades with one warn; `removeSummaryRow` byte-identical teardown.
- [X] T023 [P] [US3] jsdom: footer cells align to logical columns and are
  `data-gs-injected`; aggregate control keyboard-operable; recompute on
  simulated visible-rows change.
- [X] T024 [P] [US3] Storybook story `src/stories/summary-row.stories.ts`.
- [X] T025 [P] [US3] Playwright (summary section): sum over visible → switch to
  average → filter recompute → persists across reload → disable→enable round-trip
  restores footer + choices without reload.

### Implementation for US3

- [X] T026 [US3] Implement `src/ui/summary-row-control.ts`
  `mountAggregateControl(...)` (keyboard-operable chooser).
- [X] T027 [US3] Implement `src/enrichments/summary-row.ts`
  `applySummaryRow`/`removeSummaryRow`/`aggregate` per `contracts/summary-row.md`
  — inject `data-gs-injected` `<tfoot>`, restore choices via `storageKeyFor`,
  subscribe `onVisibleRowsChange`, persist on change. Depends: T026.
- [X] T028 [US3] Add the `summary-row` entry (`apply`/`tearDown`) to
  `src/core/enrichment-registry.ts`. Depends: T027. *(shared file)*
- [X] T029 [US3] Wire `applySummaryRow(table)` in `src/index.ts` `processTable`,
  gated on `isEnrichmentEnabled('summary-row')`. Depends: T027, T028. *(shared file)*
- [X] T030 [US3] Update id/count assertions in `enrichment-registry.test.ts` and
  `capability-filtering-toggle.spec.ts`. Depends: T028. *(shared files)*
- [X] T031 [P] [US3] Demo `public/demo/summary-row/index.html` — a filterable
  measurement/financial table; nav; `pageConfig.enrichments` includes `summary-row`.
- [X] T032 [US3] Add a demo card to `public/index.html`. *(shared file)*
- [X] T033 [US3] `node scripts/bundle-size.js --soft` (≤ 1.4 KB delta) + a11y
  (non-colour emphasis, keyboard control).

**Checkpoint**: footer aggregates correct under filter/sort and persist.

---

## Phase 6: User Story 4 — `find-in-table` (Priority: P4)

**Goal**: Search the table; highlight all visible matches, count them, and step
Next/Previous with wrap + scroll-into-view.

**Independent Test**: Enable `find-in-table`, type a repeated term — all visible
matches highlight, counter correct; Next cycles through every match; clear
removes highlighting.

### Tests for US4 (write first, must fail)

- [ ] T034 [P] [US4] Unit `src/enrichments/__tests__/find-in-table.test.ts`:
  `search` builds an ordered match list over visible-row `cellValue`s
  (case-insensitive); `next`/`prev` wrap; matches exclude scaffolding; `clear`
  removes `gs-find-match`/`gs-find-current` (byte-identical).
- [ ] T035 [P] [US4] jsdom: box keyboard contract via `installPopupChrome`
  (focus-trap, Escape closes, focus returns); counter renders "N of M" / "0
  matches".
- [ ] T036 [P] [US4] Storybook story `src/stories/find-in-table.stories.ts`.
- [ ] T037 [P] [US4] Playwright (find section): highlight all + Next/Prev cycle
  with `scrollIntoView` + clear + disable→enable round-trip.

### Implementation for US4

- [ ] T038 [US4] Implement `src/enrichments/find-in-table.ts`
  `createFindController`/`removeFindUi` per `contracts/find-in-table.md`
  (cell-level highlight; no `<mark>` surgery).
- [ ] T039 [US4] Implement `src/ui/find-in-table-box.ts` `openFindBox(...)`
  (search box + counter + prev/next + close via `installPopupChrome`; input
  debounced ~120 ms). Depends: T038.
- [ ] T040 [US4] Add the `find-in-table` registry entry (`tearDown`) AND a
  `registerEnrichment` behavior mounting a table-level (`headerType==='table'`)
  corner lozenge that calls `openFindBox`. Depends: T038, T039. *(shared registry file)*
- [ ] T041 [US4] Update id/count assertions in `enrichment-registry.test.ts` and
  `capability-filtering-toggle.spec.ts`. Depends: T040. *(shared files)*
- [ ] T042 [P] [US4] Demo `public/demo/find-in-table/index.html` — a dense lookup
  table; nav; `pageConfig.enrichments` includes `find-in-table`.
- [ ] T043 [US4] Add a demo card to `public/index.html`. *(shared file)*
- [ ] T044 [US4] `node scripts/bundle-size.js --soft` (≤ 1.2 KB delta) + a11y
  (current-match non-colour signal, keyboard end-to-end).

**Checkpoint**: all four pieces functional and independently toggleable.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T045 Combined bundle gate: `node scripts/bundle-size.js` (hard) — confirm
  the total delta is ≤ 4 KB and under the enforced 42 KB ceiling. If it would
  breach 42 KB, raise the ceiling explicitly in `scripts/bundle-size.js` +
  `specs/012-capability-filtering/baseline-bundle-size.md` and call it out in
  the PR (constitution §I).
- [ ] T046 [P] Full suite green: `yarn test` (Vitest + Storybook) and
  `yarn test:e2e` (Playwright).
- [ ] T047 [P] Run the `quickstart.md` wire-up sanity for one new enrichment to
  confirm the integration spine matches reality.
- [ ] T048 Paste the `docs/adding-an-enrichment.md` checklist into the PR with
  every item ticked or marked `N/A` for each of the four pieces.
- [ ] T049 [P] (Optional refactor) If extraction duplication emerged across
  statistics/summary/find, extract a shared visible-column value+missing reader;
  keep all story suites green.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1 task T001)**: start immediately.
- **Foundational**: none — stories unblocked after Setup.
- **User Stories (Phases 3–6)**: independent; recommended in priority order
  P1→P2→P3→P4, or in parallel if staffed (mind the shared files below).
- **Polish (Phase 7)**: after the desired stories land.

### Within each story

- Tests first (T002–T004, T013–T015, T022–T025, T034–T037) → must fail → then
  implement.
- Logic/UI module → registry entry → `index.ts`/lozenge wiring → id/count tests
  → demo → bundle/a11y check.

### Shared-file serialization (do NOT run these in parallel across stories)

- `src/core/enrichment-registry.ts`: T007, T028, T040.
- `src/index.ts`: T008, T029.
- `public/index.html`: T011, T020, T032, T043.
- id/count tests (`enrichment-registry.test.ts`,
  `capability-filtering-toggle.spec.ts`): T009, T030, T041.
- `e2e/navigation-and-analysis.spec.ts`: T004, T015, T025, T037 (one file —
  append sections, don't parallelize edits).

### Parallel opportunities

- All `[P]` tasks **within a story** (its tests, its demo) run in parallel.
- Across stories: logic/UI modules in different files (T005/T006, T016/T017,
  T026/T027, T038/T039) are independent and can proceed in parallel by different
  developers, provided the shared-file edits above are serialized.

---

## Implementation Strategy

### MVP first (US1 only)

1. T001 Setup. 2. Phase 3 (`freeze-panes`). 3. **Stop & validate** — sticky
   header/column + clean toggle round-trip. 4. Demo/ship.

### Incremental delivery

US1 → US2 → US3 → US4, each green, demoed, and toggleable before the next.
`freeze-panes` (P1) is the cheapest, highest-orientation win; the `statistics`
extension (P2) is the next-cheapest because it reuses an existing enrichment.

---

## Notes

- `[P]` = different files, no dependency.
- Every story must leave the DOM byte-identical on teardown and restore on the
  disable→enable toggle without a reload (the recurring 006/012 failure — covered
  by T004/T025/T037 and the teardown unit tests).
- No new runtime dependency. No network. Works from `file://`.
- Commit after each task or logical group; keep `main` suites green at every
  checkpoint.
