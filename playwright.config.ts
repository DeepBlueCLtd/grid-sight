import { defineConfig, devices } from '@playwright/test';

// One shared `vite preview` serves the built `dist/` for the whole run; specs
// navigate via `baseURL` + a relative path rather than each booting their own
// preview on a hardcoded port. That per-file pattern forced `workers: 1` (the
// servers raced each other on startup); a single shared server lets the suite
// run `fullyParallel`. See specs/015-e2e-enrichment-matrix/contracts/e2e-runner.md.
const PORT = 4173;
const BASE = `http://localhost:${PORT}/grid-sight`;

// The new cross-engine coverage layer (spec 015, US4 / FR-015) runs on all three
// engines. The ~40 pre-existing specs are behaviour-migrated chromium suites; to
// bound wall-clock we keep running THOSE on chromium only and add firefox/webkit
// coverage through the matrix + permutation specs, which exercise every shipped
// enrichment across the demos anyway.
const CROSS_ENGINE_SPECS = [
  '**/enrichment-matrix.spec.ts',
  '**/enrichment-permutations.spec.ts',
];

export default defineConfig({
  testDir: 'tests/e2e',
  // Only `.spec.ts` are Playwright e2e specs; the harness's pure-helper Vitest
  // units (`*.test.ts`) live under tests/unit and must not be picked up here.
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // >1 locally (Playwright defaults to ~half the cores) and a bounded share in CI.
  workers: process.env.CI ? '50%' : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `vite preview --port ${PORT}`,
    url: `${BASE}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      // Chromium runs the whole suite (every migrated spec + the new ones).
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Firefox + WebKit run the cross-engine coverage layer only (FR-015).
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: CROSS_ENGINE_SPECS,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: CROSS_ENGINE_SPECS,
    },
  ],
});
