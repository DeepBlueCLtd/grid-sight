import { test, expect } from '@playwright/test';

/**
 * Spec 012-virtual-columns US7: URL fragment persistence + restoration.
 */
test.describe('Virtual columns — URL share', () => {
  let server: any;
  let port: number;

  test.beforeAll(async () => {
    port = 3124;
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

  test('directives round-trip through the URL fragment', async ({ page }) => {
    await page.goto(`http://localhost:${port}/grid-sight/demo/virtual-columns.html`);
    await page.waitForFunction(() => !!(window as any).gridSight);

    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      const vc = (window as any).gridSight.virtualColumns;
      vc.addCumulative(t, 'weight', 'sum');
      vc.addCompare(t, 'q1', 'q4', 'abs');
      vc.addSparkline(t);
    });

    const hash = await page.evaluate(() => location.hash);
    expect(hash).toContain('gs.vc=');
    expect(hash).toContain('sales-table');

    // Open the URL in a fresh page and assert restoration.
    const restoredUrl = `http://localhost:${port}/grid-sight/demo/virtual-columns.html${hash}`;
    const page2 = await page.context().newPage();
    await page2.goto(restoredUrl);
    await page2.waitForFunction(() => !!(window as any).gridSight);
    // Wait for the rAF in restoreFromUrl to fire.
    await page2.waitForFunction(() => {
      const table = document.getElementById('sales-table');
      return !!table && table.querySelectorAll('[data-gs-virtual-column]').length > 0;
    });

    const kinds = await page2.locator('#sales-table thead th[data-gs-virtual-column]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-gs-virtual-column')),
    );
    expect(kinds).toEqual(['cumulative', 'compare', 'sparkline']);
    await page2.close();
  });

  test('order-violating URLs are re-canonicalised', async ({ page }) => {
    // Manually-crafted URL where sparkline appears before cumulative.
    const url = `http://localhost:${port}/grid-sight/demo/virtual-columns.html#gs.vc=${encodeURIComponent('sales-table:t.r,c.weight.s')}`;
    await page.goto(url);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.waitForFunction(() => {
      const table = document.getElementById('sales-table');
      return !!table && table.querySelectorAll('[data-gs-virtual-column]').length > 0;
    });

    const kinds = await page.locator('#sales-table thead th[data-gs-virtual-column]').evaluateAll(
      (els) => els.map((e) => e.getAttribute('data-gs-virtual-column')),
    );
    // Must be cumulative first, then sparkline — never the reverse.
    expect(kinds).toEqual(['cumulative', 'sparkline']);
  });
});
