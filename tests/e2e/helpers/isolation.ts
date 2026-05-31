import type { Page } from '@playwright/test';

/**
 * Parallel-safety helpers (FR-014). With the shared `webServer` the suite now
 * runs `fullyParallel`; Playwright already gives every test a fresh, isolated
 * browser context (so `localStorage`/cookies cannot leak between concurrent
 * specs), and these helpers make that contract explicit and defensive.
 */

/** Origins the suite is allowed to talk to — the local `vite preview` only. */
function isLocalUrl(url: string): boolean {
  return (
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(url) ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('about:')
  );
}

/**
 * Scrub any state a prior navigation left in *this* test's context. Safe to
 * call from `beforeEach` (before the first `goto`, when the document is
 * `about:blank` and has no app-origin storage, it is a no-op). It deliberately
 * does NOT clear storage on every navigation, so within-test persistence specs
 * (e.g. annotations-persist) still exercise reload-survival.
 */
export async function isolateState(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      try {
        window.localStorage?.clear();
        window.sessionStorage?.clear();
      } catch {
        /* storage unavailable (about:blank / opaque origin) — nothing to scrub */
      }
    })
    .catch(() => {
      /* no document yet — beforeEach ran before the first navigation */
    });
}

/**
 * Fail loudly on any non-local request (Principle VI — offline-first). Aborts
 * the request so the resource cannot load, and records the offending URL on
 * the page so a spec can assert the guard never tripped.
 */
export async function installOfflineGuard(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (isLocalUrl(url)) {
      return route.continue();
    }
    // eslint-disable-next-line no-console
    console.error(`[offline-guard] blocked non-local request: ${url}`);
    return route.abort('blockedbyclient');
  });
}
