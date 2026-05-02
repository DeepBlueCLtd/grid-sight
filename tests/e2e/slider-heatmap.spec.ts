import { test, expect } from '@playwright/test';

test.describe('US4: heatmap marker + threshold', () => {
  let server: any;

  test.beforeAll(async () => {
    const { preview } = await import('vite');
    server = await preview({
      preview: { port: 3013, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  async function enableAllAndHeatmap(page: any) {
    return page.evaluate(() => {
      const a = document.getElementById('atlantic') as HTMLTableElement;
      const s = document.getElementById('south-atlantic') as HTMLTableElement;
      (window as any).gridSight.applyHeatmap(a, 0, 'table');
      (window as any).gridSight.applyHeatmap(s, 0, 'table');
      (window as any).gridSight.addSlider(a, 'row');
      (window as any).gridSight.addSlider(a, 'col');
      (window as any).gridSight.addSlider(s, 'row');
      (window as any).gridSight.addSlider(s, 'col');
    });
  }

  test('marker is rendered when both axis sliders are present', async ({ page }) => {
    await page.goto('http://localhost:3013/grid-sight/demo/sliders/heatmap.html');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await enableAllAndHeatmap(page);
    await page.waitForTimeout(200);

    const markers = await page.$$('[data-gs-marker]');
    expect(markers.length).toBeGreaterThan(0);
  });

  test('threshold slider fades low-value cells live', async ({ page }) => {
    await page.goto('http://localhost:3013/grid-sight/demo/sliders/heatmap.html');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await enableAllAndHeatmap(page);
    await page.evaluate(() => {
      const a = document.getElementById('atlantic') as HTMLTableElement;
      (window as any).gridSight.addThresholdSlider(a);
    });

    const fadedCount = await page.evaluate(() => {
      const a = document.getElementById('atlantic') as HTMLTableElement;
      const t = (window as any).gridSight.getSliders(a).find((s: any) => s.kind === 'threshold');
      t.setPosition(4.0);
      return a.querySelectorAll('[data-gs-cell-fade]').length;
    });
    expect(fadedCount).toBeGreaterThan(0);
  });
});
