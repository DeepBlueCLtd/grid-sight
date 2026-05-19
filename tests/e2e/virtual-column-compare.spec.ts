import { test, expect } from '@playwright/test';

/**
 * Spec 012-virtual-columns US3: column-compare lifecycle.
 */
test.describe('Virtual columns — compare', () => {
  let server: any;
  let port: number;

  test.beforeAll(async () => {
    port = 3122;
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

  test('Δ appends a delta column with direction glyphs and removes byte-identically', async ({ page }) => {
    await page.goto(`http://localhost:${port}/grid-sight/demo/virtual-columns.html`);
    await page.waitForFunction(() => !!(window as any).gridSight);

    const table = page.locator('#sales-table');
    const before = await table.evaluate((t) => t.outerHTML);

    const id = await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      return (window as any).gridSight.virtualColumns.addCompare(t, 'q1', 'q4', 'abs');
    });
    expect(id).toBe('cmp-q1-q4');

    await expect(table.locator('th[data-gs-virtual-column="compare"]')).toHaveText('Δ Q4 − Q1');

    const cells = await table.locator('td[data-gs-virtual-column="compare"]').allTextContents();
    // (Q4 - Q1) for each row: 90, 30, 30, 20, 15 — all positive → ▲
    expect(cells.every((c) => c.includes('▲'))).toBe(true);

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
