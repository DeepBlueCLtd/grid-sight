import { test, expect } from '@playwright/test';

/**
 * Validate the published landing page (Grid-Sight on GitHub Pages).
 * The page showcases spec 001 (Dynamic Sliders) demos.
 */

test.describe('Grid-Sight landing page', () => {
  let server: any;

  test.beforeAll(async () => {
    const { preview } = await import('vite');
    server = await preview({
      preview: { port: 3014, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  test('landing page loads and exposes window.gridSight', async ({ page }) => {
    await page.goto('http://localhost:3014/grid-sight/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!(window as any).gridSight);

    // All three sample tables present.
    await expect(page.locator('#plain-table')).toBeVisible();
    await expect(page.locator('#featured-table')).toBeVisible();
    await expect(page.locator('#contact-table')).toBeVisible();

    // Plain table opts out — no GS toggle.
    await expect(page.locator('#plain-table .grid-sight-toggle')).toHaveCount(0);
    // Featured table is auto-detected — has the GS toggle.
    await expect(page.locator('#featured-table .grid-sight-toggle')).toHaveCount(1);

    // Demo cards link to all four spec-001 demos.
    const cardTitles = await page.locator('.demo-card h3').allTextContents();
    expect(cardTitles).toEqual(expect.arrayContaining([
      expect.stringContaining('Interpolation'),
      expect.stringContaining('Alternate calc models'),
      expect.stringContaining('Synced'),
      expect.stringContaining('Dynamic heatmap'),
    ]));
  });

  test('GS toggle injects lozenges on the featured table', async ({ page }) => {
    await page.goto('http://localhost:3014/grid-sight/');
    await page.waitForFunction(() => !!(window as any).gridSight);

    const gsToggle = page.locator('#featured-table .grid-sight-toggle').first();
    await gsToggle.click();
    await expect(page.locator('#featured-table .gs-lozenge').first()).toBeVisible();
  });

  test('page-level toggle disables and re-enables Grid-Sight', async ({ page }) => {
    await page.goto('http://localhost:3014/grid-sight/');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await expect(page.locator('#featured-table .grid-sight-toggle')).toHaveCount(1);

    await page.click('#gs-page-toggle');
    await expect(page.locator('#featured-table .grid-sight-toggle')).toHaveCount(0);

    await page.click('#gs-page-toggle');
    await expect(page.locator('#featured-table .grid-sight-toggle')).toHaveCount(1);
  });

  test('all four demo pages are reachable', async ({ page }) => {
    const paths = [
      '/grid-sight/demo/sliders/interpolation.html',
      '/grid-sight/demo/sliders/alternate-calc-models.html',
      '/grid-sight/demo/sliders/synced-tables.html',
      '/grid-sight/demo/sliders/heatmap.html',
    ];
    for (const p of paths) {
      const resp = await page.goto('http://localhost:3014' + p);
      expect(resp?.status()).toBe(200);
      await page.waitForFunction(() => !!(window as any).gridSight);
    }
  });
});
