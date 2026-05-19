# Tasks: Per-Page Enrichment Capability Filtering

**Input**: Design documents from `/specs/012-capability-filtering/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/public-api.md ✓, quickstart.md ✓

**Tests**: Required — constitution Principle II (Test Discipline) mandates Vitest unit + Storybook interaction + Playwright e2e for every new code path; merge gate is the green test suite. Tests are not optional for this feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project (browser library) — paths from repo root:

- Source: `src/{core,enrichments,ui,utils}/`
- Tests: `src/{core,enrichments,ui,utils}/__tests__/`
- Storybook: `src/stories/`
- E2E: `tests/e2e/`
- Demos: `public/demo/`
- Build scripts: `scripts/`

---

## Phase 1: Setup (Bundle-Size Gate)

**Purpose**: Re-establish the constitution-mandated 10 KB gzipped ceiling before any new code lands. This phase is light because the project already has its build/test infrastructure; only the bundle-size gate needs attention (R-11).

- [X] T001 Run `yarn build` and record the current `dist/grid-sight.iife.js` gzipped size in `specs/012-capability-filtering/baseline-bundle-size.md` (one-liner: date, raw KB, gzipped KB, gap-to-10-KB). Read-only diagnostic; no code change. Resolves R-11's open question — if the baseline already exceeds 10 KB, stop and surface the result before T002 (decision needed: bundle-cut PR first, or constitution amendment).
- [X] T002 Re-enable the 10 KB gzipped ceiling in `scripts/bundle-size.js`: replace the "informational only" comment with a constitution §I justification block; after computing `gzKB`, compare against `MAX_GZ_KB = 10` and `process.exit(1)` on overage; add a `--soft` flag that preserves warn-only behaviour for local pre-PR builds. (Depends on T001 having confirmed the baseline is under 10 KB or having raised the amendment.) **Implementation note**: enforced ceiling raised to 25 KB pending constitution amendment per user decision; see baseline-bundle-size.md.

**Checkpoint**: Bundle gate is back to enforcing; every subsequent task's PR will be measured against 10 KB at build time.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the registry, parsers, resolver, shared infrastructure refactors, and id reconciliation that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `src/core/enrichment-registry.ts` exporting `EnrichmentId` (string literal union of the 15 ids), `EnrichmentRegistryEntry` (`{ id, label, defaultOn, tearDown? }`), and `ENRICHMENT_REGISTRY` (the frozen array per data-model.md "Initial contents"). Validate ids via `/^[a-z][a-z0-9-]*$/` at module load. Spec-only entries (sort, filter, outlier, sparkline, annotations, units-toggle, cumulative, copy-as-csv, diff-compare) have no `tearDown`.
- [X] T004 [P] Create `src/core/__tests__/enrichment-registry.test.ts` covering: id-format validation, uniqueness, label non-empty, frozen-ness (assert `Object.isFrozen`), and presence of every id named in data-model.md.
- [X] T005 [P] Create `src/core/page-config.ts` exporting `parsePageConfig(raw: unknown) → { enrichments: Set<string> | undefined, showToggleUi: boolean }`. Implement FR-022 fallback semantics: non-object → warn+reject; `enrichments` non-array → warn+ignore the field; non-string entries → drop with single warn; lowercase+trim normalisation; case-insensitive dedup; `showToggleUi` non-boolean → coerce via `Boolean()` with warn. Emit each warning at most once per call.
- [X] T006 [P] Create `src/core/__tests__/page-config.test.ts` covering each FR-022 fallback path (one assertion per misshapen input), case-insensitive normalisation, dedup, empty array vs missing array distinction.
- [X] T007 [P] Create `src/core/effective-enabled-set.ts` exporting `resolveEnabledSet(visitorOverride, pageConfig, registry) → Set<string>` implementing the precedence in research R-3 (visitor > page > defaults). All inputs are read-only; output is a fresh `Set` intersected with `knownIds`.
- [X] T008 [P] Create `src/core/__tests__/effective-enabled-set.test.ts` covering: each precedence tier in isolation, empty `pageConfig.enrichments` honoured as "no enrichments", unknown ids dropped from each input source, registry-default fallback.
- [X] T009 Create `src/core/column-types-cache.ts` (review fix 4A) exporting a module-scoped `WeakMap<HTMLTableElement, ColumnType[]>` and `getColumnTypes(table)`, `setColumnTypes(table, types)`, `clearColumnTypes(table)`. Document the invariant that only `processTable` writes the cache.
- [X] T010 [P] Create `src/core/__tests__/column-types-cache.test.ts` covering set/get/clear identity behaviour (do not assert on GC timing).
- [X] T011 Refactor `src/utils/slider-persistence.ts` (review fix 1A): parameterise `readFromUrl(key, hash?)`, `writeUrlHash(key, encoded, hash?)`, `readFromStorage(suffix, stem?)`, `writeToStorage(suffix, payload, stem?)`; widen `PersistedState.entries` to `string[] | Record<string, number>`; widen `isValidPersistedState`; keep existing slider call sites byte-identical by passing `'gs.s'` / `'sliders'`. All existing tests in `src/utils/__tests__/slider-persistence.test.ts` and `src/enrichments/__tests__/slider-persistence.integration.test.ts` must still pass with no edits.
- [X] T012 Run `yarn test` and confirm the full slider-persistence test surface remains green after T011. No code change; this is the verification gate for the refactor.
- [X] T013 Rename `EnrichmentType` ids in `src/ui/enrichment-menu.ts` (review fix 2A): `'slider'` → `'sliders'`, `'threshold-slider'` → `'slider-threshold'`, collapse `'toggle-sliders'` into `'sliders'` (single id, the menu predicate keeps both axes), delete `'zscore'` and `'aggregate'` from the union and `ENRICHMENT_ITEMS`. Update the one matching call site in `src/ui/toggle-injector.ts:122` (`'threshold-slider'` → `'slider-threshold'`). Grep the whole repo for any other reference to the old strings before merging.
- [X] T014 Wire pageConfig reading into `src/index.ts` `init(options)`: read `window.gridSight.pageConfig` once, merge `options.enrichments` / `options.showToggleUi` over it (per-field precedence), call `parsePageConfig`, call `resolveEnabledSet`, store the resulting `Set` in a module-scoped variable readable by the UI layer. Expose `window.gridSight.enrichmentIds` (frozen array) and `window.gridSight.isEnrichmentEnabled(id)` per contracts/public-api.md.

**Checkpoint**: Foundation ready. Registry is the single source of truth; page-config and effective-set resolvers are unit-tested; slider-persistence helpers are parameterised and re-green; column-types cache exists; enrichment-menu vocabulary matches the registry; init reads pageConfig.

---

## Phase 3: User Story 1 - Document author limits the enrichment set for a page (Priority: P1) 🎯 MVP

**Goal**: A page that declares `window.gridSight.pageConfig = { enrichments: [...] }` shows only the named enrichments — every lozenge, menu item, and URL-state-driven activation for the disabled enrichments stays absent.

**Independent Test**: Open `public/demo/sliders/interpolation.html`, add `<script>window.gridSight={pageConfig:{enrichments:['heatmap','sliders']}}</script>` before the bundle, reload, click GS on the table; assert the lozenge cluster on every qualifying header contains exactly the heatmap and sliders lozenges, and that opening any menu shows no `statistics` / `frequency` entries.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T015 [P] [US1] Create `src/ui/__tests__/enrichment-menu-filter.test.ts` (review fix 3A) — instantiate `createEnrichmentMenu` against an `EffectiveEnabledSet` containing only `{'heatmap','sliders'}` and assert: no menu item with `data-gs-enrichment-id` outside that set is rendered; the same call with the full set renders every column-appropriate item. Covers FR-010 acceptance.
- [ ] T016 [P] [US1] Create `tests/e2e/capability-filtering.spec.ts` — Playwright test that loads a fixture page declaring `enrichments: ['heatmap','sliders','statistics']`, enables GS, asserts the lozenge cluster on every header matches the set, and asserts the menu items match too. Covers Story 1 acceptance scenarios 1–4.

### Implementation for User Story 1

- [ ] T017 [P] [US1] Filter `LozengeSpec[]` in `src/ui/header-utils.ts` `addLozengesToHeader`: after building the specs array, drop entries whose `spec.id` is not in the effective enabled set (read via the foundational module from T014). Two-line change inside the existing collection loop.
- [ ] T018 [P] [US1] Filter `ENRICHMENT_ITEMS` in `src/ui/enrichment-menu.ts` `createEnrichmentMenu`: extend the existing `availableItems` filter (currently column-type + predicate) with a third clause that requires `item.id` to be in the effective enabled set. Single-line change inside the existing `.filter(...)`.
- [ ] T019 [US1] Suppress URL-encoded slider state for disabled enrichments (FR-011): in the slider attach path (`src/enrichments/slider.ts` and `slider-threshold.ts`), if the relevant enrichment id (`sliders` or `slider-threshold`) is not in the effective enabled set, skip the `resolveInitialPosition` read so a bookmarked `gs.s=` fragment cannot activate a disabled slider on load. Wraps the existing init-time call site only — no change to live add/remove.
- [ ] T020 [US1] Add `examples/capability-filtering-fixture.html` under `tests/e2e/fixtures/` (or wherever the existing Playwright fixtures live — confirm path during implementation) for T016 to load. Single table with both numeric and categorical columns so several lozenges qualify and the filter has something to filter.

**Checkpoint**: User Story 1 is fully functional. A page with a static `pageConfig` shows the declared subset. URL-encoded slider state for disabled enrichments is ignored. Tests T015 and T016 pass.

---

## Phase 4: User Story 2 - Visitor toggles enrichments at runtime on a demo page (Priority: P2)

**Goal**: An opt-in panel lists every registered enrichment as a checkbox; ticking / unticking updates lozenges across every table on the page within one animation frame and tears down any active instance of a disabled enrichment.

**Independent Test**: Load `public/demo/toggle/live-enrichments.html` (created in T034), open the panel, untick "heatmap" while a heatmap is painted on the page; assert the heatmap colouring is removed and the heatmap lozenge disappears from every header within one animation frame; tick it back; assert the lozenge re-appears but no heatmap re-paints automatically. Reload and assert the persisted set is restored.

### Tests for User Story 2

- [ ] T021 [P] [US2] Create `src/utils/__tests__/slider-persistence.enrichments.test.ts` — exercise the refactored helpers from T011 with `key='gs.e'` / `suffix='enrichments'` / `entries: string[]`: round-trip `['heatmap','sliders']` through `writeUrlHash` ↔ `readFromUrl` and `writeToStorage` ↔ `readFromStorage`; assert versioned wrapper is written; assert version mismatch falls back to empty.
- [ ] T022 [P] [US2] Create `src/ui/__tests__/toggle-panel.test.ts` — Vitest interaction test that mounts the panel into a JSDOM document, asserts one row per registered id, simulates `change` events, and asserts the corresponding visitor-persisted set mutates (read via T021's helpers).
- [ ] T023 [P] [US2] Create `src/stories/TogglePanel.stories.ts` — Storybook story rendering the panel with a fixture table; include an `addon-vitest` interaction test that fires a checkbox change and asserts a lozenge appears / disappears on the fixture table within one frame (`await waitFor`, no fixed timeout).
- [ ] T024 [P] [US2] Create `src/ui/__tests__/header-utils.refresh.test.ts` (review fix 4A) — synthesise a refresh path that calls `injectPlusIcons` with a pre-populated column-types cache; spy on `inferHeaderColumnType` (the existing internal) and assert it is NOT called on the cached path. Also assert that `clearColumnTypes(table)` followed by a refresh DOES call it again.
- [ ] T025 [P] [US2] Create `tests/e2e/capability-filtering-toggle.spec.ts` — Playwright test against `public/demo/toggle/live-enrichments.html` (created in T034) covering Story 2 acceptance scenarios 1–3: live toggle off removes lozenges + cleans up active instances; live toggle on restores lozenges; reload restores the persisted set with no flash beyond one animation frame.

### Implementation for User Story 2

- [ ] T026 [US2] Create `src/ui/toggle-panel.ts` exporting `mountTogglePanel(container?)` per data-model.md "RuntimeTogglePanel". Native `<fieldset>` + `<legend>` + one `<label><input type="checkbox"> Label <span class="gs-id-hint">(id)</span></label>` per registered id, in registry display order. Wire `change` events to `onCheckboxChange(id, checked)`. Resolve the container in the order: explicit argument → `[data-gs-toggle-panel]` → `<body>` (dock top-right CSS).
- [ ] T027 [US2] Implement `onCheckboxChange` in `src/ui/toggle-panel.ts`: write the new visitor-persisted set via the refactored persistence helpers (`writeUrlHash('gs.e', …)` + `writeToStorage('enrichments', …)`); re-derive the effective set via `resolveEnabledSet`; diff old vs new; for each id that transitioned ON → OFF, iterate `tableRegistry` (from `src/index.ts`) and call the registry entry's `tearDown(table)` if present; rebuild lozenges via `injectPlusIcons(table, getColumnTypes(table))` for every registered table. Wrap each `tearDown(table)` call in `try { … } catch (e) { console.warn('[gridsight] tearDown(' + id + ') threw; continuing', e); }` (research R-6 safety wrap).
- [ ] T028 [US2] Add container-resilience guard to `src/ui/toggle-panel.ts`: at the top of `onCheckboxChange`, check `this.root.isConnected`; if false, detach every event listener the panel owns, emit `console.warn('[gridsight] toggle panel container detached; panel disabled until next init()')` exactly once, and return early without further work (research R-5 addition).
- [ ] T029 [US2] Wire `processTable` in `src/core/table-processor.ts` (or wherever column types are detected today) to call `setColumnTypes(table, types)` after `detectColumnTypes`. Call `clearColumnTypes(table)` from `gridSight.disable()` in `src/index.ts` so re-init starts fresh.
- [ ] T030 [US2] Wire `injectPlusIcons` in `src/ui/header-utils.ts` to consult `getColumnTypes(table)` when called from the toggle-panel refresh path (T027), falling back to recomputation if the cache is empty (i.e. first call before `processTable` has cached). The initial-injection call site keeps recomputation; only the refresh path skips it.
- [ ] T031 [US2] Wire panel opt-in into `src/index.ts` `init()`: after T014 resolves the effective set, if `showToggleUi === true` OR a `[data-gs-toggle-panel]` element exists in the document, call `mountTogglePanel()`. Read the visitor-persisted set on init via the refactored persistence helpers and feed it into `resolveEnabledSet` before mounting (so the panel's initial checkbox states match the visitor's last choices).

**Checkpoint**: User Story 2 is fully functional. The panel renders, toggles cleanly, persists, and tears down active enrichments on disable. All Story 2 tests pass.

---

## Phase 5: User Story 3 - Demo pages showcase enrichment subsets relevant to each demo (Priority: P2)

**Goal**: Every demo page that exists today declares an explicit `pageConfig`, matching research R-8's narrowed table. One new demo showcases the runtime panel.

**Independent Test**: Walk each of the five existing demos and the new toggle demo; assert the lozenge cluster on the qualifying tables matches the declared subset for that page exactly — no extras.

### Implementation for User Story 3

- [ ] T032 [US3] Add `<script>window.gridSight={pageConfig:{enrichments:['heatmap','sliders','slider-threshold','statistics','frequency','frequency-chart']}}</script>` to `public/demo/index.html` (before the bundle `<script>`). Demo hub keeps every shipped affordance available.
- [ ] T033 [P] [US3] Add `pageConfig: { enrichments: ['heatmap','sliders','statistics'] }` to `public/demo/sliders/interpolation.html`.
- [ ] T034 [P] [US3] Add `pageConfig: { enrichments: ['sliders','statistics'] }` to `public/demo/sliders/alternate-calc-models.html`.
- [ ] T035 [P] [US3] Add `pageConfig: { enrichments: ['sliders'] }` to `public/demo/sliders/synced-tables.html`.
- [ ] T036 [P] [US3] Add `pageConfig: { enrichments: ['heatmap','sliders','slider-threshold'] }` to `public/demo/sliders/heatmap.html`.
- [ ] T037 [US3] Create `public/demo/toggle/live-enrichments.html` — a single table with both numeric and categorical columns so several enrichments qualify, declaring `pageConfig: { enrichments: [<every registered id>], showToggleUi: true }`. Add a short `<header>` explaining the demo and a link back to the demo home, matching the existing demo navigation style.
- [ ] T038 [US3] Extend `tests/e2e/capability-filtering.spec.ts` (from T016) with one Playwright assertion per demo: for each of the five existing demos plus the new toggle demo, load the page and assert the lozenge cluster on the qualifying tables matches the declared subset. Covers Story 3 acceptance scenarios 1–3 and FR-019.

**Checkpoint**: User Story 3 is fully functional. Every demo declares an explicit subset; no demo grows new lozenges automatically as future enrichments register.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tie-down work — documentation walkthrough, bundle verification, full-suite re-run, backlog follow-through.

- [ ] T039 [P] Walk `specs/012-capability-filtering/quickstart.md` end-to-end on the running build: copy each snippet into a fresh page, verify the behaviour matches the prose, fix any drift in the doc. Especially exercise the "Troubleshooting" section's localStorage key reference.
- [ ] T040 [P] Investigate `zscore` and `aggregate` removal (BACKLOG entry follow-through; T013 deleted them on the assumption they were dead code). Grep the whole repo once more after merge; if either has any reference outside this PR's diff, file the BACKLOG entry as resolved with a link; otherwise leave the BACKLOG entry as-is for the next maintainer.
- [ ] T041 Run `yarn build` and confirm `dist/grid-sight.iife.js` gzipped size remains ≤ 10 KB. Compare against the T001 baseline; if the delta is above 1 KB, surface in PR description before merging (SC-007 budget reality check).
- [ ] T042 Run the full test suite (`yarn test` + `yarn test:storybook` + `yarn test:e2e`) and confirm green. Constitution Principle II merge gate.
- [ ] T043 Update `CLAUDE.md` plan reference only if it has drifted; today it already points at `specs/012-capability-filtering/plan.md`. Confirm at the end of implementation.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T001 → T002 sequential.
- **Foundational (Phase 2)**: Depends on Setup completion. T003–T010 mostly parallel (different files); T011 → T012 sequential (refactor then verify); T013 and T014 sequential after T011 (init wiring uses the refactored helpers).
- **User Stories (Phase 3+)**: All depend on Foundational completion.
  - US1 (P1) is the MVP; US2 and US3 may proceed in parallel by different developers after US1's foundational dependencies are in place.
  - US3's e2e assertions (T038) depend on the demo files being in place (T032–T037) AND the static-config filter (US1) being functional.
- **Polish (Phase 6)**: Depends on US1 + US2 + US3 being complete (or the subset shipping in the MVP cut).

### Within Each User Story

- Tests are written before implementation (Principle II: tests must FAIL first, then pass).
- US1: T015/T016 (tests) → T017/T018 (implementation, parallel) → T019 → T020.
- US2: T021–T025 (tests) → T026 → T027/T028 (sequential — both edit the same file) → T029 → T030 → T031.
- US3: T032 → T033–T036 (parallel) → T037 → T038.

### Parallel Opportunities

- Foundational T003+T004, T005+T006, T007+T008, T009+T010 are four independent file pairs and can run in parallel.
- US1 T015+T016 (test files) parallel; T017+T018 (different files) parallel.
- US2 T021+T022+T023+T024+T025 (five test files) parallel.
- US3 T033+T034+T035+T036 (four independent demo HTML files) parallel.
- US2 and US3 can be staffed in parallel after US1 lands.

---

## Parallel Example: User Story 2 test stack

```bash
# Launch all US2 test files together (different files, no dependencies between them):
Task: "Create src/utils/__tests__/slider-persistence.enrichments.test.ts"
Task: "Create src/ui/__tests__/toggle-panel.test.ts"
Task: "Create src/stories/TogglePanel.stories.ts"
Task: "Create src/ui/__tests__/header-utils.refresh.test.ts"
Task: "Create tests/e2e/capability-filtering-toggle.spec.ts"
```

## Parallel Example: User Story 3 demo updates

```bash
# Launch the four sliders demo updates together (different files, no shared state):
Task: "Add pageConfig to public/demo/sliders/interpolation.html"
Task: "Add pageConfig to public/demo/sliders/alternate-calc-models.html"
Task: "Add pageConfig to public/demo/sliders/synced-tables.html"
Task: "Add pageConfig to public/demo/sliders/heatmap.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup (T001 → T002).
2. Complete Phase 2: Foundational (T003–T014).
3. Complete Phase 3: User Story 1 (T015–T020).
4. **STOP and VALIDATE**: Open a fresh page, declare a subset, confirm only the named lozenges appear. Run T015 + T016. This is a shippable increment — pages that don't want the toggle panel get the value of the filter immediately.

