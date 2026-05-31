# Contract: E2E Runner (webServer + projects + runtime gate)

This is the `playwright.config.ts` + CI contract introduced by US4 (FR-013/014/
015/016). It changes how **every** e2e spec runs.

## Shared webServer (FR-013)

```ts
// playwright.config.ts (shape, not literal)
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? '50%' : undefined,   // >1 locally and in CI
  use: { baseURL: `http://localhost:${PORT}/grid-sight`, trace: 'retain-on-failure' },
  webServer: {
    command: 'vite preview --port <PORT>',
    url: `http://localhost:${PORT}/grid-sight/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
});
```

- **One** `vite preview` for the whole run; specs navigate via `baseURL` + a
  relative path. No spec starts its own server.
- `test:e2e` still `vite build`s first, then `playwright test`.

## Spec migration contract (FR-013/014)

Every existing spec MUST:

- Remove its `test.beforeAll(() => preview(...))` / `afterAll(close)` and its
  hardcoded `PORT`/`BASE` constant.
- Navigate with `page.goto('/grid-sight/demo/...')` (relative to `baseURL`).
- Be parallel-safe: call `isolateState(page)` in a `beforeEach`; assume **no**
  ordering relative to other specs; never assume a fixed port.

Acceptance: the full suite is green with `fullyParallel: true` and `workers > 1`.

## Cross-browser projects (FR-015)

- `chromium`, `firefox`, `webkit` projects defined.
- The matrix + permutation specs run on all three (no project filter).
- Other specs MAY be tagged to a project subset to bound runtime, but the new
  specs MUST cover all three.
- Browser binaries: `npx playwright install firefox webkit` (CI/setup step; not a
  `package.json` dependency).

## Runtime gate (FR-016 / SC-009)

```text
scripts/e2e-runtime-gate.(js|ts):
  input  : suite wall-clock (Playwright reporter JSON or a wrapping timer)
  budget : E2E_BUDGET_SECONDS (recorded here + in spec.md; set from the
           post-migration parallel baseline during /speckit-tasks)
  exit   : non-zero if elapsed > budget  → fails CI
```

- Wired into the `test:e2e` flow (or a dedicated CI step after it).
- The budget is a single, explicit number — coverage may grow underneath it until
  it trips, at which point the team raises the budget deliberately or parallelizes
  further (mirrors the bundle-size ceiling philosophy, Principle I).

## Offline guarantee (Principle VI)

The shared `webServer` is a local `vite preview`; `installOfflineGuard` fails any
test that issues a non-local request. Holds identically across all three engines.
