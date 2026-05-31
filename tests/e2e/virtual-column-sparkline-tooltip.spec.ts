import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * Spec 012-virtual-columns US4: sparkline focus/hover, tooltip, and
 * source-column header highlight.
 */
test.describe('Virtual columns — sparkline tooltip + header highlight', () => {
  test.beforeEach(async ({ page }) => {
    await isolateState(page);
  });

  test('keyboard focus shows tooltip, arrow keys navigate, source headers highlight', async ({ page }) => {
    await page.goto('/grid-sight/demo/virtual-columns.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      (window as any).gridSight.virtualColumns.addSparkline(t);
    });

    const firstSparkCell = page.locator(
      '#sales-table td[data-gs-virtual-column="sparkline"]',
    ).first();
    await firstSparkCell.focus();

    // Tooltip is visible with the row's min/max/last text.
    const tooltip = page.locator('.gs-vc-tooltip');
    await expect(tooltip).toHaveCount(1);
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/min/);
    await expect(tooltip).toContainText(/max/);
    await expect(tooltip).toContainText(/last/);

    // Source numeric column headers are highlighted.
    const highlightCount = await page.locator(
      '#sales-table thead th.gs-vc-source-highlight',
    ).count();
    expect(highlightCount).toBeGreaterThanOrEqual(3);

    // Arrow keys move between sparkline cells in the column.
    await page.keyboard.press('ArrowDown');
    const focusedRowIndex = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return -1;
      const row = el.closest('tr');
      const tbody = row?.parentElement;
      if (!row || !tbody) return -1;
      return Array.from(tbody.children).indexOf(row);
    });
    expect(focusedRowIndex).toBe(1);

    // Escape dismisses the tooltip.
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
  });
});