### Incremental Delivery

1. Setup + Foundational → bundle gate restored, registry + resolver landed. **(merge-able)**
2. Add User Story 1 → static config works. **(MVP — merge-able)**
3. Add User Story 3 → existing demos visibly cleaner. **(merge-able)**
4. Add User Story 2 → live toggle demo. **(complete feature)**
5. Add Polish.

Note: US3 can ship after US1 alone; US2 is independent of US3 and may ship in either order after US1.

### Parallel Team Strategy

With multiple developers:

1. One developer completes Setup + Foundational (Phase 1 + 2). Hands off when the registry, resolver, refactor, and init wiring are merged.
2. Once Foundational is done:
   - Developer A: User Story 1 (filter integration, tests, slider URL-state suppression).
   - Developer B: User Story 2 (toggle panel, persistence, refresh path, cache wiring).
   - Developer C: User Story 3 (demo updates, e2e assertions).
3. Polish phase is done by whoever finishes their story first; trivial to parallelise.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps task to specific user story for traceability.
- Each user story is independently completable and testable — US1 ships without US2 or US3; US3 needs US1 only for the e2e demo assertions to be meaningful.
- Verify tests fail before implementing them.
- Commit after each task or logical group; the existing branch (`claude/add-capability-filtering-dTXwp`) already carries the spec + plan commits.
- Stop at any checkpoint to validate independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
- Constitution gates at merge time: `yarn test` green, `yarn test:e2e` green, `yarn build` green with bundle ≤ 10 KB gzipped (T002 enforces).
- Open question from R-11 (recorded in plan post-review re-check): if T001 measures the current bundle above 10 KB, **stop** and surface the result — flipping enforcement on a violating bundle would break the build immediately. Either bundle-cut to <10 KB first or land a constitution amendment with a recorded budget-raise. Do not weaken the threshold silently.
