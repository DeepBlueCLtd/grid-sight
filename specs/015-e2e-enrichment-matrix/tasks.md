---
description: "Task list for spec 015 — End-to-End Enrichment Coverage Matrix"
---

# Tasks: End-to-End Enrichment Coverage Matrix

**Input**: Design documents from `/specs/015-e2e-enrichment-matrix/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: This feature *is* tests. The "implementation" tasks below are the e2e/
unit specs and the harness they run on; there is no separate "write tests first"
layer. Per Principle II the whole suite (existing + new) MUST be green at merge.

**Organization**: Grouped by user story (US1–US4) in the dependency order the plan
requires. **US4's shared-webServer migration is foundational** — US1/US2 cannot run
parallel matrix cases without it — so the webServer move + harness helpers land in
Phase 2 (Foundational), and US4's remaining pieces (cross-browser projects, runtime
gate) form their own late phase.

## PR split

This feature ships as **two stacked PRs** to keep the ~38-file migration reviewable
apart from the new matrix behaviour:

- **PR A — Foundational migration** (`claude/pending-tasks-NGcyT`, PR #51): the
  planning artifacts plus **Phase 1–2** (T001–T019, helpers T007–T009a). Pure
  de-risking refactor — shared `webServer`, parallel execution, harness helpers,
  every existing spec migrated. No new matrix behaviour; behaviour-preserving, gated
  by T019 (full suite parallel-green on chromium) + the helper unit tests.
- **PR B — Matrix & coverage** (branched off PR A): **Phase 3–7** (T020+) — the
  per-demo matrix, permutation sweep, self-extending coverage, cross-browser projects,
  the new e2e CI job, and the runtime gate.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task).
- Paths are exact, per `plan.md` Source Code layout.

## Path notes

- Config → `playwright.config.ts`; harness → `tests/e2e/helpers/`; harness units →
  `tests/unit/e2e-helpers/` (Vitest; see T009a impl note); new specs → `tests/e2e/`; curated fixture →
  `public/demo/matrix/index.html`; runtime gate → `scripts/e2e-runtime-gate.mjs`.
- **Shared files (NOT [P])**: `playwright.config.ts` (T004 then T033),
  `package.json` scripts (T037), the e2e CI workflow (T002, T037a, T037), and every
  migrated existing spec touches its own file (so the migration tasks ARE mutually
  [P], but each is one file).

---

## Phase 1: Setup (Shared)

- [x] T001 Record the pre-change e2e baseline: run `yarn test:e2e` (serial, chromium)
  and note pass count + wall-clock in the PR as the migration's green baseline; run
  `yarn test` to confirm the Vitest suite is green. No code change.
- [x] T002 [P] Install the extra browser engines for local runs:
  `npx playwright install firefox webkit`; document the command in
  `specs/015-e2e-enrichment-matrix/quickstart.md` (already present) and in the PR. (CI
  installs them in the new e2e job — T037a.)
- [x] T003 Inventory the per-file preview servers: list every spec under `tests/e2e/`
  that defines a `beforeAll` `vite preview` + hardcoded `PORT`/`BASE` (survey: 38 of
  39). Capture the list in a scratch note for the migration phase (T010–T019).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the shared webServer + the harness helpers that every later story
depends on. Nothing in US1–US3 can run until this phase is green.

### Shared Playwright webServer + parallel migration (FR-013/014) — `contracts/e2e-runner.md`

- [x] T004 Convert `playwright.config.ts` to a single shared `webServer` (one
  `vite preview` on a fixed port), set `use.baseURL`, `fullyParallel: true`, and
  `workers > 1`; keep the `chromium` project only for now (Firefox/WebKit added in
  Phase 6). *(shared file)*
- [x] T005 Implement `tests/e2e/helpers/isolation.ts` `isolateState(page)`
  (clear/namespace `localStorage` + URL state) and `installOfflineGuard(page)` (fail
  on any non-local request) per `contracts/test-helpers.md`. Depends: none.
- [x] T006 Implement `tests/e2e/helpers/gridsight-window.ts` — the typed
  `GridSightWindow` accessor (reusing `EnrichmentId` from
  `src/core/enrichment-registry.ts`) so specs avoid `(window as any)`. Depends: none.
- [x] T010 [P] Migrate annotations specs (`annotations*.spec.ts`, 7 files) off their
  `beforeAll` preview to `baseURL` + relative `goto`, add `isolateState` in
  `beforeEach`; each file independently. Depends: T004, T005.
- [x] T011 [P] Migrate slider specs (`slider-*.spec.ts`) the same way. Depends: T004, T005.
- [x] T012 [P] Migrate virtual-column specs (`virtual-column-*.spec.ts`) the same way.
  Depends: T004, T005.
- [x] T013 [P] Migrate outlier specs (`outlier*.spec.ts`) the same way. Depends: T004, T005.
- [x] T014 [P] Migrate sort/filter specs (`sort*.spec.ts`, `filter.spec.ts`) the same
  way. Depends: T004, T005.
- [x] T015 [P] Migrate `navigation-and-analysis.spec.ts` the same way. Depends: T004, T005.
- [x] T016 [P] Migrate `demo.spec.ts`, `heatmap.spec.ts`, `view-state-url.spec.ts`,
  `row-visibility-a11y-smoke.spec.ts` the same way. Depends: T004, T005.
- [x] T017 [P] Migrate `capability-filtering-toggle.spec.ts` the same way. Depends: T004, T005.
- [x] T018 Migrate any remaining `beforeAll`-preview specs found in T003 not covered
  by T010–T017; grep to confirm **zero** `import('vite')`/`preview(` remain in
  `tests/e2e/*.spec.ts` except via the config. Depends: T010–T017.
- [x] T019 Run the full suite parallel on chromium (`yarn test:e2e`); fix any
  flakiness exposed by parallelism via `isolateState` (FR-014) until green. This is
  the gate that the migration preserved behaviour. Depends: T018.

### Harness helpers + their unit tests (D9) — `contracts/test-helpers.md`

> **Ordering note**: T007–T009a are numbered after the migration (T010–T019) but
> are **independent of it** — they touch different files and run in parallel with
> the migration once T006 lands. US1 (T024) needs both the migration green (T019)
> and the helpers (T007–T009) done.

- [x] T007 [P] Implement `tests/e2e/helpers/demo-discovery.ts`:
  `includeDemo(relPath, contents)` (pure — keep gridSight+`<table>` pages, exclude
  `*fixture*` and perf/large per D13), `discoverDemoPages()`, and `readPageProfile`
  (offered = `pageConfig.enrichments || enrichmentIds`). Depends: T006.
- [x] T008 [P] Implement `tests/e2e/helpers/toggle-panel.ts`: `raf`,
  `setEnrichment(page,id,on)`, and placement-aware `hasActiveLozenge`/
  `hasDisabledLozenge` (consult headerType — table-level corner vs column, D5/3A).
  Depends: T006.
- [x] T009 [P] Implement `tests/e2e/helpers/teardown.ts`
  (`snapshotTable`, `expectRoundTrip`, `expectNoArtifacts`, pure
  `normalizeForCompare` that never strips `gs-*`, D7/6A/7A) and
  `tests/e2e/helpers/applicability.ts` (`observedState` weak oracle 2C, pure
  `pairwise<T>` D12). Depends: T006.
- [x] T009a [P] Vitest units in `tests/unit/e2e-helpers/`: `pairwise.test.ts`
  (completeness, no self/dup, stable order), `demo-discovery.test.ts` (`includeDemo`
  excludes fixtures/perf/table-less), `teardown-normalize.test.ts`
  (`normalizeForCompare` collapses benign diffs but preserves every `gs-*`
  attr/class/node). Depends: T007, T009. *(satisfies review 9A)*
  **Impl note**: located under `tests/unit/` (not `tests/e2e/helpers/__tests__/` as the
  contract sketched) because `vitest.config.ts` excludes `tests/e2e/**` and Playwright's
  `testMatch` is pinned to `*.spec.ts` — so `*.test.ts` runs only under Vitest, never
  the Playwright runner.

**Checkpoint**: suite runs parallel & green on chromium; helpers exist and their
pure logic is unit-tested. US1–US3 unblocked.

---

## Phase 3: User Story 1 — Per-demo matrix (Priority: P1) 🎯 MVP

**Goal**: every offered enrichment exercised on every demo; #48 mis-typing class
caught by the curated fixture; byte-identical teardown.

**Independent Test**: run `enrichment-matrix.spec.ts` alone (chromium) — each demo
gets a test, each offered enrichment a step; reintroducing the `S-001` defect fails
a strong-oracle assertion.

- [x] T022 [P] [US1] Create the curated fixture `public/demo/matrix/index.html` per
  `contracts/matrix-fixture.md`: `#matrix-table` with `Sample ID` (identifier
  `S-001…`), `Assay (mg)` (numeric, ≥1 blank), `Status` (categorical), `Reading`
  (numeric + annotated cells), `Notes` (text); `pageConfig.enrichments: []`,
  `showToggleUi: true`; nav bar consistent with siblings; no network refs.
- [x] T023 [US1] Add the matrix card to `public/index.html` (consistency with
  sibling demos). *(shared file)* Depends: T022.
- [x] T024 [US1] Implement `tests/e2e/enrichment-matrix.spec.ts` weak layer: one
  `test()` per `discoverDemoPages()` entry, a `test.step` per offered enrichment that
  `setEnrichment` on → asserts `observedState` is active|inapplicable (never throws)
  with `aria-disabled` on disabled lozenges → relative round-trip teardown
  (`expectRoundTrip` + `expectNoArtifacts`). Covers SC-001. Depends: T007, T008, T009.
- [x] T025 [US1] Add the strong layer for `public/demo/matrix/index.html`: authored
  `ColumnOracle` table in the spec; assert identifier column is NOT summed by
  `summary-row` and offers no numeric slider; numeric columns active; categorical/
  text show disabled lozenge; annotated-numeric keeps sort+filter affordances.
  Covers SC-002. Depends: T024, T022.
- [x] T026 [US1] Add the fixture↔oracle consistency guard (12A): every
  `ColumnOracle.header` MUST resolve to a column in `#matrix-table`, else fail.
  Depends: T025.
- [x] T027 [US1] Add the FR-009 gap guard: a curated-fixture pairing with no
  oracle/expectation fails (or flagged-skips) — never silently passes. Covers SC-005.
  Depends: T025.
- [x] T028 [US1] Run `enrichment-matrix.spec.ts` green on chromium; manually verify
  SC-002 by temporarily reintroducing the identifier-as-numeric defect and confirming
  a failure, then revert. Depends: T024–T027.

**Checkpoint**: MVP — the matrix catches the #48 regression class and tears down clean.

---

## Phase 4: User Story 2 — Per-permutation interaction sweep (Priority: P2)

**Goal**: maximal pairwise + a rich combo on the opt-in playground prove
non-interference and joint byte-identical teardown.

**Independent Test**: run `enrichment-permutations.spec.ts` alone — pairwise combos
plus the rich combo pass, with concrete cross-behaviour assertions.

- [x] T029 [US2] Implement `tests/e2e/enrichment-permutations.spec.ts` on
  `public/demo/toggle/opt-in-playground.html`: generate `pairwise(offered)` combos +
  one curated rich combo (`summary-row`, `sort`, `filter`, sliders, virtual columns,
  annotations, `find-in-table`); for each, enable members, assert concrete
  interactions (10A — filter recomputes the `summary-row` aggregate over visible
  rows; sort leaves the aggregate stable; `find-in-table` highlights survive a
  filter), then disable all and assert relative round-trip teardown. Covers SC-003.
  Depends: T008, T009.
- [x] T029a [US2] Ensure the playground fixture has data that exercises the rich
  combo (numeric + categorical + enough rows); enrich
  `public/demo/toggle/opt-in-playground.html` only if needed (FR-012). Depends: T029.

**Checkpoint**: combined enrichments proven non-interfering under composition.

---

## Phase 5: User Story 3 — Self-extending coverage + capability-filtering fold-in (Priority: P3)

**Goal**: coverage derives from the filesystem + runtime config; the
capability-filtering precedence checks are preserved inside the harness.

**Independent Test**: add a throwaway demo offering one enrichment, run without
editing specs → a new `test()` appears and runs.

- [ ] T030 [US3] Fold `capability-filtering.spec.ts`'s demo→effective-set cases into
  the discovery harness (4B): for each discovered demo assert **Set-equality** of
  `enrichmentIds.filter(isEnrichmentEnabled)` vs the offered set (11A — exactly
  these, no extras). Add as a `PrecedenceCase` block in `enrichment-matrix.spec.ts`.
  Depends: T024.
- [ ] T031 [US3] Delete the now-duplicated hand-listed cases from
  `tests/e2e/capability-filtering.spec.ts` (keep the file only if it has unique
  non-migrated assertions; otherwise remove it) and confirm no precedence coverage is
  lost vs the T001 baseline. *(shared/removed file)* Depends: T030.
- [ ] T032 [US3] Verify self-extension end-to-end: temporarily add a throwaway demo
  under `public/demo/` offering one enrichment, run the matrix without editing any
  spec, confirm a new `test()` runs (SC-004), then remove the throwaway. Depends: T024.

**Checkpoint**: matrix self-extends; precedence coverage retained, hand-list gone.

---

## Phase 6: User Story 4 — Cross-browser + runtime gate (Priority: P4)

**Goal**: the new specs run on three engines and CI fails over a wall-clock budget.

**Independent Test**: `--project=firefox` and `--project=webkit` pass for the
matrix and permutation specs; an artificially slow run trips the gate.

- [ ] T033 [US4] Add `firefox` and `webkit` projects to `playwright.config.ts`
  alongside `chromium` (FR-015); run the matrix + permutation specs unfiltered on all
  three; project-scope long-running existing specs to chromium if needed to bound
  runtime. Covers SC-008. *(shared file)* Depends: T019, T024, T029.
- [ ] T034 [US4] Fix or file: triage any genuine Firefox/WebKit failures the new
  cross-engine run surfaces. A **minimal, bounded** `src` fix IS permitted for a real
  library defect (Principle V), but it MUST: be the smallest change that fixes the
  engine bug, re-run `node scripts/bundle-size.js` to confirm it stays under the 10 KB
  ceiling (Principle I — call out any delta in the PR), and land with a regression
  test. If the fix would be large or architectural, file a follow-up issue + project-
  skip with a documented reason instead (no silent `.skip`). Depends: T033.
- [ ] T035 [US4] Implement `scripts/e2e-runtime-gate.mjs` (FR-016): measure full-suite
  wall-clock (Playwright JSON reporter or a wrapping timer) and exit non-zero above
  `E2E_BUDGET_SECONDS`. Depends: T019.
- [ ] T036 [US4] Set `E2E_BUDGET_SECONDS` from the post-migration **parallel**
  baseline (run the full parallel suite, take the measured wall-clock + an agreed
  headroom %); record the number in `scripts/e2e-runtime-gate.mjs` and in
  `spec.md`/`contracts/e2e-runner.md`. Depends: T035, T033.
- [ ] T037a [US4] Add a **new** e2e CI job (FR-011/015/016): the repo currently has
  **no** workflow that runs `yarn test:e2e` — `.github/workflows/storybook-tests.yml`
  installs only `chromium` and runs `yarn test:storybook`. Add a workflow (or a job in
  a new `e2e-tests.yml`) on `pull_request`/`push` to `main` that runs
  `npx playwright install --with-deps chromium firefox webkit` then `yarn test:e2e`,
  uploading `playwright-report/` on failure. Confirm the env network policy permits the
  browser-binary download. Depends: T033.
- [ ] T037 [US4] Wire the runtime gate into the e2e CI job (T037a) — a step after
  `playwright test`, or fold it into the `test:e2e` script in `package.json`; confirm
  it passes within budget and fails when the budget is artificially lowered.
  Covers SC-009. *(shared files: `package.json`, the e2e workflow)* Depends: T035, T036, T037a.

**Checkpoint**: three-engine green; runtime gate enforces SC-009; e2e runs in CI.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T038 Full suite green across all three projects (`yarn test:e2e`) within the
  runtime budget; Vitest green (`yarn test`). Covers SC-006, SC-007. Depends: T033, T037.
- [ ] T039 [P] Confirm zero `src/` runtime/bundle change beyond any T034 cross-browser
  fix: `git diff --stat main -- src/` is empty or only the justified fix; note in PR
  (Principle I — zero bundle delta).
- [ ] T040 [P] Run the `quickstart.md` integration-spine checks (reintroduce-defect →
  fail; throwaway-demo → new case; firefox/webkit green) and tick each in the PR.
- [ ] T041 [P] Update `tests/e2e/helpers/` inline ASCII diagrams for the discovery
  pipeline, the per-demo/per-step state machine, and the two-tier oracle (plan
  "diagram candidates").
- [ ] T042 markdownlint the spec docs on the Codacy-enforced rules
  (`npx markdownlint-cli2 "specs/015-e2e-enrichment-matrix/**/*.md"` — MD004/MD032
  clean) and confirm the PR is green on Codacy.

