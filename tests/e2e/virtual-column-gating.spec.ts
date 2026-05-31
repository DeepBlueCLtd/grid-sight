import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * Regression: virtual-column lozenges (Σ/⌇/Δ) are column enrichment toggles, so
 * they must appear only while Grid-Sight is enabled on the table, and only for
 * kinds in the effective enabled set. Previously they were injected at page
 * load regardless of the GS toggle or the capability config.
 */

const VC_URL = `/grid-sight/demo/virtual-columns.html`;
const ANNOT_URL = `/grid-sight/demo/annotations/index.html`;
const PANEL_URL = `/grid-sight/demo/toggle/vc-panel-fixture.html`;

test.beforeEach(async ({ page }) => {
  await isolateState(page);
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

test('a virtual-column kind toggles live from the panel on a GS-on table', async ({ page }) => {
  await page.goto(PANEL_URL);
  await page.waitForFunction(() => !!(window as any).gridSight);

  // Enable GS → VC lozenges appear (defaults enable every kind). cumulative is
  // a first-class panel checkbox now.
  await page.locator('#vc-table .grid-sight-toggle').first().click();
  const cumulative = page.locator('#vc-table .gs-vc-lozenge[data-gs-vc-kind="cumulative"]');
  const sparkline = page.locator('#vc-table .gs-vc-lozenge[data-gs-vc-kind="sparkline"]');
  await expect(cumulative.first()).toBeVisible();
  await expect(sparkline.first()).toBeVisible();

  // Untick "cumulative" in the panel → its Σ lozenges go (tearDown hook), but
  // the sibling kinds stay (only this capability changed).
  await page.locator('[data-gs-toggle-panel-root] input[value="cumulative"]').uncheck();
  await expect(cumulative).toHaveCount(0);
  await expect(sparkline.first()).toBeVisible();

  // Re-tick → the Σ lozenges come back live (apply hook), no reload.
  await page.locator('[data-gs-toggle-panel-root] input[value="cumulative"]').check();
  await expect(cumulative.first()).toBeVisible();
});
