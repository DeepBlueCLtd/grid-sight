# Tasks: Welcome Page Redesign & Per-Table Options

**Input**: Design documents from `/specs/015-welcome-per-table-options/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — the Grid-Sight constitution (§II Test Discipline) requires
every feature to land with automated tests, and the spec's Testing strategy calls
for Vitest unit, jsdom interaction, Storybook, and Playwright e2e coverage.

**Organization**: Tasks are grouped by user story. Stories are sequenced so the
enabling capability (US4, the per-table options API) lands first because US2/US3
build on it; US1 and US5 are page-only and independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 maps to the spec's user stories
- All paths are repository-relative (single-project layout per plan.md)

## Path Conventions

- Core logic: `src/core/`; UI/injection: `src/ui/`; entry/wiring: `src/index.ts`
- Unit/jsdom tests: co-located in `src/**/__tests__/`
- Storybook: `src/stories/`; Playwright e2e: `e2e/`
- Welcome page: `public/index.html` (links to existing `public/demo/**`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Baseline and scaffolding shared by later phases.

- [X] T001 Confirm baseline green before changes: run `yarn test` and `yarn build` (record current bundle size from `node scripts/bundle-size.js --soft` as the delta baseline)
- [ ] T002 [P] Create stub module `src/core/per-table-options.ts` exporting `resolveTableConfig(table)` and `matchTableEntries(table)` signatures + the `ResolvedTableConfig` type (no logic yet), per `contracts/per-table-options.md`
- [ ] T003 [P] Create empty Playwright spec skeleton `e2e/welcome-per-table.spec.ts` with `test.describe` blocks named for US2/US3/US5 scenarios (skipped placeholders)

**Checkpoint**: Baseline recorded; new module + e2e file exist as stubs.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The config-parsing + resolution shape that both the API story (US4)
and the start-state demo (US3) consume. Kept minimal; the table-aware *wiring*
lives in US4.

**⚠️ CRITICAL**: US4 cannot begin until this phase is complete.

- [X] T004 Extend `ParsedPageConfig` in `src/core/page-config.ts` with `tables: ParsedTableOptionEntry[]` and define the `ParsedTableOptionEntry` type (`selector: string`, `enrichments: Set<string> | undefined`, `startActive: boolean`) per `data-model.md`
- [X] T005 Implement `pageConfig.tables` parsing + normalisation in `parsePageConfig` (`src/core/page-config.ts`): array guard, per-entry `selector` validation, `enrichments` trim/lowercase/dedup + non-string drop, `startActive` boolean coercion — each distinct warning once, never throw (R-9 / data-model validation rules)

**Checkpoint**: Config parsing accepts and normalises `tables`; resolver shape ready.

---

## Phase 3: User Story 4 - Per-table options API (Priority: P1) 🎯 MVP (enabling capability)

**Goal**: Different tables on one page offer different enrichment sets and
start-states, addressed by id/CSS selector, with precedence
visitor > per-table > page > defaults.

**Independent Test**: On a test page declare per-table options for two tables (by
id and by CSS selector) with different enrichment lists and start-states; confirm
each matched table offers only its declared enrichments and honours its
start-state, while an unmatched table follows the page-level config.

### Tests for User Story 4 (write first, ensure they FAIL)

- [X] T006 [P] [US4] Extend `src/core/__tests__/page-config.test.ts` — `tables` parsing: valid entries, missing/empty `selector` dropped, `enrichments` normalisation, `startActive` coercion, malformed `tables` warn-and-ignore
- [X] T007 [P] [US4] Create `src/core/__tests__/per-table-options.test.ts` — selector matching (id `#x` and CSS `.cls`/structural), declaration-order **last-match-wins per field** (R-7), `data-gs-ignore` excluded (R-8), no-match returns `matched:false`
- [X] T008 [P] [US4] Extend `src/core/__tests__/effective-enabled-set.test.ts` — per-table tier precedence (visitor > per-table > page > defaults) and unknown-id drop at the per-table tier (INV-2)
- [X] T009 [P] [US4] Create `src/ui/__tests__/header-utils.per-table.test.ts` — two tables with different per-table enrichment sets receive different lozenge clusters; an unmatched table matches today's global behaviour (INV-1)

### Implementation for User Story 4

- [X] T010 [US4] Add a `perTableEnrichments?: Set<string>` tier to `resolveEnabledSet` in `src/core/effective-enabled-set.ts`: visitor wins, else per-table (intersected with known ids), else page, else defaults (R-3, contract §2)
- [X] T011 [US4] Implement `src/core/per-table-options.ts`: `matchTableEntries(table, entries)` via `Element.matches`, fold last-match-wins per field, and `resolveTableConfig(table)` returning `{enrichments, startActive, matched}` (depends on T004, T010)
- [X] T012 [US4] Make `src/core/enabled-set-state.ts` table-aware: store parsed `tables`; add optional `table` arg to `getEffectiveEnabledSet`/`isEnrichmentEnabled`; cache `ResolvedTableConfig` in a `WeakMap`; invalidate cache on `setPageConfig`/`setVisitorOverride` (R-4, contract §3) (depends on T011)
- [X] T013 [US4] Pass the in-scope `table` to `getEffectiveEnabledSet(table)` in `src/ui/header-utils.ts` (`addLozengesToHeader`) so injection is per-table (depends on T012)
- [X] T014 [US4] In `src/index.ts`: wire `init()` to set the parsed `tables` into `enabled-set-state`, and pass `table` to the `isEnrichmentEnabled('outlier'|'freeze-panes'|'summary-row', table)` auto-render gates (depends on T012)
- [X] T015 [US4] Audit `isEnrichmentEnabled(id)` callers in `src/enrichments/slider.ts`, `slider-threshold.ts`, `annotations.ts`: pass `table` where the decision is table-scoped, leave page-global where intended; add a brief comment noting which (depends on T012)

**Checkpoint**: Two tables on one page expose different enrichment sets driven
solely by per-table options (SC-005); unmatched tables unchanged (SC-009).

---

## Phase 4: User Story 1 - First-time visitor understands what Grid-Sight is (Priority: P1)

**Goal**: A cold visitor reads, in plain language, what Grid-Sight is, the
problem it solves, and its principles — before any demo.

**Independent Test**: Load the page with Grid-Sight disabled; the hero +
principles section communicates purpose and principles without interacting with
any table.

### Tests for User Story 1

- [X] T016 [P] [US1] In `e2e/welcome-per-table.spec.ts`, add a US1 test: hero heading + problem statement + all five principles are present and visible with Grid-Sight disabled (FR-001, FR-002)

### Implementation for User Story 1

- [X] T017 [US1] Rewrite the top of `public/index.html`: replace the sliders-only lede with a hero (what GS is + problem it solves) and a plain-language principles block (offline/air-gapped, zero deps, progressive, accessible, byte-identical teardown), per `contracts/welcome-page.md` §1
- [X] T018 [US1] Add the welcome-page CSS for the hero/principles (warm-but-technical styling), keeping it inline and offline-safe (no fetched fonts/icons)

**Checkpoint**: Intro reads well standalone (SC-001); page still loads offline.

---

## Phase 5: User Story 2 - Visitor experiments with features inline (Priority: P1)

**Goal**: Four feature sections, each narrative beside a live demo table,
alternating sides on wide screens and stacking on mobile, each linking to its
demo pages.

**Independent Test**: Scroll through and operate each section's table; layout
alternates on wide screens and stacks on narrow screens.

**Depends on**: US4 (per-table options drive each demo's distinct feature set).

### Tests for User Story 2

- [X] T019 [P] [US2] Create `src/stories/per-table-options.stories.ts` — a Storybook story composing two tables with distinct enrichment sets + one start-active/one start-inactive, with a `play` interaction asserting different lozenges appear
- [X] T020 [P] [US2] In `e2e/welcome-per-table.spec.ts`, add US2 tests: all four feature areas have a live operable table; two tables show different lozenge sets simultaneously (SC-005); wide-screen alternation (CSS order) and mobile stacking with no horizontal overflow (SC-003); each section links to its demo page(s) (FR-008)

### Implementation for User Story 2

- [X] T021 [US2] Add the four feature sections to `public/index.html` (sliders & interpolation; visual analysis; navigation & search; derived data & notes), each: heading + narrative + ≥1 demo table with a stable `id` + links to the area's existing demo pages (FR-003, FR-006, FR-007, FR-008)
- [X] T022 [US2] Add the alternating two-column CSS grid + mobile `@media` stacking, alternation via CSS `order`/`:nth-of-type` only so DOM/tab order stays narrative-then-table (R-10, FR-004, FR-005, a11y)
- [X] T023 [US2] Configure `window.gridSight.pageConfig.tables` in `public/index.html` so each demo table offers exactly its section's enrichment(s) and starts active; re-register the slider demo's formula once the IIFE loads (R-11, contract §1)

**Checkpoint**: All four areas operable inline; distinct sets co-resident; layout
responsive (US2 complete, builds on US4).

---

## Phase 6: User Story 3 - On/off and start-state explained and demonstrated (Priority: P2)

**Goal**: Keep+explain the global toggle (non-destructive overlay) and
demonstrate the per-table start-state by showing a start-active table beside a
start-inactive one, each flippable in place.

**Independent Test**: Toggle the global control and watch the page move between
attached and raw; confirm one table loads with enrichments revealed and one
hidden, and clicking a GS toggle flips it without reload.

**Depends on**: US4 (resolved start-state) and US2 (section layout to host the demo).

### Tests for User Story 3

- [X] T024 [P] [US3] Create `src/ui/__tests__/toggle-injector.start-state.test.ts` — `activateToggle`/`deactivateToggle`: active class + `aria-expanded` flip, plus-icons injected/removed, and **byte-identical teardown** after activate→deactivate (FR-024, INV-4)
- [X] T025 [P] [US3] In `e2e/welcome-per-table.spec.ts`, add US3 tests: one table starts active (lozenges visible on load) and one starts inactive; clicking a GS toggle reveals/hides in place; global toggle off→on restores each table to its configured start-state (FR-009–FR-011, R-6)

### Implementation for User Story 3

- [X] T026 [US3] Extract `activateToggle(table)`/`deactivateToggle(table)` from the inline click handler in `src/ui/toggle-injector.ts` and have the click handler call them (single shared path; export both) (R-5, contract §4)
- [X] T027 [US3] In `src/index.ts`, after `injectToggle(table)`, call `activateToggle(table)` iff `resolveTableConfig(table).startActive`; on global re-enable, re-apply each table's configured start-state (R-5, R-6) (depends on T026, T012)
- [X] T028 [US3] In `public/index.html`, add the global-toggle region with narrative framing it as a non-destructive overlay, and place a start-active table beside a start-inactive one as the live start-state contrast (FR-009, FR-011, contract §1 items 3–4)

**Checkpoint**: Global toggle round-trips and is explained; start-state contrast
visible and interactive (SC-004, SC-008).

---

## Phase 7: User Story 5 - Visitor can still reach every existing demo (Priority: P3)

**Goal**: All 12 existing demo pages remain reachable from the welcome page.

**Independent Test**: From the welcome page, every existing demo page is reachable
via a working link.

### Tests for User Story 5

- [X] T029 [P] [US5] In `e2e/welcome-per-table.spec.ts`, add a US5 test asserting every existing demo page URL (the 12 from today's grid) is linked and the links resolve (no orphaned demo) (FR-012, SC-006)

### Implementation for User Story 5

- [X] T030 [US5] Add a consolidated "more demos" index section near the bottom of `public/index.html` linking all 12 existing demo pages (preserving today's reachable set), complementing the per-section links from US2 (FR-012)

**Checkpoint**: Zero orphaned demos (SC-006).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Budget, docs, and whole-feature validation.

- [ ] T031 Measure bundle delta with `node scripts/bundle-size.js --soft`; confirm < 42 KB gz and within the ≤ 1.5 KB budget; if breached, note explicitly in the PR (constitution §I)
- [X] T032 [P] Document the per-table options API + start-state in `docs/` (and a short note in `docs/architecture/enrichments.md` that gating is now table-aware); reconcile `README.md` feature list if it claims page-only config
- [X] T033 [P] Add an offline/`file://` smoke assertion to `e2e/welcome-per-table.spec.ts` (or a manual step in `quickstart.md`) confirming the page + every inline demo work with no network (FR-013, SC-007)
- [ ] T034 Run full suites green: `yarn test` (Vitest + Storybook), `yarn test:e2e` (Playwright), `yarn build` (tsc, zero errors) — the merge gate (constitution §II, SC-009)
- [ ] T035 Walk `quickstart.md` end-to-end against the built page; fix any drift between the documented contract and actual behaviour

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — blocks US4.
- **US4 (Phase 3)**: depends on Foundational — the enabling capability; blocks US2 and US3.
- **US1 (Phase 4)**: depends only on Setup — page-only, can run any time after Setup (parallel with US4).
- **US2 (Phase 5)**: depends on US4 (and US1's page shell is convenient but not strictly required).
- **US3 (Phase 6)**: depends on US4 (start-state) and US2 (section to host the demo).
- **US5 (Phase 7)**: depends only on the page existing — independent of US4.
- **Polish (Phase 8)**: depends on all targeted stories.

### Story independence

- **US4** is independently testable (unit + jsdom) without any page work.
- **US1** and **US5** are pure page content, independently testable, and need none of the API.
- **US2/US3** are the integration of the API into the page.

### Within each story

- Tests written first and expected to FAIL before implementation.
- Core resolution (T010–T012) before consumers (T013–T015).
- Toggle extraction (T026) before start-state wiring (T027) before the page demo (T028).

### Parallel opportunities

- T002, T003 (Setup) in parallel.
- US4 tests T006–T009 in parallel (different files).
- US1 (Phase 4) can proceed in parallel with US4 (Phase 3) — different files (`public/index.html` vs `src/core`/`src/ui`).
- US5 (Phase 7) can proceed in parallel once the page shell exists.
- Polish T032, T033 in parallel.

---

## Parallel Example: User Story 4 tests

```bash
# Launch all US4 tests together (different files), expect them to FAIL first:
Task: "Extend page-config.test.ts for tables parsing"          # T006
Task: "Create per-table-options.test.ts (matching + fold)"     # T007
Task: "Extend effective-enabled-set.test.ts (per-table tier)"  # T008
Task: "Create header-utils.per-table.test.ts (two tables)"     # T009
```

---

## Implementation Strategy

### MVP scope

The smallest valuable slice is **US4 (per-table options API)** plus **US1
(intro)**: the engine that makes distinct inline demos possible, and the broad
welcome framing. Complete Phases 1–4, validate US4 unit/jsdom + US1 e2e, then
layer US2 (inline demos), US3 (toggle/start-state), and US5 (all-demos index).

### Incremental delivery

1. Setup + Foundational → config accepts `tables`.
2. US4 → two tables show different features (capability proven, unit/jsdom green).
3. US1 → page reads as a real welcome (offline).
4. US2 → the four inline alternating demos go live on the page.
5. US3 → global toggle explained + start-state contrast demonstrated.
6. US5 → all demos remain reachable.
7. Polish → bundle budget, docs, full suites green, quickstart walk-through.

### Notes

- [P] = different files, no incomplete dependencies.
- Commit after each task or logical group; keep teardown byte-identical at every step.
- Do not regress unmatched-table behaviour (INV-1) — it is the no-regression guard.
