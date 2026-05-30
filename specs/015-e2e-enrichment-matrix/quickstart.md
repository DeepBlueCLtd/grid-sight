# Quickstart: E2E Enrichment Coverage Matrix

## Run the matrix locally

```bash
# Builds dist/ then runs the whole Playwright suite (includes the new specs)
yarn test:e2e

# Just the new specs (after a build)
yarn build
npx playwright test tests/e2e/enrichment-matrix.spec.ts tests/e2e/enrichment-permutations.spec.ts
```

The new specs start one `vite preview` (port 3160) in `beforeAll` and close it in
`afterAll`. The suite stays serial (`workers: 1`) per the Playwright config.

## What runs

- **`enrichment-matrix.spec.ts`** — for every discovered demo page, enables each
  enrichment the page offers (via the toggle panel) and asserts active behaviour
  *or* the correct disabled/inapplicable lozenge, then asserts byte-identical
  teardown. The curated `public/demo/matrix/index.html` adds value-level oracle
  checks (identifier columns not summed; annotated numeric keeps sort/filter).
- **`enrichment-permutations.spec.ts`** — on `public/demo/toggle/opt-in-playground.html`,
  enables pairwise combinations plus one rich combo and asserts each member still
  works and the joint teardown is byte-identical.

## Extending coverage (no test edits needed)

| You did this | What happens automatically |
|--------------|----------------------------|
| Added a new demo page under `public/demo/**` with `window.gridSight` + a `<table>` | `discoverDemoPages()` finds it; a matrix case runs per offered enrichment. |
| Added an enrichment id to a demo's `pageConfig.enrichments` | The page's `offered` set grows; a new matrix case is generated. |
| Registered a brand-new enrichment | It appears in `enrichmentIds`; opt-in pages offer it and the permutation sweep includes it. |

**One required edit when adding a *new enrichment id*:** add its row to
`ENRICHMENT_CLASSES` in `tests/e2e/helpers/applicability.ts` (scope + headerType +
stateful). The `assertEveryIdClassified` meta-check **fails loudly** if you forget
(FR-009) — that is the intended guard, not silent skipping.

## Adding an oracle column to the curated fixture

1. Add the column to `public/demo/matrix/index.html` (`#matrix-table`).
2. Add its `ColumnOracle` row (`header`, `kind`, `annotated`) to the fixture
   expectation table in `enrichment-matrix.spec.ts`.
3. Run `yarn test:e2e` — the strong oracle now covers it.

## Sanity wiring check (integration spine)

1. Temporarily reintroduce the #48 defect (make an identifier column parse as
   numeric) and run the matrix → at least one case MUST fail (SC-002).
2. Revert; confirm green.
3. Add a throwaway demo page offering one enrichment, run without editing specs →
   a new case appears (SC-004). Remove it.
