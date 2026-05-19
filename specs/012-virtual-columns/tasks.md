---
description: "Task list for 012-virtual-columns"
---

# Tasks: Virtual Columns (Sparkline + Cumulative + Compare-Column)

**Input**: Design documents from `/specs/012-virtual-columns/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-api.md, contracts/registry-api.md, quickstart.md

**Tests**: Included. Constitution §II (Test Discipline) requires automated tests for every new feature; SC-005 (byte-identical detach) and SC-006 (a11y) cannot be verified without them.

**Organization**: Tasks are grouped by user story (US1..US8 from spec.md) so each can be implemented, tested, and shipped independently against the shared scaffold (built in Phase 2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to user stories US1..US8 from spec.md
- File paths are exact and absolute-from-repo-root

## Path Conventions

Existing single-project layout reused:

- Production code: `src/{enrichments,ui,utils,types}/`
- Unit tests: `src/{enrichments,utils}/__tests__/`
- Storybook stories: `src/stories/`
- e2e tests: `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Skeleton files and tooling additions that everything else depends on. No behavioural code yet.

- [ ] T001 Create directory skeleton: ensure `src/enrichments/__tests__/`, `src/utils/__tests__/`, `src/stories/`, and `tests/e2e/helpers/` exist (already present in repo; verify only).
- [ ] T002 [P] Add the `data-gs-virtual-column` and `data-gs-virtual-column-id` attribute styles + lozenge base styles (`Σ` `⌇` `Δ`) to `src/style.css`. No JS yet; CSS only.
- [ ] T003 [P] Create `src/types/virtual-column.ts` exporting the `VirtualColumnKind`, `CumulativeDirective`, `CompareDirective`, `SparklineDirective`, `VirtualColumnDirective` discriminated union, and the `Renderer<D>` interface per `data-model.md` and `contracts/registry-api.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The virtual-column scaffold itself — the single owner of DOM append/detach, canonical ordering, renderer registry, and the two stub integration interfaces. After Phase 2 the scaffold can host any registered renderer; renderers themselves arrive in the story phases.

**⚠️ CRITICAL**: No user-story work (US1..US8) can begin until this phase is complete and the unit suite is green on the scaffold.

- [ ] T004 [P] Implement the Visible Row Sequence stub at `src/utils/visible-rows.ts` exporting `getVisibleRows(table)` with the passthrough behaviour described in `research.md` §R-3 (DOM-order rows, all `state: 'visible'`, no-op subscribe).
- [ ] T005 [P] Implement the copy-as-CSV registry at `src/utils/copy-as-csv-registry.ts` (in-memory `WeakMap<HTMLTableElement, Map<string, VirtualColumnExport>>`) per `research.md` §R-4 and `contracts/registry-api.md` §3.
- [ ] T006 [P] Implement the canonical-order helper at `src/enrichments/virtual-column-registry.ts` exporting a pure `sortCanonical(directives)` function that enforces the invariant from `data-model.md` §"Canonical-order invariant".
- [ ] T007 [P] Implement the URL-fragment codec at `src/enrichments/virtual-column-persistence.ts` exporting `encodeFragment(state)`, `decodeFragment(text)`, and `slugifyColumnKey(headerText)` per `research.md` §R-5 and `data-model.md` §"Entity: PersistedVirtualColumnState".
- [ ] T008 Implement the scaffold core at `src/enrichments/virtual-column.ts`: `registerRenderer`, `activateDirective`, `mutateDirective`, `removeDirective`, per-table `tableContexts` WeakMap, `<th>`/`<td>`/`<tfoot>-<td>` append in canonical position, `data-gs-virtual-column*` attribute tagging, reverse-order detach (R-12), single-rAF fan-out plumbing (R-9) gated off until US8 wires VRS subscription, and copy-as-CSV registration around the lifecycle. Depends on T003, T004, T005, T006.
- [ ] T009 [P] Unit test the canonical-order helper at `src/enrichments/__tests__/virtual-column-registry.test.ts`: cover (a) cumulative-by-activation order, (b) compare slot, (c) sparkline always last, (d) idempotent re-sort, (e) mixed-kind permutations.
- [ ] T010 [P] Unit test the URL codec at `src/enrichments/__tests__/virtual-column-persistence.test.ts`: cover (a) round-trip for every directive kind, (b) unknown-prefix tokens ignored, (c) invalid tokens dropped without erroring, (d) duplicate cumulative `colKey` keeps last, (e) duplicate compare/sparkline keeps first, (f) post-parse re-canonicalisation, (g) multi-table block encoding.
- [ ] T011 Unit test the scaffold lifecycle at `src/enrichments/__tests__/virtual-column.test.ts`: cover (a) `activateDirective` placement at canonical position with a fake renderer, (b) `removeDirective` byte-identical-DOM teardown via snapshot diff, (c) `mutateDirective` re-renders only the affected record, (d) `data-gs-ignore` refuses installation, (e) cardinality refusal (second sparkline → null), (f) copy-as-CSV registry contents match `registry.directives` order. Depends on T008.
- [ ] T012 Add the public API skeleton to `src/index.ts`: re-export `registerVirtualColumn` from the scaffold and the type names from `src/types/virtual-column.ts` per `contracts/public-api.md` §3. Leave `window.gridSight.virtualColumns` namespace stubbed (returns `null` on every `addX`) until renderers land — this lets renderer phases plug in without further index changes.

**Checkpoint**: Scaffold is testable in isolation against a fake in-tree renderer; canonical order, append/detach, URL codec, and copy-as-CSV registry are all green. User-story work can now begin in parallel (US1, US2 ship the first two renderers).

---

## Phase 3: User Story 1 - Cumulative running-sum column (Priority: P1) 🎯 MVP

**Goal**: A Σ lozenge on a numeric column header appends a `Σ <header>` column on the right edge with `sum → percent-of-total → off` cycling, all running through the scaffold.

**Independent Test**: On a Grid-Sight-enabled fixture page with a `Weight` numeric column, click Σ on the header — a new right-edge column appears showing the running sum. Click again — column flips to percent of total. Click a third time — column disappears with byte-identical DOM (snapshot test).

### Tests for User Story 1

- [ ] T013 [P] [US1] Unit test cumulative math at `src/enrichments/__tests__/cumulative-column.test.ts`: cover (a) sum mode partial accumulators, (b) percent-of-total with non-zero total, (c) percent with zero total → '—' placeholder, (d) non-numeric source cells skipped per FR-012 of `008-cumulative-column`, (e) `getCellText` exporter parity.
- [ ] T014 [P] [US1] Playwright e2e at `tests/e2e/virtual-column-cumulative.spec.ts`: open the demo page, activate Σ on `Weight`, assert the new column header text + per-row values; click again for percent; click third time for removal + DOM snapshot equality.

### Implementation for User Story 1

- [ ] T015 [P] [US1] Implement the cumulative renderer at `src/enrichments/cumulative-column.ts`: `Renderer<CumulativeDirective>` per `contracts/registry-api.md` §1, computing values by walking the current Visible Row Sequence (stub returns full DOM order in v1) and writing into the per-cell `<td>` text. Includes the `exporter` builder. Self-registers at module import via `registerRenderer`.
- [ ] T016 [US1] Add the Σ lozenge factory at `src/ui/virtual-column-lozenges.ts` (new file): inject one Σ button per numeric column header on activation, wire the click handler to cycle `∅ → sum → percent → ∅` via `activateDirective` / `mutateDirective` / `removeDirective`. Skip tables with `data-gs-ignore` or `data-gs-no-cumulative`. Depends on T008, T015.
- [ ] T017 [US1] Wire cumulative-column module load into `src/index.ts` so the renderer registers on every Grid-Sight init. Add `addCumulative` / `remove` (cumulative path) entry to the `window.gridSight.virtualColumns` namespace per `contracts/public-api.md` §2.
- [ ] T018 [P] [US1] Add a Storybook story `src/stories/cumulative-column.stories.ts` exercising the three-state cycle on a small fixture table, with interaction tests via `@storybook/addon-vitest`.

**Checkpoint**: User Story 1 is fully functional. The Σ lozenge ships independently of sparkline and compare.

---

## Phase 4: User Story 2 - Row sparkline column (Priority: P1) 🎯 MVP

**Goal**: A ⌇ lozenge in the table's corner cluster appends a `Trend` column rendering an inline SVG mini-bar-chart per row across the table's numeric body columns. Default per-row scaling; SC-002 perf budget (< 200 ms initial render on 1 000 × 10) respected.

**Independent Test**: On a fixture page with ≥ 3 numeric columns, click ⌇ — a `Trend` column appears at the right edge containing one inline `<svg>` per body row with one `<rect>` per numeric column, heights proportional to per-row values. Click ⌇ again to remove with byte-identical DOM.

### Tests for User Story 2

- [ ] T019 [P] [US2] Unit test the SVG builder at `src/enrichments/__tests__/sparkline-svg.test.ts`: cover (a) `<svg>` viewBox + N `<rect>` children for N inputs, (b) per-row max scaling, (c) zero-range row → flat baseline, (d) incomplete row → em-dash placeholder per `005` FR-009, (e) no DOM-string parsing (assert `document.createElementNS` is the only construction path).
- [ ] T020 [P] [US2] Unit test the sparkline renderer at `src/enrichments/__tests__/sparkline-column.test.ts`: cover (a) `headerText` returns `'Trend'`, (b) `canActivate` rejects tables with < 3 numeric columns per FR-002 of `005`, (c) `renderCell` writes an `<svg role="img" aria-label="...">` with non-empty label (SC-006), (d) `exporter.getCellText` returns the `"min:..;max:..;last:.."` triple.
- [ ] T021 [P] [US2] Playwright e2e at `tests/e2e/virtual-column-sparkline.spec.ts`: activate ⌇ on a fixture, assert one `<svg>` per body row in the appended column with the expected `<rect>` count; click again for removal + DOM snapshot equality.
- [ ] T022 [P] [US2] Perf smoke test at `src/enrichments/__tests__/sparkline-perf.test.ts`: build a 1 000 × 10 numeric jsdom fixture, time the initial render, assert < 250 ms (a looser jsdom-relative budget; the real 200 ms wall-clock budget from SC-002 is checked by the Playwright run on Chromium in T038).

### Implementation for User Story 2

- [ ] T023 [P] [US2] Implement `src/enrichments/sparkline-svg.ts`: pure `buildSparklineSvg(values: number[], width, height): SVGElement` using `document.createElementNS`. No DOM-string parsing.
- [ ] T024 [US2] Implement the sparkline renderer at `src/enrichments/sparkline-column.ts`: `Renderer<SparklineDirective>` with `canActivate` (≥ 3 numeric columns), `renderCell` (build SVG via T023, attach role + aria-label + `tabindex="0"` per `research.md` §R-10), `exporter`. Self-registers via `registerRenderer`. Scale defaults to `'per-row'`; `'shared'` is stubbed until US5. Depends on T023.
- [ ] T025 [US2] Extend `src/ui/virtual-column-lozenges.ts` with the ⌇ lozenge factory in the table's corner cluster (alongside the existing `S` slider lozenge). Wires `∅ → on → ∅` via `activateDirective` / `removeDirective`. Skip tables with `data-gs-ignore` or `data-gs-no-sparkline`. Depends on T008, T024.
- [ ] T026 [US2] Wire sparkline module load into `src/index.ts` and add `addSparkline` to `window.gridSight.virtualColumns` per `contracts/public-api.md` §2.
- [ ] T027 [P] [US2] Add a Storybook story `src/stories/sparkline-column.stories.ts` exercising activation, the ≥ 3-numeric-column qualifier, and the incomplete-row placeholder.

**Checkpoint**: User Story 2 ships independently of US1 and US3. US1 + US2 are the MVP — either alone, or both together via the canonical-ordering scaffold, satisfies the P1 backlog.

---

## Phase 5: User Story 3 - Column-comparison column (Priority: P2)

**Goal**: A Δ lozenge in the corner cluster opens a picker; selecting column A then column B appends a `Δ <colB> − <colA>` column on the right edge with per-row deltas (abs / rel / percent modes, direction by colour + glyph per FR-014).

**Independent Test**: On a fixture page, click Δ, click `Q1`, click `Q4` — a new column appears with per-row `Δ` values (e.g. `▲ 90` for North). Cycle modes via re-click on the Δ lozenge if cycling is in the renderer; otherwise via API. Click Δ again to remove with byte-identical DOM.

### Tests for User Story 3

- [ ] T028 [P] [US3] Unit test compare math at `src/enrichments/__tests__/compare-column.test.ts`: cover (a) absolute delta `B − A`, (b) relative delta, (c) percent with non-zero divisor, (d) zero divisor → `'—'` placeholder per `010` FR-010, (e) non-numeric operand → `'—'` per `010` FR-009, (f) direction glyph (`▲`/`▼`/`=`) matches sign, (g) `exporter` parity.
- [ ] T029 [P] [US3] Playwright e2e at `tests/e2e/virtual-column-compare.spec.ts`: click Δ → click column A → click column B → assert appended column header `'Δ <B> − <A>'` + per-row values; click Δ again for removal + DOM snapshot equality.

### Implementation for User Story 3

- [ ] T030 [P] [US3] Implement the compare picker overlay at `src/ui/compare-picker.ts`: highlights numeric column headers, captures two clicks, returns `(colKeyA, colKeyB)`, supports Escape to cancel. Keyboard-operable per constitution §III.
- [ ] T031 [US3] Implement the compare renderer at `src/enrichments/compare-column.ts`: `Renderer<CompareDirective>` with `canActivate` (both columns numeric), `renderCell` (delta + colour + glyph per FR-014), `exporter`. Self-registers. Depends on T030.
- [ ] T032 [US3] Extend `src/ui/virtual-column-lozenges.ts` with the Δ lozenge factory: click invokes the picker (T030), then calls `activateDirective`. Click while active cycles modes (`abs → rel → percent`) via `mutateDirective`; long-press or Escape removes. Skip tables with `data-gs-ignore` or `data-gs-no-compare`. Depends on T008, T031.
- [ ] T033 [US3] Wire compare module load into `src/index.ts` and add `addCompare` to `window.gridSight.virtualColumns`.
- [ ] T034 [P] [US3] Add a Storybook story `src/stories/compare-column.stories.ts` exercising activation, the three modes, and the zero-divisor / non-numeric edge cases.

**Checkpoint**: All three renderers exist. Canonical ordering (US6) is observable end-to-end as soon as any two are active.

---

## Phase 6: User Story 4 - Sparkline hover, focus, tooltip, header highlight (Priority: P2)

**Goal**: Sparkline cells are focusable; hover or focus shows a tooltip with min/max/last and highlights the source-column headers that contributed to the chart.

**Independent Test**: With the sparkline column active, focus a sparkline cell with `Tab`, then press arrow keys to navigate between rows; assert the tooltip appears and the source-column headers show a highlight class. Mouse hover triggers the same behaviour.

### Tests for User Story 4

- [ ] T035 [P] [US4] Unit test the tooltip + header-highlight wiring at `src/enrichments/__tests__/sparkline-interactions.test.ts`: dispatch `focus` / `blur` / `mouseenter` / `mouseleave` on a sparkline `<td>` and assert (a) tooltip text matches the row's min/max/last, (b) the affected `<th>`s gain/lose a documented CSS class, (c) Escape dismisses the tooltip without un-focusing the cell.
- [ ] T036 [P] [US4] Playwright e2e at `tests/e2e/virtual-column-sparkline-tooltip.spec.ts`: keyboard-only flow (`Tab` to a sparkline cell, arrow-navigate, assert tooltip via accessible name).

### Implementation for User Story 4

- [ ] T037 [US4] Extend `src/enrichments/sparkline-column.ts` with focus/hover handlers, tooltip element creation (single per-table tooltip reused across cells), arrow-key navigation between sparkline cells in the same column, and source-column header highlight via class toggling. `aria-describedby` links the focused cell to the tooltip per `research.md` §R-10. Depends on T024.

**Checkpoint**: Sparkline now satisfies its accessibility + interaction stories. US5 layers the scaling toggle on top.

---

## Phase 7: User Story 5 - Sparkline per-row vs shared scaling (Priority: P2)

**Goal**: A mode toggle near the `Trend` header flips between per-row (default) and shared scaling; the state is persisted (URL round-trip lands in US7).

**Independent Test**: With the sparkline column active, click the scale-toggle button — every row's chart re-scales against the table's max across un-dimmed rows. Click again to flip back. State is held in the `SparklineDirective.scale` field.

### Tests for User Story 5

- [ ] T038 [P] [US5] Unit test shared-scale computation at `src/enrichments/__tests__/sparkline-scale.test.ts`: cover (a) per-row scale uses each row's own max, (b) shared scale uses the global max across `state === 'visible'` rows from the Visible Row Sequence, (c) flipping mode mutates the directive and triggers an in-place `<rect>` attribute update (no full re-render).
- [ ] T039 [P] [US5] Playwright e2e at `tests/e2e/virtual-column-sparkline-scale.spec.ts`: activate sparkline, click the scale-toggle, assert charts in different rows now share scaling visually (snapshot of bar heights).

### Implementation for User Story 5

- [ ] T040 [US5] Extend `src/enrichments/sparkline-column.ts` to support `scale: 'shared'`: compute the shared max once per render, mutate `<rect>` `y` / `height` attributes in place rather than rebuilding the SVG. Add the scale-toggle button next to the `Trend` `<th>` (built by the scaffold's header-cell hook). Depends on T024, T037.

**Checkpoint**: Sparkline carries all three of its source-spec stories. Foundation is ready for US6, US7, US8 — which are scaffold-property and pipeline-integration stories rather than new renderers.

---

## Phase 8: User Story 6 - Multiple virtual columns coexist in a defined order (Priority: P2)

**Goal**: Verify the canonical-order invariant holds across activation, removal, and pipeline events when all three renderer kinds are present.

**Independent Test**: Activate Σ Weight, Σ Cost, Δ Q1/Q4, ⌇ Trend. Assert appended-column order = `[Σ Weight, Σ Cost, Δ Q4 − Q1, Trend]`. Remove Σ Weight; assert order = `[Σ Cost, Δ Q4 − Q1, Trend]` with no other column moving more than one position. This is SC-007.

### Tests for User Story 6

- [ ] T041 [P] [US6] Unit-level integration test at `src/enrichments/__tests__/virtual-column-ordering.test.ts`: activate two cumulatives in a chosen order + compare + sparkline against a fake jsdom table; assert the appended-column DOM order matches the canonical sequence after every activation and after each removal.
- [ ] T042 [P] [US6] Playwright e2e at `tests/e2e/virtual-column-ordering.spec.ts`: full-stack version of T041 against a real fixture page, with US6 AS1 / AS2 / AS3 as separate test cases.

### Implementation for User Story 6

- [ ] T043 [US6] Verify the scaffold's `sortCanonical` is invoked on every directive mutation; add a guard (in non-production builds) that asserts `registry.directives` matches `sortCanonical(registry.directives)` after every public mutation. Production builds skip the assertion. No new feature code beyond the guard — T006 / T008 already produced the implementation.

**Checkpoint**: SC-007 verified. US7 and US8 are independent of US6.

---

## Phase 9: User Story 7 - Persist and share every appended column via URL (Priority: P2)

**Goal**: Every directive mutation writes to the URL fragment under `gs.vc`; restoration on init applies surviving directives within one animation frame after first paint; missing tables / columns / rows silently drop their directives (FR-VC-009); order-violating URLs are re-canonicalised (FR-VC-010).

**Independent Test**: Activate Σ + ⌇ + Δ on a fixture, copy the URL, open it in a new browser context, assert all three columns restore with identical values. Then manually edit the URL to reverse the directive order — assert canonical order is still applied.

### Tests for User Story 7

- [ ] T044 [P] [US7] Round-trip unit test at `src/enrichments/__tests__/virtual-column-url-roundtrip.test.ts`: build a `PersistedVirtualColumnState`, encode, decode, assert equality; cover multi-table blocks and the unknown-prefix-ignored rule.
- [ ] T045 [P] [US7] Playwright e2e at `tests/e2e/virtual-column-url-share.spec.ts`: full lifecycle — activate three variants, read `location.hash`, navigate a fresh page to that URL, assert restoration within one rAF (probed via `performance.now()` before and after first paint).

### Implementation for User Story 7

- [ ] T046 [US7] Extend `src/enrichments/virtual-column.ts` to call `encodeFragment` after every successful `activateDirective` / `mutateDirective` / `removeDirective`, updating `location.hash` via the same per-page namespace helper the slider feature uses (read `src/utils/slider-persistence.ts` for the established URL-merging pattern; do NOT touch the `gs.s` namespace). Depends on T008, T007.
- [ ] T047 [US7] Add `restoreFromUrl()` to `src/enrichments/virtual-column.ts`, invoked once from `gridSight.init` after table scan completes: parse the fragment, drop invalid directives (missing table / column / row), re-canonicalise the remainder, and `activateDirective` each one inside a single `requestAnimationFrame` callback so restoration completes within one paint (SC-003). Depends on T046.
- [ ] T048 [US7] Update `src/index.ts` to call `restoreFromUrl()` after the existing init pipeline. Document the `virtualColumns.persistInUrl` / `virtualColumns.urlParam` init options per `contracts/public-api.md` §1 (defaults preserve current behaviour; opt-out is a no-op in v1).

**Checkpoint**: URL sharing works end-to-end. Detach still leaves URL state intact (FR-VC-012, already in scaffold).

---

## Phase 10: User Story 8 - Cooperate with the visible-row pipeline (Priority: P2)

**Goal**: When the Visible Row Sequence emits a change event, every renderer recomputes in dependency order within one animation frame. Cumulative columns exclude dimmed rows from accumulation; shared-scale sparkline recomputes against the un-dimmed subset; compare-column per-row deltas follow their rows.

**Independent Test**: With a mock VRS installed in Playwright, fire a sort event followed by a filter event in the same tick; assert (a) all appended cells move with their rows, (b) cumulative values reflect the new sequence, (c) sparkline shared-scale recomputes, (d) only one rAF callback fires for the batched events.

### Tests for User Story 8

- [ ] T049 [P] [US8] Build the Playwright VRS mock helper at `tests/e2e/helpers/mock-vrs.ts`: exposes `installMockVrs(page, { events })` that replaces `getVisibleRows` with a mock pipeline emitting the supplied event sequence. The helper is removed when `002-003-row-visibility` lands; design it as a thin shim around the stub.
- [ ] T050 [P] [US8] Playwright e2e at `tests/e2e/virtual-column-pipeline.spec.ts` using T049: activate all three variants, fire a sort + filter pair, assert the AS1 / AS2 outcomes from US8.
- [ ] T051 [P] [US8] Unit test the fan-out ordering at `src/enrichments/__tests__/virtual-column-pipeline.test.ts`: install a synchronous `requestAnimationFrame` mock, fire a sequence of VRS events, assert renderers receive `onPipelineChange` in the order cumulative → compare → sparkline, and exactly one rAF callback per event batch.

### Implementation for User Story 8

- [ ] T052 [US8] Extend `src/enrichments/virtual-column.ts` to subscribe to `getVisibleRows(table).subscribe(...)` on first activation per table and unsubscribe on last detach. On each event, queue a single `requestAnimationFrame` callback that walks `registry.directives` in canonical order, calling each renderer's `onPipelineChange` with the new sequence. Coalesce multiple events in the same tick into one callback. Depends on T008, T004.
- [ ] T053 [US8] Update each renderer's `onPipelineChange` for pipeline-aware behaviour: cumulative recomputes over the new visible sequence excluding `'dimmed'` rows; compare iterates the new sequence row-by-row; sparkline (per-row mode) is a no-op (the rAF moves cells with their rows automatically), shared-scale mode recomputes the global max over `'visible'` rows. Depends on T015, T024, T031, T040, T052.

**Checkpoint**: All eight user stories complete. The feature is ready for the polish phase.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Verify the cross-cutting success criteria (SC-002, SC-005, SC-006, bundle ceiling) that span all renderers, plus public-API completeness and documentation.

- [ ] T054 [P] Public API: ensure every `window.gridSight.virtualColumns` method (`addCumulative`, `addSparkline`, `addCompare`, `remove`, `removeAll`, `list`) is implemented and matches the signatures in `contracts/public-api.md` §2. Add unit tests at `src/__tests__/public-api-virtual-columns.test.ts`.
- [ ] T055 [P] SC-005 byte-identical-DOM verification: extend `tests/e2e/virtual-column-cumulative.spec.ts`, `virtual-column-sparkline.spec.ts`, and `virtual-column-compare.spec.ts` (already include single-renderer detach snapshots from T014/T021/T029) with a combined-detach test — activate all three, then call `gridSight.toggleOff()`, then snapshot-compare against the pre-activation DOM. Asserts SC-005 globally.
- [ ] T056 [P] SC-006 accessibility audit: add `tests/e2e/virtual-column-a11y.spec.ts` running an automated audit (axe via `@axe-core/playwright` if present, else a hand-rolled walk over `[data-gs-virtual-column]` cells) asserting zero empty `aria-label` / accessible-name failures across all three variants on fixture tables.
- [ ] T057 SC-002 perf check on real Chromium: add a Playwright perf test at `tests/e2e/virtual-column-perf.spec.ts` against a 1 000 × 10 fixture, asserting (a) sparkline initial render < 200 ms, (b) cumulative / compare / mode-flip < 100 ms, (c) URL restoration visible within one rAF after first paint (SC-003).
- [ ] T058 [P] Bundle-size budget check: extend `scripts/bundle-size.js` (or add a sibling assertion) to fail if the total IIFE bundle exceeds 10 KB gzipped (constitution §I) and to log the per-module breakdown against the sub-budgets in `research.md` §R-7.
- [ ] T059 [P] Walk through `quickstart.md` end-to-end on the built bundle (`yarn build && yarn preview:demo`): manual confirmation that every section's instructions produce the documented outcome. Note any drift in the spec's checklist file.
- [ ] T060 [P] Reconcile `README.md`: the constitution's Sync Impact Report flagged a `"Zero dependencies"` claim that conflicts with `shepherd.js` + `simple-statistics`. Since this feature adds no runtime deps, this is not regression but the existing copy still mis-states reality. Update the README to match.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories.** T008 (scaffold core) depends on T003 / T004 / T005 / T006; T011 (scaffold tests) depends on T008.
- **US1 (Phase 3) and US2 (Phase 4)**: Both depend only on Foundational. Independent of each other — can ship in parallel.
- **US3 (Phase 5)**: Depends on Foundational. Independent of US1 and US2.
- **US4 (Phase 6) and US5 (Phase 7)**: Both layer onto US2 (sparkline) but are independent of each other. US4 must precede US5 only because the scale-toggle UI shares the tooltip's positioning code; minor dependency, can be inverted with small effort.
- **US6 (Phase 8)**: Property of the scaffold + ≥ 2 renderers. Depends on Foundational + any two of US1/US2/US3.
- **US7 (Phase 9)**: Depends on Foundational. Can ship before any renderer (URL state is empty until directives exist), but its tests need at least one renderer for end-to-end coverage.
- **US8 (Phase 10)**: Depends on Foundational. Can ship before any renderer (no-op fan-out), but its tests need all three renderers for AS1 / AS2 coverage.
- **Polish (Phase 11)**: Depends on every user story being complete.

### User Story Dependencies

- **US1 (P1)** ↔ **US2 (P1)**: Independent. Either alone is MVP.
- **US3 (P2)**: Independent of US1 / US2.
- **US4 (P2)** depends on **US2**.
- **US5 (P2)** depends on **US2** (and minor coupling to **US4**, see above).
- **US6 (P2)** depends on **US1 + US2** (or any two renderers).
- **US7 (P2)**: Independent at code level; tests need at least one renderer.
- **US8 (P2)**: Independent at code level; tests need all three renderers.

### Within Each User Story

- Tests are written before or alongside implementation, per constitution §II.
- Renderers register against the scaffold; no model-vs-service split (this is a browser library, not a service).
- e2e tests run last within a story (they need the renderer + lozenge wiring to exist).

### Parallel Opportunities

- **Setup**: T002 ∥ T003.
- **Foundational**: T004 ∥ T005 ∥ T006 ∥ T007. Then T008 (single integrator). Then T009 ∥ T010 ∥ T011 ∥ T012.
- **US1**: T013 ∥ T014 ∥ T015 ∥ T018 (different files); T016 → T017.
- **US2**: T019 ∥ T020 ∥ T021 ∥ T022 ∥ T023 ∥ T027; T024 → T025 → T026.
- **US3**: T028 ∥ T029 ∥ T030 ∥ T034; T031 → T032 → T033.
- **US4**: T035 ∥ T036; T037.
- **US5**: T038 ∥ T039; T040.
- **US6**: T041 ∥ T042; T043.
- **US7**: T044 ∥ T045; T046 → T047 → T048.
- **US8**: T049 ∥ T050 ∥ T051; T052 → T053.
- **Polish**: T054 ∥ T055 ∥ T056 ∥ T058 ∥ T059 ∥ T060; T057 sequential after the renderers are present.

---

## Parallel Example: User Story 2 (Sparkline)

```bash
# After Foundational (Phase 2) lands, the sparkline story can be staffed across
# several agents in parallel:
Task: "Unit test the SVG builder at src/enrichments/__tests__/sparkline-svg.test.ts" (T019)
Task: "Unit test the sparkline renderer at src/enrichments/__tests__/sparkline-column.test.ts" (T020)
Task: "Playwright e2e at tests/e2e/virtual-column-sparkline.spec.ts" (T021)
Task: "Perf smoke test at src/enrichments/__tests__/sparkline-perf.test.ts" (T022)
Task: "Implement src/enrichments/sparkline-svg.ts" (T023)
Task: "Add Storybook story src/stories/sparkline-column.stories.ts" (T027)

