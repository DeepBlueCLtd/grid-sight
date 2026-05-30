# Phase 0 Research: End-to-End Enrichment Coverage Matrix

All Technical Context items resolve from the existing codebase; no open
`NEEDS CLARIFICATION`. Decisions below incorporate the `/speckit-review` outcomes
(numbered to match the review: 1A, 2C, 3A, 4B, 5A, 6A, 7A, 8A, 9A, 10A, 11A, 12A,
13B, 14A) plus the three scope additions (parallel migration, cross-browser,
runtime gate).

## D1 — Test granularity under runtime discovery *(review 1A)*

- **Decision**: One Playwright `test()` per discovered demo (the file list is
  sync-known at collection time); loop the demo's offered enrichments as
  `test.step` inside, after reading the offered set at runtime.
- **Rationale**: Playwright registers tests at collection time, but the offered set
  is only known after the page loads (D3). Per-demo tests with per-enrichment steps
  give clean reporting without statically parsing HTML.
- **Alternatives considered**:

  - Static-parse `pageConfig.enrichments` from HTML to emit per-pairing tests —
    duplicates the empty-means-all merge rule; rejected.
  - Parameterize off the full `enrichmentIds` — many trivially-inapplicable tests;
    rejected.

## D2 — Demo discovery: filesystem glob *(US3)*

- **Decision**: Glob `public/demo/**/*.html` at collection time; keep files that
  contain `window.gridSight` and a `<table>`; exclude `*fixture*.html` and
  large/perf fixtures (D14).
- **Rationale**: Self-extends as demos are added (FR-007/008); removes the
  hand-listed case arrays that caused issue #50.
- **Alternatives considered**:

  - Hand-listed paths (current pattern) — the rot being fixed; rejected.
  - Manifest file — second source of truth; rejected.

## D3 — Offered set: runtime `pageConfig` *(US3)*

- **Decision**: Read in-page — `pageConfig.enrichments` if non-empty, else
  `enrichmentIds`. Preserved at runtime (`src/index.ts:667`).
- **Rationale**: Single source of truth matching what the library applied.
- **Alternatives considered**: static parse — duplicates merge semantics; rejected.

## D4 — Two-tier applicability oracle *(review 2C + 5A)*

- **Decision**: **Weak layer** (general demos): derive the expected outcome from
  the running library at runtime — assert the rendered lozenge state (active vs
  `gs-lozenge--disabled`) is internally consistent and that enabling never throws.
  **Strong layer** (curated `public/demo/matrix/` fixture only): assert against an
  **authored** `ColumnOracle` (which columns are numeric / categorical /
  identifier, which are annotated).
- **Rationale**: 2C removes the hand-maintained `ENRICHMENT_CLASSES`/`appliesTo`
  mirror that could silently drift. But applying 2C to the curated fixture would be
  circular — the test would expect whatever (possibly wrong) type the library
  inferred, so the #48 regression could never fail. SC-002 requires the strong
  layer's oracle to be **independent** of the code under test.
- **Alternatives considered**:

  - 2C everywhere (incl. fixture) — drops SC-002 protection; rejected.
  - Weak-only, no fixture — loses the targeted `S-001` catch; rejected.
  - Hand-declared classes everywhere — drift risk the review flagged; rejected.

## D5 — Lozenge placement awareness *(review 3A)*

- **Decision**: `hasActiveLozenge`/`hasDisabledLozenge` consult the enrichment's
  header type (table-level corner vs per-column) when locating
  `[data-gs-lozenge-id]`. `find-in-table` mounts a corner/table-level lozenge
  (`src/enrichments/find-in-table.ts:22,139`); column enrichments mount per-column.
- **Rationale**: A flat subtree query risks false positives/negatives across
  placements.
- **Alternatives considered**: query-anywhere (looser); separate helpers
  (more surface) — rejected in favour of one placement-aware helper.

## D6 — Fold capability-filtering into the harness *(review 4B + 11A)*

- **Decision**: Migrate `capability-filtering.spec.ts`'s demo→effective-set cases
  into the discovery harness; **explicitly port its Set-equality precedence
  assertions** (config precedence: exactly the configured ids are enabled, no
  extras) so that coverage is preserved, not dropped.
