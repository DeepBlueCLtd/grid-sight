import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * Spec 012-virtual-columns US6: canonical ordering of virtual columns
 * (cumulative → compare → sparkline).
 */
test.describe('Virtual columns — canonical ordering', () => {
  test.beforeEach(async ({ page }) => {
    await isolateState(page);
  });

  test('appended columns sit in [cumulative*, compare, sparkline] order regardless of activation order', async ({ page }) => {
    await page.goto('/grid-sight/demo/virtual-columns.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    // Activate sparkline first, then compare, then two cumulatives — the
    // canonical-order invariant must still place them as cum,cum,compare,spark.
    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      const vc = (window as any).gridSight.virtualColumns;
      vc.addSparkline(t);
      vc.addCompare(t, 'q1', 'q4', 'abs');
      vc.addCumulative(t, 'weight', 'sum');
      vc.addCumulative(t, 'q1', 'sum');
    });

    const kinds = await page.locator('#sales-table thead th[data-gs-virtual-column]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-gs-virtual-column')),
    );
    expect(kinds).toEqual(['cumulative', 'cumulative', 'compare', 'sparkline']);

    // Removing the first cumulative keeps the rest in the same relative order.
    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      (window as any).gridSight.virtualColumns.remove(t, 'cum-weight');
    });
    const kindsAfter = await page.locator('#sales-table thead th[data-gs-virtual-column]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-gs-virtual-column')),
    );
    expect(kindsAfter).toEqual(['cumulative', 'compare', 'sparkline']);
  });
});
