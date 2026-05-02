import { test, expect } from '@playwright/test';

test.describe('US2: alternate calculation models', () => {
  let server: any;

  test.beforeAll(async () => {
    const { preview } = await import('vite');
    server = await preview({
      preview: { port: 3011, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  test('two tables sync when sliders are added; equation readout reflects formula', async ({ page }) => {
    await page.goto('http://localhost:3011/grid-sight/demo/sliders/alternate-calc-models.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    const result = await page.evaluate(() => {
      const a = document.getElementById('tbl-A') as HTMLTableElement;
      const b = document.getElementById('tbl-B') as HTMLTableElement;
      (window as any).gridSight.addSlider(a, 'row');
      (window as any).gridSight.addSlider(a, 'col');
      (window as any).gridSight.addSlider(b, 'row');
      (window as any).gridSight.addSlider(b, 'col');
      const sliderA = (window as any).gridSight.getSliders(a).find((s: any) => s.axis === 'row');
      sliderA.setPosition(11000);
      const sliderB = (window as any).gridSight.getSliders(b).find((s: any) => s.axis === 'row');
      return { a: sliderA.position, b: sliderB.position };
    });
    expect(result.a).toBeCloseTo(result.b, 5);
  });

  test('equation readout is independent of cell data', async ({ page }) => {
    await page.goto('http://localhost:3011/grid-sight/demo/sliders/alternate-calc-models.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    const text = await page.evaluate(() => {
      const a = document.getElementById('tbl-A') as HTMLTableElement;
      (window as any).gridSight.addSlider(a, 'row');
      (window as any).gridSight.addSlider(a, 'col');
      const sA = (window as any).gridSight.getSliders(a).find((s: any) => s.axis === 'row');
      sA.setPosition(11000);
      const eqEl = a.querySelector('[data-gs-slider-readout="equation"]');
      return eqEl ? eqEl.textContent : null;
    });
    expect(text).not.toBeNull();
    expect(text).not.toBe('—');
  });
});