- **Rationale**: Removes the duplicated hand list (the #50 anti-pattern) while
  keeping the unique precedence guarantee that the behaviour matrix doesn't cover.
- **Alternatives considered**: leave both (drift); drop precedence (coverage loss)
  — rejected.

## D7 — Teardown verification *(review 6A + 7A)*

- **Decision**: **Relative round-trip** — snapshot the data table's `outerHTML`
  immediately *before* toggling enrichment X; toggle off→on; compare to that
  snapshot. Plus: assert no residual `gs-*` artifacts for X while it is off, and a
  **normalized** `outerHTML` compare (the normalizer never strips `gs-*`, so it
  cannot hide a leak).
- **Rationale**: Demos ship enrichments default-on, so there is no absolute
  "enrichment-free" baseline; a relative round-trip is well-defined for every demo
  and matches the proven `navigation-and-analysis.spec.ts:88` pattern. The
  targeted-artifact assertion is the robust backstop; raw byte-equality alone is
  brittle (attribute order, `style=""` vs removed, RAF timing).
- **Alternatives considered**: absolute baseline (undefined for default-on demos);
  raw byte-equality (flaky); targeted-only (may miss a stray node) — rejected.

## D8 — Doc refresh *(review 8A)*

- **Decision**: `quickstart.md` and `contracts/test-helpers.md` are rewritten to
  drop `ENRICHMENT_CLASSES`/`assertEveryIdClassified` (2C) and to describe the
  capability-filtering migration (4B) and the webServer/cross-browser/gate model.
- **Rationale**: Stale onboarding docs would mislead the implementer.

## D9 — Unit-test the pure helpers *(review 9A)*

- **Decision**: Vitest units for the pairwise generator, demo glob/filter, and the
  `outerHTML` normalizer (`tests/e2e/helpers/__tests__/`).
- **Rationale**: These are the most logic-dense, most-likely-wrong parts; a wrong
  generator should fail a fast unit test, not be inferred from a slow matrix.

## D10 — Interaction depth for permutations *(review 10A)*

- **Decision**: Concrete cross-behaviour assertions, not mere coexistence: apply a
  filter and re-read the `summary-row` aggregate over visible rows; sort and
  confirm the aggregate is stable; confirm `find-in-table` highlights survive a
  filter; joint teardown byte-identical.
- **Rationale**: Proves non-interference (the spec-013 invariant the issue cites),
  which "both lozenges present" does not.

## D11 — Fixture↔oracle consistency guard *(review 12A)*

- **Decision**: A guard asserts every authored `ColumnOracle.header` resolves to a
  real column in `#matrix-table`.
- **Rationale**: Renaming a fixture column would silently orphan the oracle.

## D12 — Combination strategy *(review 13B + FR-010)*

- **Decision**: **Maximal pairwise** — every pair over a surface's offered
  enrichments and tables — plus one curated rich combo. Never the full power set.
- **Rationale**: User prioritized coverage; pairwise stays O(n²) (not O(2ⁿ)) so it
  honours FR-010's "no power set," while parallelism + the runtime gate keep it
  affordable.
- **Alternatives considered**: bounded representative pairwise (less coverage);
  full power set (forbidden) — rejected.

## D13 — Exclude perf/large fixtures *(review 14A)*

- **Decision**: Discovery excludes large/perf fixtures (e.g.
  `public/demo/row-visibility/perf-1000.html`, or any table over a row threshold);
  they keep their dedicated specs (`virtual-column-perf.spec.ts`).
- **Rationale**: Per-enrichment `outerHTML` round-trips on a 1000-row table ×16
  enrichments is a runtime cliff and redundant.

## D14 — Global webServer + parallel migration *(scope addition; FR-013/014)*

- **Decision**: Replace the per-file `beforeAll` `vite preview` in **all ~38**
  e2e specs with **one** Playwright `webServer` (single `vite preview`) declared in
  `playwright.config.ts`; set `fullyParallel: true` and `workers > 1`; each spec
  uses `baseURL` instead of a hardcoded port. Specs are made parallel-safe by
  namespacing/clearing `localStorage` and URL state per test (FR-014).
- **Rationale**: The suite is serial today precisely because per-file servers race
  on ports; a single shared server removes the race and unlocks parallelism, which
  is what makes the multiplied matrix affordable. (Survey: 38/39 specs boot their
  own server on ports 3010–3140.)
- **Alternatives considered**:

  - New specs only on the shared server, rest serial — user rejected (mixed model,
    partial speedup); rejected.
  - Keep serial, no migration — matrix wall-clock unacceptable; rejected.
- **Risk/mitigation**: large blast radius — migrate in one mechanical pass, run the
  full suite green before/after; isolate flakiness via `isolation.ts`.

## D15 — Cross-browser projects *(scope addition; FR-015)*

- **Decision**: Add `firefox` and `webkit` projects alongside `chromium` in
  `playwright.config.ts`; the matrix + permutation specs run on all three (other
  specs may stay chromium-scoped via project filters to bound runtime). Browser
  binaries installed via `npx playwright install firefox webkit` (CI step, not a
  package dep).
- **Rationale**: Directly serves Principle V; surfaces engine-specific lozenge/
  teardown differences the Chromium-only suite hides.
- **Risk**: a real Firefox/WebKit library defect → minimal `src` fix or filed
  follow-up (the only path by which this feature might touch `src`).

## D16 — Runtime hard gate *(scope addition; FR-016)*

- **Decision**: `scripts/e2e-runtime-gate` measures the full suite wall-clock (from
  the Playwright JSON/`list` reporter or a wrapping timer) and exits non-zero above
  an **agreed budget** recorded in the script + the spec; wired into `test:e2e`/CI.
- **Rationale**: Coverage-first (D12) + no implicit budget = silent CI inflation;
  the gate makes SC-006/SC-009 enforceable.
- **Open value to set during tasks**: the concrete budget number (seconds),
  measured from the post-migration parallel baseline.

## D17 — Offline guard *(Principle VI)*

- **Decision**: Per-test listener fails on any non-local request; local preview /
  `data:` / `blob:` allowed.
- **Rationale**: Cheap always-on enforcement of air-gap (a hard minimum).
