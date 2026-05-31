import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * Spec 012-virtual-columns US1: cumulative column lifecycle.
 */
test.describe('Virtual columns — cumulative', () => {
  test.beforeEach(async ({ page }) => {
    await isolateState(page);
  });

  test('Σ lozenge cycles sum → percent → off with byte-identical detach', async ({ page }) => {
    await page.goto('/grid-sight/demo/virtual-columns.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    const table = page.locator('#sales-table');
    const before = await table.evaluate((t) => t.outerHTML);

    // Activate cumulative via the public API on the Weight column.
    const id = await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      return (window as any).gridSight.virtualColumns.addCumulative(t, 'weight', 'sum');
    });
    expect(id).toBe('cum-weight');

    // Header text appears.
    await expect(table.locator('th[data-gs-virtual-column="cumulative"]')).toHaveText('Σ Weight');

    // Per-row running sums: 10, 25, 45, 70, 100
    const sumCells = await table.locator('td[data-gs-virtual-column="cumulative"]').allTextContents();
    expect(sumCells).toEqual(['10', '25', '45', '70', '100']);

    // Cycle to percent
    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      (window as any).gridSight.virtualColumns.remove(t, 'cum-weight');
      (window as any).gridSight.virtualColumns.addCumulative(t, 'weight', 'percent');
    });
    const pctCells = await table.locator('td[data-gs-virtual-column="cumulative"]').allTextContents();
    expect(pctCells[pctCells.length - 1]).toBe('100%');

    // Remove
    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      (window as any).gridSight.virtualColumns.removeAll(t);
      // Strip any URL fragment Grid-Sight wrote so the snapshot matches.
      history.replaceState(null, '', location.pathname);
    });
    const after = await table.evaluate((t) => t.outerHTML);
    expect(after).toBe(before);
  });

  test('SC-005: combined detach (cum + spark + compare → removeAll) is byte-identical', async ({ page }) => {
    await page.goto('/grid-sight/demo/virtual-columns.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    const table = page.locator('#sales-table');
    const before = await table.evaluate((t) => t.outerHTML);

    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      const vc = (window as any).gridSight.virtualColumns;
      vc.addCumulative(t, 'weight', 'sum');
      vc.addCompare(t, 'q1', 'q4', 'abs');
      vc.addSparkline(t);
    });

    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      (window as any).gridSight.virtualColumns.removeAll(t);
      history.replaceState(null, '', location.pathname);
    });
    const after = await table.evaluate((t) => t.outerHTML);
    expect(after).toBe(before);
  });
});
