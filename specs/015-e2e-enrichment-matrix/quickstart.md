# Quickstart: E2E Enrichment Coverage Matrix

## Run it

```bash
# One-time: install the extra browser engines (Chromium ships already)
npx playwright install firefox webkit

# Build dist/ then run the whole suite (one shared server, fully parallel,
# all three engines) + the runtime gate
yarn test:e2e

# Just the new specs, one engine
yarn build
npx playwright test tests/e2e/enrichment-matrix.spec.ts \
  tests/e2e/enrichment-permutations.spec.ts --project=chromium

# The harness's pure-logic unit tests (fast, no browser)
yarn test tests/e2e/helpers/__tests__
```

The suite now uses **one** `vite preview` `webServer` (declared in
`playwright.config.ts`) and runs `fullyParallel` with `workers > 1` across
`chromium`, `firefox`, `webkit`. No spec boots its own server.

## What runs

- **`enrichment-matrix.spec.ts`** — one `test()` per discovered demo; a `test.step`
  per offered enrichment enables it via the toggle panel and asserts active or
  disabled-lozenge state (weak, runtime-derived), then a relative round-trip
  teardown. The curated `public/demo/matrix/index.html` adds **authored** oracle
  checks (identifier columns not summed; annotated-numeric keeps sort/filter). It
  also carries the migrated capability-filtering **precedence** (Set-equality) checks.
- **`enrichment-permutations.spec.ts`** — maximal pairwise combos + one rich combo
  on the opt-in playground, with concrete interaction asserts (filter→summary
  recompute; sort→aggregate stable; find highlights survive a filter) and joint
  byte-identical teardown.

## Extending coverage (no test edits needed)

| You did this | What happens automatically |
|--------------|----------------------------|
| Added a demo page under `public/demo/**` with `window.gridSight` + a `<table>` | `discoverDemoPages()` finds it; a matrix `test()` runs with a step per offered enrichment. |
| Added an enrichment id to a demo's `pageConfig.enrichments` | The page's `offered` set grows; a new step runs. |
| Registered a brand-new enrichment | It appears in `enrichmentIds`; opt-in pages offer it and the pairwise sweep includes it. |

There is **no** `ENRICHMENT_CLASSES` table to maintain — the weak oracle reads the
library's own rendered lozenge state at runtime (review 2C). The only authored
data is the curated fixture's `ColumnOracle`, guarded for consistency (12A).

## Adding a perf/large demo

Large fixtures are **excluded** from the matrix (they have dedicated perf specs).
Name it `*fixture*.html`, place it under a perf path, or let the row-count
threshold exclude it. Add focused perf coverage in its own spec instead.

## Adding an oracle column to the curated fixture

1. Add the column to `public/demo/matrix/index.html` (`#matrix-table`).
2. Add its `ColumnOracle` row (`header`, `kind`, `annotated`) in the spec.
3. `yarn test:e2e` — the consistency guard (12A) fails if the header doesn't
   resolve; the strong oracle now covers it.

## The runtime gate

`scripts/e2e-runtime-gate` fails the build if the suite wall-clock exceeds
`E2E_BUDGET_SECONDS`. If you legitimately added a lot of coverage, raise the budget
deliberately (like the bundle-size ceiling) — don't silently let CI slow down.

## Sanity checks (integration spine)

1. Reintroduce the #48 defect (identifier column parses numeric) → at least one
   **strong** matrix assertion fails (SC-002). Revert.
2. Add a throwaway demo offering one enrichment, run without editing specs → a new
   `test()` appears (SC-004). Remove it.
3. Run with `--project=firefox` and `--project=webkit` → both green (SC-008).
