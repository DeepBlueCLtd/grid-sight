import { test, expect, type Page } from '@playwright/test';

/**
 * Regression: virtual-column lozenges (Σ/⌇/Δ) are column enrichment toggles, so
 * they must appear only while Grid-Sight is enabled on the table, and only for
 * kinds in the effective enabled set. Previously they were injected at page
 * load regardless of the GS toggle or the capability config.
 */

const PORT = 3070;
const VC_URL = `http://localhost:${PORT}/grid-sight/demo/virtual-columns.html`;
const ANNOT_URL = `http://localhost:${PORT}/grid-sight/demo/annotations/index.html`;

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

test('VC lozenges are hidden until GS is enabled, then removed when disabled', async ({ page }) => {
  await page.goto(VC_URL);
  await page.waitForFunction(() => !!(window as any).gridSight);

  // GS off at load → no lozenge affordances.
  await expect(page.locator('#sales-table .gs-vc-lozenge')).toHaveCount(0);

  // Enable GS → lozenges appear (this demo enables virtual columns by default).
  await page.locator('#sales-table .grid-sight-toggle').first().click();
  await expect(page.locator('#sales-table .gs-vc-lozenge').first()).toBeVisible();

  // Disable GS → lozenges removed again.
  await page.locator('#sales-table .grid-sight-toggle').first().click();
  await expect(page.locator('#sales-table .gs-vc-lozenge')).toHaveCount(0);
});

test('VC lozenges stay hidden when the kind is not in the page allow-list', async ({ page }) => {
  // The annotations demo's pageConfig lists annotations/sort/filter/statistics —
  // no virtual-column kinds — so the Σ/⌇/Δ must never appear, even with GS on.
  await page.goto(ANNOT_URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await expect(page.locator('#tbl-revenue .gs-vc-lozenge')).toHaveCount(0);

  await page.locator('#tbl-revenue .grid-sight-toggle').first().click();
  // GS is on (a sort lozenge shows for the numeric column) but no VC lozenges.
  await expect(page.locator('#tbl-revenue [data-gs-lozenge-id="sort"]').first()).toBeVisible();
  await expect(page.locator('#tbl-revenue .gs-vc-lozenge')).toHaveCount(0);
});
