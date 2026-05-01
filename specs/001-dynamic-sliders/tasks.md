---
description: "Task list for feature: Dynamic Sliders & Interactive Examples"
---

# Tasks: Dynamic Sliders & Interactive Examples

**Input**: Design documents from `/specs/001-dynamic-sliders/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, quickstart.md

**Tests**: Test tasks ARE included — constitution Principle II (Test Discipline)
mandates that every new feature land with automated tests.

**Organization**: Tasks are grouped by user story (US1–US4) so each story is an
independently shippable increment. Foundational tasks (Phase 2) block all stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (US1–US4) — required in story phases
- All paths are repository-relative

## Path Conventions

- Source: `src/` (single project; per `plan.md` structure)
- Tests: per-folder `__tests__/` for unit; `tests/e2e/` for Playwright
- Stories: `src/stories/` for Storybook
- Demo: `public/demo/sliders/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directories and styling hooks that every later phase needs.

- [ ] T001 Create offline demo directory `public/demo/sliders/` (empty; pages added per story)
- [ ] T002 [P] Append slider-control base CSS (range track/thumb appearance, focus ring, layout) to `src/style.css`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure utility modules consumed by every user story. No DOM, no globals —
fully unit-testable and parallelisable.

**⚠️ CRITICAL**: User-story phases (Phase 3+) MUST NOT begin until this phase passes.

- [ ] T003 [P] Create pure interpolation module at `src/utils/interpolation.ts` exposing `linear1D(headers, values, x)` and `bilinear(rowHeaders, colHeaders, matrix, r, c)` per research §R-3
- [ ] T004 [P] Create sync-key module at `src/utils/sync-key.ts` deriving identity via `JSON.stringify(parsedHeaderValues)` per research §R-4
- [ ] T005 [P] Create persistence module at `src/utils/slider-persistence.ts` (URL fragment encode/decode under `#gs.s=`, localStorage round-trip with `version: 1`, fallback chain per research §R-5)
- [ ] T006 [P] Add unit tests for interpolation at `src/utils/__tests__/interpolation.test.ts` covering: 1-D between headers, exact-header equality (FR-006), bilinear, missing-cell → `NaN`, non-uniform spacing (edge cases in spec)
- [ ] T007 [P] Add unit tests for sync-key at `src/utils/__tests__/sync-key.test.ts` covering: numeric canonicalisation (`1000`, `1,000`, `1.0e3` collapse), unit-suffix stripping, mismatch detection
- [ ] T008 [P] Add unit tests for persistence at `src/utils/__tests__/slider-persistence.test.ts` covering: round-trip, malformed fragment ignored, missing fragment falls back to localStorage, missing both falls back to midpoint 0.5

**Checkpoint**: Foundation ready — user-story phases can start in parallel.

---

## Phase 3: User Story 1 — Interpolate value along numeric axis (Priority: P1) 🎯 MVP

**Goal**: A user can add a slider to a numeric axis via the plus-icon menu, drag it,
and see a continuously interpolated readout that matches hand-computed linear
interpolation.

**Independent Test**: Open `public/demo/sliders/interpolation.html`. Enable
Grid-Sight, add a row-axis slider, drag it. Verify the readout updates within one
animation frame and matches a hand calculation at any chosen position.

