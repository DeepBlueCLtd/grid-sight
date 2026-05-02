import { test, expect } from '@playwright/test';

test.describe('US3: cross-table sync + URL persistence', () => {
  let server: any;

  test.beforeAll(async () => {
    const { preview } = await import('vite');
    server = await preview({
      preview: { port: 3012, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  async function attachAllSliders(page: any) {
    return page.evaluate(() => {
      const tryAdd = (table: HTMLTableElement, axis: 'row' | 'col') => {
        try { (window as any).gridSight.addSlider(table, axis); }
        catch (e: any) { if (!String(e?.message).includes('already exists')) throw e; }
      };
      const a = document.getElementById('atlantic') as HTMLTableElement;
      const s = document.getElementById('south-atlantic') as HTMLTableElement;
      tryAdd(a, 'row'); tryAdd(a, 'col');
      tryAdd(s, 'row'); tryAdd(s, 'col');
    });
  }

  test('moving slider on one synced table moves the other', async ({ page }) => {
    await page.goto('http://localhost:3012/grid-sight/demo/sliders/synced-tables.html');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await attachAllSliders(page);

    const positions = await page.evaluate(() => {
      const a = document.getElementById('atlantic') as HTMLTableElement;
      const s = document.getElementById('south-atlantic') as HTMLTableElement;
      const sliderA = (window as any).gridSight.getSliders(a).find((sl: any) => sl.axis === 'row');
      sliderA.setPosition(11000);
      const sliderS = (window as any).gridSight.getSliders(s).find((sl: any) => sl.axis === 'row');
      return { a: sliderA.position, s: sliderS.position };
    });
    expect(positions.a).toBe(11000);
    expect(positions.s).toBeCloseTo(11000, 5);
  });

  test('URL fragment encodes slider state and restores on reload', async ({ page }) => {
    await page.goto('http://localhost:3012/grid-sight/demo/sliders/synced-tables.html');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await attachAllSliders(page);

    await page.evaluate(() => {
      const a = document.getElementById('atlantic') as HTMLTableElement;
      const sA = (window as any).gridSight.getSliders(a).find((s: any) => s.axis === 'row');
      sA.setPosition(11000);
    });

    const url = page.url();
    expect(url).toContain('gs.s=');

    // Reload from the bookmarked URL — clearing localStorage so we prove URL alone restores.
    await page.evaluate(() => localStorage.clear());
    await page.goto(url);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await attachAllSliders(page);

    const restored = await page.evaluate(() => {
      const a = document.getElementById('atlantic') as HTMLTableElement;
      const sA = (window as any).gridSight.getSliders(a).find((s: any) => s.axis === 'row');
      return sA.position;
    });
    expect(restored).toBeCloseTo(11000, 0);
  });
});
