import { test, expect, type Page } from '@playwright/test';

const PORT = 3063;
const URL = `http://localhost:${PORT}/grid-sight/demo/annotations/single.html`;

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

const acmeCell = '#tbl-sales tbody tr[data-gs-row-key="acme"] td';

async function load(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.waitForSelector(`${acmeCell} .gs-annotation-pin`, { state: 'attached' });
}

test('US2: a note stays on its source cell across sort + filter (SC-004)', async ({ page }) => {
  await load(page);

  // Annotate Acme · Q3.
  await page.locator(acmeCell).hover();
  await page.locator(`${acmeCell} .gs-annotation-pin`).click();
  await page.locator('.gs-annotation-popover textarea').fill('glued to acme');
  await page.locator('.gs-annotation-popover button', { hasText: 'Save' }).click();
  await expect(page.locator(`${acmeCell} .gs-annotation-marker`)).toHaveCount(1);

  // Enable Grid-Sight lozenges, then sort the Q3 column ascending (Acme 1200
  // moves to the bottom).
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector('#tbl-sales [data-gs-lozenge-id="sort"]', { state: 'attached' });
  await page.locator('#tbl-sales thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();

  // The marker is still on the Acme row's Q3 cell, not on whatever row now sits
  // in Acme's old position.
  await expect(page.locator(`${acmeCell} .gs-annotation-marker`)).toHaveCount(1);

  // Now filter Q3 >= 1000 (only Acme qualifies); the marker must persist.
  await page.locator('#tbl-sales thead th:nth-child(2) [data-gs-lozenge-id="filter"]').click();
  const popup = page.locator('.gs-filter-popup--numeric');
  await expect(popup).toBeVisible();
  await popup.locator('input[type="number"]').nth(0).fill('1000');
  await popup.getByRole('button', { name: 'Apply' }).click();

  await expect(page.locator(`${acmeCell} .gs-annotation-marker`)).toHaveCount(1);
  await expect(page.locator('#tbl-sales tbody tr[data-gs-row-key="acme"]')).not.toHaveAttribute(
    'data-gs-dimmed',
    'true'
  );
});