- [ ] T009 [US1] Create slider DOM control at `src/ui/slider-control.ts` using `<input type="range" step="any">` with: ARIA-live readout, manual key handling (←/→ = 1%, PgUp/PgDn = 10%, Home/End = endpoints) per research §R-2, RAF-throttled `input` handler per §R-6, polite live-region rate-limited to 250 ms per §R-7
- [ ] T010 [P] [US1] Add unit/interaction tests at `src/ui/__tests__/slider-control.test.ts` covering: render, drag updates readout, keyboard steps, ARIA attributes present, live-region rate-limit
- [ ] T011 [US1] Create axis-slider orchestrator at `src/enrichments/slider.ts` exposing `addSlider(table, axis)`, `getSliders(table?)`, `removeAllSliders(table?)`; computes `AxisBinding` per data-model.md and produces a `Slider` entity
- [ ] T012 [P] [US1] Add unit tests at `src/enrichments/__tests__/slider.test.ts` covering: add on numeric axis succeeds, add on non-numeric axis throws `Error("Axis not numeric")`, single-value axis rejected (FR-001 edge case), `removeAllSliders` cleans DOM + state
- [ ] T013 [US1] Modify `src/ui/enrichment-menu.ts` to register two new menu entries — "Add slider" (only when axis is numeric + monotonic, FR-001) and "Remove slider" (only when one exists for that axis); reuse existing menu rendering
- [ ] T014 [US1] Modify `src/index.ts` to export `addSlider`, `getSliders`, `removeAllSliders` on the `gridSight` object per `contracts/public-api.md`
- [ ] T015 [P] [US1] Create Storybook story at `src/stories/Slider.stories.ts` showing add → drag → keyboard → remove on a 5×5 numeric table
- [ ] T016 [P] [US1] Create offline demo page at `public/demo/sliders/interpolation.html` mirroring the alternate-calc-models reference layout (left: static reference table; right: interactive table with slider) — single-table variant
- [ ] T017 [US1] Create Playwright e2e at `tests/e2e/slider-interpolation.spec.ts` covering Story 1 acceptance scenarios 1, 2, 3 (drag updates within frame; exact-header equality; non-numeric axis hides "Add slider")

**Checkpoint**: MVP delivered — Grid-Sight can interpolate via slider on any
qualifying axis. Stories 2–4 are independent of each other and may proceed in
parallel after this phase.

---

## Phase 4: User Story 2 — Compare alternate calculation models (Priority: P2)

**Goal**: A page author can register a formula on a table; the slider then shows
two readouts side by side — "Interpolated" (data-driven) and "From equation"
(formula-driven), per FR-008/FR-009 and research §R-8.

**Independent Test**: Load `public/demo/sliders/alternate-calc-models.html`,
register a formula via console, drag the slider, verify both readouts update and
the equation readout matches the formula at any position.

- [ ] T018 [US2] Add formula registry to `src/enrichments/slider.ts` (per-table formula map, registered/cleared via API); on registry change, dispatch a recomputation of any active sliders for that table
- [ ] T019 [US2] Modify `src/ui/slider-control.ts` to render an additional `[data-gs-slider-readout="equation"]` span when the host slider's table has a registered formula; updates with the same RAF cadence as the interpolated readout
- [ ] T020 [US2] Modify `src/index.ts` to export `registerFormula(table, fn)` and `clearFormula(table)` per contracts; call signature `(rowValue: number, colValue: number) => number`
- [ ] T021 [P] [US2] Add unit tests at `src/enrichments/__tests__/slider-formula.test.ts` covering: register → readout appears, clear → readout disappears, formula throwing → readout shows "—" and slider stays usable, formula return non-finite → "—"
- [ ] T022 [P] [US2] Extend `src/ui/__tests__/slider-control.test.ts` to verify dual-readout rendering and labelling per FR-009
- [ ] T023 [P] [US2] Create offline demo page at `public/demo/sliders/alternate-calc-models.html` showing two side-by-side tables, each with "Enable Interactivity" toggle and a registered formula
- [ ] T024 [US2] Create Playwright e2e at `tests/e2e/slider-alt-models.spec.ts` covering Story 2 acceptance scenarios (sync between two interactive tables; equation readout independent of cell data)

**Checkpoint**: Story 2 delivered — formula evaluation runs alongside interpolation.

---

## Phase 5: User Story 3 — Sync sliders across tables + URL persistence (Priority: P2)

**Goal**: Multiple tables on the same page whose axis-headers match share slider
state automatically; slider position is encoded in the URL fragment for
bookmarking and falls back to localStorage. Per FR-010 to FR-014 and research
§R-4 / §R-5.

**Independent Test**: Open `public/demo/sliders/synced-tables.html` (two tables
with identical axis headers). Move a slider on Table A; verify Table B's slider
moves in lockstep. Copy URL, paste in new tab, verify slider restores.