---

## Dependencies & Execution Order

### Phase order

- **Setup (P1: T001–T003)**: start immediately.
- **Foundational (Phase 2)**: BLOCKS all stories. The webServer migration
  (T004–T019) and helpers (T005–T009a) must be green first.
- **US1 (Phase 3)** → **US2 (Phase 4)** → **US3 (Phase 5)** → **US4 cross-browser/gate
  (Phase 6)** → **Polish (Phase 7)**.

### Critical path

T004 → T005/T006 → (T010–T018 migration) → T019 → T007/T008/T009 → T024 → T025 →
T029 → T030 → T033 → T035 → T036 → T037 → T038.

### Parallel opportunities

- **Migration**: T010–T017 are mutually **[P]** (each edits its own spec file) once
  T004/T005 land.
- **Helpers**: T007/T008/T009 are **[P]** (different files) after T006; T009a after
  T007+T009.
- **Polish**: T039/T040/T041 are **[P]**.
- Helpers (T007–T009) can proceed in parallel with the migration (T010–T018) since
  they touch different files — but US1 (T024) needs both done.

### Shared-file serialization (do NOT parallelize)

- `playwright.config.ts`: T004 → T033.
- `public/index.html`: T023.
- `package.json`: T037.
- `enrichment-matrix.spec.ts`: T024 → T025 → T026 → T027 → T030 (one file, append).

---

## Implementation Strategy

### MVP

Phases 1–3 (Setup → Foundational → US1). That delivers the parallel shared-server
suite **and** the per-demo matrix that catches the #48 regression class — the core
value of issue #50. Ship/validate here before US2+.

### Incremental delivery

US1 → US2 → US3 → US4. The webServer migration is the heaviest, riskiest chunk
(touches ~38 files) and is front-loaded into Foundational precisely because every
later phase depends on a green parallel suite. Cross-browser + the runtime gate come
last so the budget is measured against the final parallel baseline.

---

## Notes

- This feature is test-only; `src/` changes only if T034 surfaces a real
  cross-browser library defect (Principle V) — flagged explicitly if so.
- No new runtime/package dependency. Browser binaries are dev tooling (T002).
- No `.skip` to ship (Principle II); FR-009 gaps fail loudly (T027).
- Keep every checkpoint green; the migration (T019) must match the T001 baseline
  pass count before new specs are judged.
