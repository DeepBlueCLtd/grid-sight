import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Each spec file currently starts its own `vite preview` server in a
  // `beforeAll` hook on a hardcoded port. Running them in parallel races
  // those startups against each other (ports look free, get bound by
  // another worker mid-handshake, and the first test in the loser sees
  // ERR_CONNECTION_REFUSED / ERR_CONNECTION_RESET). Serialising the
  // suite trades ~1 s of clock time for deterministic test runs.
  // If/when the suite grows large enough to need parallelism back,
  // refactor to a single shared `webServer` in this config and drop
  // the per-file `beforeAll` previews.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