# Then sequentially:
Task: "Implement renderer in src/enrichments/sparkline-column.ts" (T024 — depends on T023)
Task: "Add ⌇ lozenge factory in src/ui/virtual-column-lozenges.ts" (T025 — depends on T024)
Task: "Wire module load into src/index.ts" (T026 — depends on T025)
```

---

## Implementation Strategy

### MVP First (US1 ∪ US2)

1. Phase 1 (Setup) — small, parallelisable.
2. Phase 2 (Foundational) — the scaffold. **Critical path.**
3. Phase 3 (US1 — cumulative) OR Phase 4 (US2 — sparkline), whichever the demo needs first.
4. **STOP and VALIDATE**: single-renderer flow on a real fixture page.
5. Ship the MVP. Either renderer alone is demo-able.

### Incremental Delivery (recommended)

1. MVP = Setup + Foundational + US1 + US2 → first cut covers the two P1 stories on the public API.
2. Add US3 (compare-column) → P2 renderer set complete.
3. Add US4 + US5 (sparkline interactions) → sparkline feels finished.
4. Add US6 (ordering tests) → property-test pass on canonical layout.
5. Add US7 (URL persistence) → shareable views.
6. Add US8 (pipeline cooperation, with mock VRS) → ready for the day `002-003-row-visibility` lands.
7. Polish phase → constitution gates and quickstart validation.

### Parallel Team Strategy

With 2–3 developers after Phase 2 lands:

- Dev A: US1 (cumulative) → US3 (compare) → US7 (URL persistence).
- Dev B: US2 (sparkline) → US4 (interactions) → US5 (scaling).
- Dev C (if available): US6 (ordering tests) → US8 (pipeline + mock VRS) → Polish.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps each user-story task to its story for traceability.
- The two **stub modules** (`utils/visible-rows.ts`, `utils/copy-as-csv-registry.ts`) are first-class deliverables here; the eventual real implementations of `002-003-row-visibility` and `009-copy-as-csv` will replace those files in-place without touching `enrichments/`.
- Detach byte-equality (SC-005) is asserted by snapshot-diff in T011 (scaffold) and combined-detach in T055 (Polish).
- Bundle ceiling (constitution §I) is asserted by T058 in Polish; per-module budgets in `research.md` §R-7 should be checked as each renderer's PR lands.
