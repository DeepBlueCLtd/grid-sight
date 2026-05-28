import { test, expect } from '@playwright/test';

/**
 * End-to-end golden paths for spec 014 — Large-Table Navigation & Analysis.
 * One file, one preview server; a describe block per user story. Each story
 * asserts its golden path AND the enable→disable→enable round-trip that the
 * 006/012 lesson made mandatory.
 */

const PORT = 3140;
const BASE = `http://localhost:${PORT}/grid-sight/demo`;

let server: any;

test.beforeAll(async () => {
  const { preview } = await import('vite');
  server = await preview({ preview: { port: PORT, open: false }, build: { outDir: 'dist' } });
});

test.afterAll(async () => {
  if (server?.httpServer?.close) {
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
});

const raf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

/* ── US1: freeze-panes ──────────────────────────────────────────────── */

test.describe('US1: freeze-panes', () => {
  const URL = `${BASE}/freeze-panes/index.html`;

  test('auto-applies a sticky header row + key column on load', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    await expect(page.locator('#assay-table')).toHaveClass(/gs-freeze/);

    const headerPos = await page
      .locator('#assay-table thead th')
      .nth(1)
      .evaluate((el) => getComputedStyle(el).position);
    expect(headerPos).toBe('sticky');

    const keyPos = await page
      .locator('#assay-table tbody th')
      .first()
      .evaluate((el) => getComputedStyle(el).position);
    expect(keyPos).toBe('sticky');
  });

  test('header pins on vertical scroll and key column pins on horizontal scroll', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    const region = page.locator('.scroll-region');
    const headerCell = page.locator('#assay-table thead th').nth(2);
    const keyCell = page.locator('#assay-table tbody th').nth(12);

    // Scroll down: the header band stays at the top edge of the scroll region.
    await region.evaluate((el) => {
      el.scrollTop = 220;
    });
    await raf(page);
    let regionBox = (await region.boundingBox())!;
    const headerBox = (await headerCell.boundingBox())!;
    expect(Math.abs(headerBox.y - regionBox.y)).toBeLessThan(8);

    // Scroll right: the key column stays at the left edge of the scroll region.
    await region.evaluate((el) => {
      el.scrollLeft = 320;
    });
    await raf(page);
    regionBox = (await region.boundingBox())!;
    const keyBox = (await keyCell.boundingBox())!;
    expect(Math.abs(keyBox.x - regionBox.x)).toBeLessThan(8);
  });

  test('disable→enable round-trip via the toggle panel restores freeze without reload', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    const cb = page.locator('[data-gs-toggle-panel-root] input[value="freeze-panes"]');
    await expect(cb).toBeChecked();

    // OFF → all freeze classes torn down (byte-identical un-freeze).
    await cb.uncheck();
    await raf(page);
    await expect(page.locator('#assay-table')).not.toHaveClass(/gs-freeze/);
    await expect(page.locator('#assay-table .gs-freeze-header')).toHaveCount(0);
    await expect(page.locator('#assay-table .gs-freeze-col')).toHaveCount(0);

    // ON → re-applied via the registry `apply` hook, no reload.
    await cb.check();
    await raf(page);
    await expect(page.locator('#assay-table')).toHaveClass(/gs-freeze/);
    await expect(page.locator('#assay-table thead th.gs-freeze-header')).toHaveCount(9);
  });
});
