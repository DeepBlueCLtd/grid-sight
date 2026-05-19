import { test, expect, type Page } from '@playwright/test';

const PORT = 3020;
const URL = `http://localhost:${PORT}/grid-sight/demo/row-visibility/orders.html`;

let server: any;

test.beforeAll(async () => {
  const { preview } = await import('vite');
  server = await preview({
    preview: { port: PORT, open: false },
    build: { outDir: 'dist' },
  });
});

test.afterAll(async () => {
  if (server?.httpServer?.close) {
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
});

async function enableGridSight(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  // Click the GS toggle to enable lozenges on the table.
  const toggle = page.locator('#tbl-orders ~ * .grid-sight-toggle, .grid-sight-toggle').first();
  await toggle.waitFor({ state: 'visible' });
  await toggle.click();
  // Wait for lozenges to mount.
  await page.waitForSelector('#tbl-orders [data-gs-lozenge-id="sort"]', { state: 'attached' });
}

async function readAmountColumn(page: Page): Promise<string[]> {
  return page.$$eval('#tbl-orders tbody tr td.num', (cells) =>
    cells.map((c) => (c.textContent ?? '').trim())
  );
}

test.describe('US1: three-state sort', () => {
  test('numeric column cycles asc → desc → off', async ({ page }) => {
    await enableGridSight(page);
    const amountLozenge = page.locator(
      '#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]'
    );

    // First click → asc.
    await amountLozenge.click();
    let amounts = await readAmountColumn(page);
    let nums = amounts.map(Number);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    let ariaSort = await page.getAttribute('#tbl-orders thead th:nth-child(2)', 'aria-sort');
    expect(ariaSort).toBe('ascending');

    // Second click → desc.
    await amountLozenge.click();
    amounts = await readAmountColumn(page);
    nums = amounts.map(Number);
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
    ariaSort = await page.getAttribute('#tbl-orders thead th:nth-child(2)', 'aria-sort');
    expect(ariaSort).toBe('descending');

    // Third click → off, original order restored.
    await amountLozenge.click();
    amounts = await readAmountColumn(page);
    expect(amounts).toEqual(['999', '299', '120', '450', '15', '75', '35', '180']);
    ariaSort = await page.getAttribute('#tbl-orders thead th:nth-child(2)', 'aria-sort');
    expect(ariaSort === null || ariaSort === 'none').toBeTruthy();
  });

  test('categorical column sorts locale-aware', async ({ page }) => {
    await enableGridSight(page);
    const regionLozenge = page.locator(
      '#tbl-orders thead th:nth-child(3) [data-gs-lozenge-id="sort"]'
    );
    await regionLozenge.click();
    const regions = await page.$$eval('#tbl-orders tbody tr td:nth-child(3)', (cells) =>
      cells.map((c) => (c.textContent ?? '').trim())
    );
    expect(regions).toEqual([...regions].sort((a, b) => a.localeCompare(b)));
  });

  test('only one column drives sort at a time', async ({ page }) => {
    await enableGridSight(page);
    const amountLozenge = page.locator(
      '#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]'
    );
    const regionLozenge = page.locator(
      '#tbl-orders thead th:nth-child(3) [data-gs-lozenge-id="sort"]'
    );
    await amountLozenge.click(); // amount asc
    await regionLozenge.click(); // region asc, amount sort cleared
    const amountAria = await page.getAttribute('#tbl-orders thead th:nth-child(2)', 'aria-sort');
    expect(amountAria === null || amountAria === 'none').toBeTruthy();
    const regionAria = await page.getAttribute('#tbl-orders thead th:nth-child(3)', 'aria-sort');
    expect(regionAria).toBe('ascending');
  });
});
