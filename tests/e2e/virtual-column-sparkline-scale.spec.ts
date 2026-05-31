import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * Spec 012-virtual-columns US5: sparkline per-row ↔ shared scaling toggle.
 */
test.describe('Virtual columns — sparkline scale toggle', () => {
  test.beforeEach(async ({ page }) => {
    await isolateState(page);
  });

  test('the scale-toggle flips per-row ↔ shared scaling', async ({ page }) => {
    await page.goto('/grid-sight/demo/virtual-columns.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      (window as any).gridSight.virtualColumns.addSparkline(t);
    });

    // Capture the bar heights of the LAST body row's sparkline (Centre, the
    // row with the smallest values — its per-row max is much smaller than
    // the global max, so shared scaling will visibly shrink the bars).
    const heightsBefore = await page.$$eval(
      '#sales-table tbody tr:last-child td[data-gs-virtual-column="sparkline"] rect',
      (rs) => rs.map((r) => parseFloat(r.getAttribute('height') || '0')),
    );

    // Click the toggle button next to the Trend header.
    await page
      .locator(
        '#sales-table thead th[data-gs-virtual-column="sparkline"] .gs-vc-scale-toggle',
      )
      .click();

    // The same <rect> nodes are reused; heights mutate in place.
    const heightsAfter = await page.$$eval(
      '#sales-table tbody tr:last-child td[data-gs-virtual-column="sparkline"] rect',
      (rs) => rs.map((r) => parseFloat(r.getAttribute('height') || '0')),
    );

    expect(heightsAfter.length).toBe(heightsBefore.length);
    // After flipping to shared scaling, the last row's bars should shrink
    // (its values are small; the global max dominates).
    const sumBefore = heightsBefore.reduce((a, b) => a + b, 0);
    const sumAfter = heightsAfter.reduce((a, b) => a + b, 0);
    expect(sumAfter).toBeLessThan(sumBefore);

    // The toggle aria-pressed reflects shared state.
    const pressed = await page
      .locator(
        '#sales-table thead th[data-gs-virtual-column="sparkline"] .gs-vc-scale-toggle',
      )
      .getAttribute('aria-pressed');
    expect(pressed).toBe('true');
  });
});
