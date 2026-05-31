import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * Spec 012-virtual-columns US3: the Δ compare picker affordance driven through
 * the real lozenge UI — the Δ lozenge highlights while armed, each picked column
 * header highlights, highlights clear once the column appears, and clicking off a
 * candidate header cancels the pick.
 */
test.describe('Virtual columns — compare picker affordance', () => {
  test.beforeEach(async ({ page }) => {
    await isolateState(page);
  });

  async function enable(page: import('@playwright/test').Page) {
    await page.goto('/grid-sight/demo/virtual-columns.html');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.locator('#sales-table .grid-sight-toggle').first().click();
    await page.waitForSelector('#sales-table .gs-vc-lozenge[data-gs-vc-kind="compare"]');
  }

  test('Δ highlights, picked columns highlight, then clear when the column shows', async ({ page }) => {
    await enable(page);

    const delta = page.locator('#sales-table .gs-vc-lozenge[data-gs-vc-kind="compare"]');
    await delta.click();

    // Δ highlights + numeric headers become candidates.
    await expect(delta).toHaveClass(/gs-vc-pick-active/);
    const candidates = page.locator('#sales-table thead th.gs-vc-pick-target');
    expect(await candidates.count()).toBeGreaterThanOrEqual(3);

    // Pick Q1 (header index 1) — it highlights.
    const q1 = page.locator('#sales-table thead th').nth(1);
    await q1.click();
    await expect(q1).toHaveClass(/gs-vc-pick-active/);

    // Pick Q4 (header index 4) — compare column appears, highlights clear.
    await page.locator('#sales-table thead th').nth(4).click();
    await expect(page.locator('#sales-table th[data-gs-virtual-column="compare"]')).toHaveText(/Δ\s*Q4\s*−\s*Q1/);
    await expect(delta).not.toHaveClass(/gs-vc-pick-active/);
    expect(await page.locator('#sales-table .gs-vc-pick-active').count()).toBe(0);
    expect(await page.locator('#sales-table thead th.gs-vc-pick-target').count()).toBe(0);
  });

  test('clicking off a candidate header cancels the pick', async ({ page }) => {
    await enable(page);

    const delta = page.locator('#sales-table .gs-vc-lozenge[data-gs-vc-kind="compare"]');
    await delta.click();
    await expect(delta).toHaveClass(/gs-vc-pick-active/);

    // Click a body cell (not a candidate header) → cancel.
    await page.locator('#sales-table tbody tr:first-child td:first-child').click();

    await expect(delta).not.toHaveClass(/gs-vc-pick-active/);
    expect(await page.locator('#sales-table thead th.gs-vc-pick-target').count()).toBe(0);
    expect(await page.locator('#sales-table th[data-gs-virtual-column="compare"]').count()).toBe(0);
  });
});
