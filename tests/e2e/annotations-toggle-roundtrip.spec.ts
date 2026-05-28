import { test, expect } from '@playwright/test';

/**
 * Regression test for the enable→disable→enable round-trip (spec 006 / the
 * `docs/adding-an-enrichment.md` §3 requirement). Toggling an auto-rendered
 * enrichment off then on via the spec-012 panel must restore it without a
 * page reload. Annotations is the first such enrichment, restored via the
 * registry `apply` hook the toggle panel now calls.
 */

const PORT = 3065;
const URL = `http://localhost:${PORT}/grid-sight/demo/toggle/live-enrichments.html`;

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

const cell = '#mixed-table tr:nth-child(2) td:nth-child(2)';
const annotCheckbox = '[data-gs-toggle-panel-root] input[type="checkbox"][value="annotations"]';

test('annotations restore on toggle OFF→ON without reload', async ({ page }) => {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.waitForSelector(`${cell} .gs-annotation-pin`, { state: 'attached' });

  // Annotate a cell.
  await page.locator(cell).hover();
  await page.locator(`${cell} .gs-annotation-pin`).click();
  await page.locator('.gs-annotation-popover textarea').fill('round-trip note');
  await page.locator('.gs-annotation-popover button', { hasText: 'Save' }).click();
  await expect(page.locator(`${cell} .gs-annotation-marker`)).toHaveCount(1);

  // Toggle annotations OFF → marker (and pin) torn down.
  await page.locator(annotCheckbox).uncheck();
  await expect(page.locator(`${cell} .gs-annotation-marker`)).toHaveCount(0);
  await expect(page.locator(`${cell} .gs-annotation-pin`)).toHaveCount(0);

  // Toggle annotations ON → marker restored from the retained store, no reload.
  await page.locator(annotCheckbox).check();
  await expect(page.locator(`${cell} .gs-annotation-marker`)).toHaveCount(1);
  await expect(page.locator(`${cell} .gs-annotation-pin`)).toHaveCount(1);

  // Re-opening the restored marker still shows the saved text.
  await page.locator(cell).hover();
  await page.locator(`${cell} .gs-annotation-pin`).click();
  await expect(page.locator('.gs-annotation-popover textarea')).toHaveValue('round-trip note');
});