- [ ] T025 [US3] Wire sync-group registry into `src/enrichments/slider.ts`: on slider creation, compute `SyncKey` via `src/utils/sync-key.ts` and join the group; on position change, broadcast to all group members via `setPosition`
- [ ] T026 [US3] Implement `data-gs-no-sync` opt-out in `src/enrichments/slider.ts`: when present on either table involved, sync is suppressed (group exists but broadcast is skipped) per FR-023
- [ ] T027 [US3] Wire persistence into slider lifecycle in `src/enrichments/slider.ts`: on slider creation, read URL fragment first, then `localStorage[gs:<urlStem>:sliders]`, fall back to 0.5 midpoint; on position change, write both via `history.replaceState` per research §R-5
- [ ] T028 [P] [US3] Add unit tests at `src/enrichments/__tests__/slider-sync.test.ts` covering: two tables with matching headers auto-sync, mismatched headers stay independent, `data-gs-no-sync` suppresses, mid-drag broadcast does not flicker per FR-011
- [ ] T029 [P] [US3] Add integration tests at `src/enrichments/__tests__/slider-persistence.integration.test.ts` covering: URL fragment present → restores; URL absent + localStorage present → restores; both absent → midpoint; removing slider prunes both surfaces
- [ ] T030 [P] [US3] Create Storybook story at `src/stories/SliderSync.stories.ts` showing two synced tables and the URL-fragment behaviour
- [ ] T031 [P] [US3] Create offline demo page at `public/demo/sliders/synced-tables.html` (two tables, identical axes) mirroring the synced-persistent-tables reference
- [ ] T032 [US3] Create Playwright e2e at `tests/e2e/slider-sync.spec.ts` covering Story 3 acceptance scenarios (cross-table sync; bookmark URL → reload → state restored)

**Checkpoint**: Story 3 delivered — sync + persistence operate end-to-end.

---

## Phase 6: User Story 4 — Dynamic heatmap with marker + threshold (Priority: P3)

**Goal**: On a heatmap-coloured table, axis sliders drive a position marker overlay,
and a threshold slider fades cells whose value falls below a chosen level. Per
FR-015/FR-016 and research §R-6.

**Independent Test**: Open `public/demo/sliders/heatmap.html` (heatmap table).
Add sliders to both axes — verify a marker moves over the heatmap. Add the
threshold slider and verify low-value cells fade live.

- [ ] T033 [US4] Create heatmap marker overlay at `src/ui/heatmap-marker.ts` rendering a `[data-gs-marker]` element absolutely positioned at the interpolated `(row, col)` coordinates of the table; updates each animation frame with axis sliders
- [ ] T034 [P] [US4] Add unit tests at `src/ui/__tests__/heatmap-marker.test.ts` covering: marker position at exact-header coords, mid-cell coords, marker hidden when no axis sliders, marker recomputes on table resize
- [ ] T035 [US4] Create threshold-slider orchestrator at `src/enrichments/slider-threshold.ts` exposing `addThresholdSlider(table)` per contracts; sets `--gs-cell-fade` CSS variable on the table container and toggles a `gs-threshold-active` class for the fade rule per research §R-6
- [ ] T036 [P] [US4] Add unit tests at `src/enrichments/__tests__/slider-threshold.test.ts` covering: threshold below min → no fade, threshold above max → all faded, mid threshold → cells partition correctly, removal restores original colours
- [ ] T037 [US4] Modify `src/index.ts` to export `addThresholdSlider` per contracts
- [ ] T038 [US4] Modify `src/enrichments/heatmap.ts` to attach `data-value` (the parsed numeric value) to each coloured cell and consume the `--gs-cell-fade` CSS variable in the cell colour expression — single existing-file change per plan structure
- [ ] T039 [P] [US4] Append marker overlay positioning rules and threshold-fade rule to `src/style.css` (use the `gs-threshold-active` class scoped to the table container)
- [ ] T040 [P] [US4] Create Storybook story at `src/stories/SliderHeatmap.stories.ts` showing dual-axis sliders with marker plus the threshold slider
- [ ] T041 [P] [US4] Create offline demo page at `public/demo/sliders/heatmap.html` with two heatmap regions sharing axes (mirrors the dual-region reference)
- [ ] T042 [US4] Create Playwright e2e at `tests/e2e/slider-heatmap.spec.ts` covering Story 4 acceptance scenarios (marker tracks slider; threshold fades low-value cells live)

**Checkpoint**: Story 4 delivered — full feature scope shipped.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Bundle-size verification, offline guarantee, documentation alignment.

