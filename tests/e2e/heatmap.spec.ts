import { test, expect } from '@playwright/test';

/**
 * Heatmap toggle e2e — exercises the new lozenge UX (H toggle on the
 * top-left corner cell) on the published landing page.
 */

test.describe('Grid-Sight Heatmap (lozenge UX)', () => {
  let server: any;

  test.beforeAll(async () => {
    const { preview } = await import('vite');
    server = await preview({
      preview: { port: 3015, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  test('table-wide heatmap toggle on and off via the H lozenge', async ({ page }) => {
    await page.goto('http://localhost:3015/grid-sight/');
    await page.waitForFunction(() => !!(window as any).gridSight);

    const table = page.locator('#featured-table');

    // Activate GS so lozenges inject.
    await page.locator('#featured-table .grid-sight-toggle').click();

    // Click the H lozenge on the top-left corner cell (table-wide).
    const cornerCell = table.locator('tr').first().locator('th, td').first();
    const heatmapLozenge = cornerCell.locator('.gs-lozenge[data-gs-lozenge-id="heatmap"]');
    await heatmapLozenge.click();

    // Cells should pick up background colours.
    await page.waitForFunction(() => {
      const cells = document.querySelectorAll('#featured-table td');
      return Array.from(cells).some(c => {
        const bg = getComputedStyle(c).backgroundColor;
        return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(255, 255, 255)' && bg !== 'transparent';
      });
    }, { timeout: 3000 });

    // Lozenge should be marked active.
    await expect(heatmapLozenge).toHaveClass(/gs-lozenge--active/);

    // Click again to toggle off.
    await heatmapLozenge.click();

    await page.waitForFunction(() => {
      const cells = document.querySelectorAll('#featured-table td');
      return Array.from(cells).every(c => {
        const bg = getComputedStyle(c).backgroundColor;
        return !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgb(255, 255, 255)' || bg === 'transparent';
      });
    }, { timeout: 3000 });

    await expect(heatmapLozenge).not.toHaveClass(/gs-lozenge--active/);
  });
});
