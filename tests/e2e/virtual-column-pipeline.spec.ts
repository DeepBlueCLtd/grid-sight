import { test, expect } from '@playwright/test';
import { installMockVrs, fireMockVrsEvent } from './helpers/mock-vrs';

/**
 * Spec 012-virtual-columns US8: virtual columns cooperate with the
 * Visible Row Sequence pipeline. Sorting / filtering must propagate to all
 * three appended-column variants in canonical order within one animation
 * frame.
 */
test.describe('Virtual columns — pipeline cooperation', () => {
  let server: any;
  let port: number;

  test.beforeAll(async () => {
    port = 3135;
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

  test('AS1: sort moves appended cells with their rows and recomputes cumulative', async ({ page }) => {
    await page.goto(`http://localhost:${port}/grid-sight/demo/virtual-columns.html`);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.waitForFunction(() => !!(window as any).__gridSightVisibleRows);

    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      const vc = (window as any).gridSight.virtualColumns;
      vc.addCumulative(t, 'weight', 'sum');
      vc.addCompare(t, 'q1', 'q4', 'abs');
      vc.addSparkline(t);
    });

    // Before sort: weight column reads 10, 15, 20, 25, 30 → running sum
    // 10, 25, 45, 70, 100.
    const cumulativeBefore = await page.$$eval(
      '#sales-table td[data-gs-virtual-column="cumulative"]',
      (cells) => cells.map((c) => (c.textContent ?? '').trim()),
    );
    expect(cumulativeBefore).toEqual(['10', '25', '45', '70', '100']);

    await installMockVrs(page, {
      events: [
        {
          op: 'sort',
          tableSelector: '#sales-table',
          columnKey: 'weight',
          columnIndex: 5,
          direction: 'desc',
        },
      ],
    });
    await fireMockVrsEvent(page, 0);

    // Wait for the next animation frame so the scaffold's pipeline fan-out
    // has run. After descending sort by Weight, the rows appear in weight
    // order 30, 25, 20, 15, 10 → cumulative running sums 30, 55, 75, 90, 100.
    await page.evaluate(
      () => new Promise<void>((res) => requestAnimationFrame(() => res())),
    );
    const cumulativeAfter = await page.$$eval(
      '#sales-table td[data-gs-virtual-column="cumulative"]',
      (cells) => cells.map((c) => (c.textContent ?? '').trim()),
    );
    expect(cumulativeAfter).toEqual(['30', '55', '75', '90', '100']);

    // The appended cells still match the source rows: every body row carries
    // exactly one cumulative, one compare, and one sparkline cell.
    const rowCells = await page.$$eval(
      '#sales-table tbody tr',
      (rows) => rows.map((r) => Array.from(r.querySelectorAll('[data-gs-virtual-column]')).length),
    );
    expect(rowCells).toEqual([3, 3, 3, 3, 3]);
  });
});
