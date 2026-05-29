import { test, expect, type Page } from '@playwright/test';

const PORT = 3043;
const URL = `http://localhost:${PORT}/grid-sight/demo/outlier/measurements.html`;

let server: any;

test.beforeAll(async () => {
  const { preview } = await import('vite');
  server = await preview({ preview: { port: PORT, open: false }, build: { outDir: 'dist' } });
});

test.afterAll(async () => {
  if (server?.httpServer?.close) {
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
});

const LAT = '#tbl-measurements thead th:nth-child(2) [data-gs-lozenge-id="outlier"]';
const THR = '#tbl-measurements thead th:nth-child(3) [data-gs-lozenge-id="outlier"]';
const MARKED = '#tbl-measurements td.gs-outlier-cell';

async function enable(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector(LAT, { state: 'attached' });
}

test.describe('US4: persist + share via URL', () => {
  test('flagging two columns at different thresholds encodes both in gs.o', async ({ page }) => {
    await enable(page);
    await page.locator(LAT).click(); // Latency → 2σ (1 mark)
    await page.locator(THR).click(); // Throughput → 2σ
    await page.locator(THR).click(); // Throughput → 1σ (5 marks)

    const hash = await page.evaluate(() => location.hash);
    expect(hash).toContain('gs.o=');
    expect(hash).toContain('latency:2');
    expect(hash).toContain('throughput:1');
  });

  test('reload restores both flagged columns with the correct glyphs', async ({ page }) => {
    await enable(page);
    await page.locator(LAT).click(); // 2σ
    await page.locator(THR).click();
    await page.locator(THR).click(); // 1σ

    await page.reload();
    // Markers repaint on load from gs.o (SC-003) even before re-opening lozenges.
    await page.waitForSelector(MARKED, { state: 'attached' });
    expect(await page.locator(MARKED).count()).toBe(6); // Latency 2σ (1) + Throughput 1σ (5)

    // Re-open lozenges and confirm the restored glyphs.
    await page.locator('.grid-sight-toggle').first().click();
    await expect(page.locator(LAT)).toHaveText('!2');
    await expect(page.locator(THR)).toHaveText('!1');
  });

  test('a fresh context (no localStorage) reproduces the view from the URL alone (SC-004)', async ({
    page,
    browser,
  }) => {
    await enable(page);
    await page.locator(LAT).click(); // 2σ
    const shareUrl = await page.evaluate(() => location.href);

    const ctx = await browser.newContext();
    const fresh = await ctx.newPage();
    await fresh.goto(shareUrl);
    await fresh.waitForSelector(MARKED, { state: 'attached' });
    expect(await fresh.locator(MARKED).count()).toBe(1);
    await ctx.close();
  });

  test('a directive naming a removed column is ignored while valid ones apply (FR-017)', async ({
    page,
  }) => {
    await page.goto(`${URL}#gs.o=tbl-measurements(latency:2;ghostcolumn:1;)`);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.waitForSelector(MARKED, { state: 'attached' });
    // Only latency:2 applies (1 mark); the missing column is silently skipped.
    expect(await page.locator(MARKED).count()).toBe(1);
    await expect(page.locator(MARKED).first()).toHaveText(/200/);
  });
});
