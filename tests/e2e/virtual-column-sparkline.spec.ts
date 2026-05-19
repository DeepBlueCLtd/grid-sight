import { test, expect } from '@playwright/test';

/**
 * Spec 012-virtual-columns US2: sparkline column lifecycle.
 */
test.describe('Virtual columns — sparkline', () => {
  let server: any;
  let port: number;

  test.beforeAll(async () => {
    port = 3131;
    const { preview } = await import('vite');
    server = await preview({
      preview: { port, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  test('⌇ adds a Trend column with one <svg> per row and removes byte-identically', async ({ page }) => {
    await page.goto(`http://localhost:${port}/grid-sight/demo/virtual-columns.html`);
    await page.waitForFunction(() => !!(window as any).gridSight);

    const table = page.locator('#sales-table');
    const before = await table.evaluate((t) => t.outerHTML);

    const id = await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      return (window as any).gridSight.virtualColumns.addSparkline(t);
    });
    expect(id).toBe('spark');

    // Header
    await expect(table.locator('th[data-gs-virtual-column="sparkline"]')).toHaveText('Trend');

    // One svg per body row (5 rows)
    const svgs = table.locator('td[data-gs-virtual-column="sparkline"] svg');
    await expect(svgs).toHaveCount(5);

    // Each svg has rects for the numeric body columns (5: Q1..Q4 + Weight)
    const firstSvgRects = await svgs.first().locator('rect').count();
    expect(firstSvgRects).toBe(5);

    // Remove
    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      (window as any).gridSight.virtualColumns.removeAll(t);
      history.replaceState(null, '', location.pathname);
    });
    const after = await table.evaluate((t) => t.outerHTML);
    expect(after).toBe(before);
  });
});