- [ ] T043 [P] Add bundle-size measurement to `package.json` build script: after `vite build`, gzip `dist/grid-sight.iife.js` and log size; fail script if > 10 KB (constitution §I ceiling)
- [ ] T044 [P] Verify offline behaviour with a Playwright test at `tests/e2e/slider-offline.spec.ts` that loads a demo page from `file://` (no http server) and exercises a full slider drag — passes only if zero network requests are issued
- [ ] T045 [P] Update `documents/GridSight_Requirements.md` "Enrichment Capabilities" section to reference the dynamic-sliders feature (replace the existing "Interpolation tools (slider alongside relevant axis)" line with a concrete pointer to this spec)
- [ ] T046 [P] Reconcile `README.md`: the existing "Zero dependencies" claim is flagged in the constitution Sync Impact Report — either drop runtime deps not used by sliders, scope the claim to runtime-only, or rephrase. Spec 001 does not add deps, so this is documentation-only.

---

## Dependencies

### Phase ordering

```
Phase 1 (Setup) ──▶ Phase 2 (Foundational) ──▶ Phase 3 (US1 / MVP)
                                          ├──▶ Phase 4 (US2)  ┐
                                          ├──▶ Phase 5 (US3)  ├──▶ Phase 7 (Polish)
                                          └──▶ Phase 6 (US4)  ┘
```

- Phase 2 MUST complete before any user-story phase begins.
- Phase 3 (US1) MUST complete before Phase 4, 5, or 6 — they depend on the
  slider-control and addSlider plumbing built in US1.
- Phases 4, 5, 6 are independent of each other once US1 is done; they may run
  in parallel.

### Cross-task dependencies inside phases

- T010 depends on T009 (test the module being created).
- T012 depends on T011.
- T013, T014 depend on T011 (need `addSlider` to exist).
- T017 depends on T011, T013, T016.
- T019 depends on T009 + T018.
- T024 depends on T018, T020, T023.
- T028 depends on T025; T029 depends on T027; T032 depends on T025–T027 + T031.
- T034 depends on T033; T036 depends on T035; T042 depends on T033–T038.

---

## Parallel execution examples

**Foundational (Phase 2) — all parallel**:

```
T003 (interpolation.ts) ┐
T004 (sync-key.ts)      ├── all four [P], all in different files
T005 (persistence.ts)   ┘
T006 / T007 / T008 (matching tests in __tests__/) — also parallel
```

**US1 (Phase 3) — partial parallelism**:

```
T009 (slider-control.ts) ──▶ T010 (slider-control test)  
T011 (slider.ts)        ──▶ T012 (slider test)          
                                                        ├── then T013 / T014 sequential
T015, T016 — [P] alongside T011 (different files)       
T017 — last (depends on T011, T013, T016)
```

**Stories 2 / 3 / 4** (after US1 done): each story's tasks may run in its own
sandbox; Storybook + demo + tests in each phase carry [P] markers and are mostly
independent.

---

## Implementation strategy

1. **MVP first**: Ship Phases 1 + 2 + 3 (US1) as the first deliverable. This is a
   complete, demoable, independently testable slice — a slider on a numeric axis
   with live interpolation. Ship it, validate the UX, then proceed.
2. **Incremental delivery**: Each subsequent phase (US2, US3, US4) is a
   standalone increment with its own demo page and e2e suite. Merging any one of
   them does not require the others.
3. **Constitution gates** (per `plan.md` Constitution Check) MUST be re-validated
   at the end of each phase: bundle size measured (T043), tests green, no
   network access at runtime (T044), accessibility verified.
4. **Pre-production posture**: Per constitution §"Development-Phase Posture",
   none of the new public API is frozen yet. Renames, schema changes, and demo
   reorgs may happen freely between phases.

---

## Validation summary

- Total tasks: **46**
  - Setup: 2 (T001–T002)
  - Foundational: 6 (T003–T008)
  - US1 (P1, MVP): 9 (T009–T017)
  - US2 (P2): 7 (T018–T024)
  - US3 (P2): 8 (T025–T032)
  - US4 (P3): 10 (T033–T042)
  - Polish: 4 (T043–T046)
- Tasks with [P] marker (parallelisable): **24**
- Independent-test criteria documented for every story (Phases 3–6).
- Format check: every task line begins with `- [ ] T###`, carries a story label
  in story phases, and names a file path. ✅
