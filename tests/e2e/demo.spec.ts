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

    // Representative sample tables present (spec 015 welcome redesign).
    await expect(page.locator('#reference-raw')).toBeVisible();
    await expect(page.locator('#demo-sliders')).toBeVisible();
    await expect(page.locator('#demo-nav')).toBeVisible();

    // The reference table opts out (data-gs-ignore) — no GS toggle.
    await expect(page.locator('#reference-raw .grid-sight-toggle')).toHaveCount(0);
    // A demo table is auto-detected — has the GS toggle.
    await expect(page.locator('#demo-sliders .grid-sight-toggle')).toHaveCount(1);

    // Demo cards link to the seven published demos shown on the landing page.
    const cardTitles = await page.locator('.demo-card h3').allTextContents();
    expect(cardTitles).toEqual(expect.arrayContaining([
      expect.stringContaining('Interpolation'),
      expect.stringContaining('Alternate calc models'),
      expect.stringContaining('Persistent URL'),
      expect.stringContaining('Live toggles'),
      expect.stringContaining('Opt-in playground'),
      expect.stringContaining('Virtual columns'),
      expect.stringContaining('Cell annotations'),
      expect.stringContaining('Outlier marker'),
    ]));
  });

  test('GS toggle injects lozenges on a start-inactive table', async ({ page }) => {
    await page.goto('http://localhost:3014/grid-sight/');
    await page.waitForFunction(() => !!(window as any).gridSight);

    // #start-inactive ships hidden (startActive:false); clicking GS reveals it.
    const gsToggle = page.locator('#start-inactive .grid-sight-toggle').first();
    await expect(page.locator('#start-inactive .gs-lozenge')).toHaveCount(0);
    await gsToggle.click();
    await expect(page.locator('#start-inactive .gs-lozenge').first()).toBeVisible();
  });

  test('page-level toggle disables and re-enables Grid-Sight', async ({ page }) => {
    await page.goto('http://localhost:3014/grid-sight/');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await expect(page.locator('#demo-sliders .grid-sight-toggle')).toHaveCount(1);

    await page.click('#gs-page-toggle');
    await expect(page.locator('#demo-sliders .grid-sight-toggle')).toHaveCount(0);

    await page.click('#gs-page-toggle');
    await expect(page.locator('#demo-sliders .grid-sight-toggle')).toHaveCount(1);
  });

  test('all eight demo pages linked from the landing page are reachable', async ({ page }) => {
    // Mirrors the eight `.demo-card` links in public/index.html.
    const paths = [
      '/grid-sight/demo/sliders/interpolation.html',
      '/grid-sight/demo/sliders/alternate-calc-models.html',
      '/grid-sight/demo/sliders/synced-tables.html',
      '/grid-sight/demo/toggle/live-enrichments.html',
      '/grid-sight/demo/toggle/opt-in-playground.html',
      '/grid-sight/demo/virtual-columns.html',
      '/grid-sight/demo/annotations/index.html',
      '/grid-sight/demo/outlier/measurements.html',
    ];
    for (const p of paths) {
      const resp = await page.goto('http://localhost:3014' + p);
      expect(resp?.status()).toBe(200);
      await page.waitForFunction(() => !!(window as any).gridSight);
    }
  });
});
