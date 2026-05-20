import { test, expect, type Page } from '@playwright/test';

const PORT = 3021;
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
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector('#tbl-orders [data-gs-lozenge-id="filter"]', { state: 'attached' });
}

async function dimmedFlags(page: Page): Promise<boolean[]> {
  return page.$$eval('#tbl-orders tbody tr', (rows) =>
    rows.map((r) => (r as HTMLElement).getAttribute('data-gs-dimmed') === 'true')
  );
}

test.describe('US2: numeric filter', () => {
  test('opens popup; min/max dim out-of-range rows in place', async ({ page }) => {
    await enableGridSight(page);
    const filterLozenge = page.locator(
      '#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]'
    );
    await filterLozenge.click();
    const popup = page.locator('.gs-filter-popup--numeric');
    await expect(popup).toBeVisible();

    await popup.locator('input[type="number"]').nth(0).fill('100');
    await popup.locator('input[type="number"]').nth(1).fill('500');
    await popup.getByRole('button', { name: 'Apply' }).click();

    // Popup closes; rows remain present; dim flags set for out-of-range rows.
    await expect(popup).toHaveCount(0);
    await expect(page.locator('#tbl-orders tbody tr')).toHaveCount(8);
    // Amounts: 999, 299, 120, 450, 15, 75, 35, 180.
    // In range [100,500]: 299, 120, 450, 180  → dimmed=false at indexes 1,2,3,7.
    const flags = await dimmedFlags(page);
    expect(flags).toEqual([true, false, false, false, true, true, true, false]);

    // aria-pressed on the lozenge is now true.
    await expect(filterLozenge).toHaveAttribute('aria-pressed', 'true');
  });

  test('Escape closes the popup without applying', async ({ page }) => {
    await enableGridSight(page);
    await page
      .locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]')
      .click();
    const popup = page.locator('.gs-filter-popup--numeric');
    await expect(popup).toBeVisible();
    await popup.locator('input[type="number"]').nth(0).fill('500');
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    // No filter applied → no dim flags set.
    const flags = await dimmedFlags(page);
    expect(flags.every((f) => !f)).toBe(true);
  });
});

test.describe('US3: categorical filter', () => {
  test('checkbox list filters by inclusion', async ({ page }) => {
    await enableGridSight(page);
    await page
      .locator('#tbl-orders thead th:nth-child(3) [data-gs-lozenge-id="filter"]')
      .click();
    const popup = page.locator('.gs-filter-popup--categorical');
    await expect(popup).toBeVisible();
    // Uncheck JP, US — keep EU only.
    const list = popup.locator('.gs-filter-popup__list label');
    const count = await list.count();
    for (let i = 0; i < count; i++) {
      const label = list.nth(i);
      const text = (await label.textContent()) ?? '';
      if (!text.startsWith(' EU')) {
        await label.locator('input[type="checkbox"]').uncheck();
      }
    }
    await popup.getByRole('button', { name: 'Apply' }).click();
    await expect(popup).toHaveCount(0);

    const regions = await page.$$eval('#tbl-orders tbody tr', (rows) =>
      rows.map((r) => ({
        region: (r.querySelector('td:nth-child(3)')?.textContent ?? '').trim(),
        dimmed: (r as HTMLElement).getAttribute('data-gs-dimmed') === 'true',
      }))
    );
    for (const r of regions) {
      expect(r.dimmed).toBe(r.region !== 'EU');
    }
  });

  test('search narrows the visible checkbox list without changing selection', async ({ page }) => {
    await enableGridSight(page);
    await page
      .locator('#tbl-orders thead th:nth-child(3) [data-gs-lozenge-id="filter"]')
      .click();
    const popup = page.locator('.gs-filter-popup--categorical');
    await popup.locator('.gs-filter-popup__search').fill('eu');
    // Only EU should be visible.
    const visibleLabels = await popup.locator('.gs-filter-popup__list label').evaluateAll(
      (labels) => labels.filter((l) => (l as HTMLElement).style.display !== 'none').map((l) => (l.textContent ?? '').trim())
    );
    expect(visibleLabels.length).toBe(1);
    expect(visibleLabels[0]).toContain('EU');
  });
});

test.describe('US4: filter chip + compose + clear-all', () => {
  test('two filters compose AND; chip lists both; per-chip remove restores; clear-all empties', async ({ page }) => {
    await enableGridSight(page);

    // Numeric: amount >= 100.
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]').click();
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(0).fill('100');
    await page.locator('.gs-filter-popup--numeric').getByRole('button', { name: 'Apply' }).click();

    // Categorical: region in {EU}.
    await page.locator('#tbl-orders thead th:nth-child(3) [data-gs-lozenge-id="filter"]').click();
    const popup = page.locator('.gs-filter-popup--categorical');
    const labels = popup.locator('.gs-filter-popup__list label');
    const lc = await labels.count();
    for (let i = 0; i < lc; i++) {
      const t = (await labels.nth(i).textContent()) ?? '';
      if (!t.startsWith(' EU')) await labels.nth(i).locator('input[type="checkbox"]').uncheck();
    }
    await popup.getByRole('button', { name: 'Apply' }).click();

    // Chip lists 2 entries + Clear all.
    await expect(page.locator('.gs-filter-chip')).toHaveCount(2);
    await expect(page.locator('.gs-filter-chip__clear-all')).toHaveCount(1);

    // Verify AND composition: only Laptop(999/EU) and Chair(120/EU) un-dimmed.
    const dimmed = await dimmedFlags(page);
    const products = await page.$$eval('#tbl-orders tbody tr td:first-child', (cs) =>
      cs.map((c) => {
        // The first td may host a row-header lozenge cluster; read just the
        // leading text node, not all descendants.
        for (const node of Array.from(c.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim();
        }
        return (c.textContent ?? '').trim();
      })
    );
    const undimmedProducts = products.filter((_, i) => !dimmed[i]);
    expect(undimmedProducts.sort()).toEqual(['Chair', 'Laptop']);

    // Remove the numeric chip via its × button.
    const firstChipRemove = page.locator('.gs-filter-chip').first().locator('.gs-filter-chip__remove');
    await firstChipRemove.click();
    await expect(page.locator('.gs-filter-chip')).toHaveCount(1);

    // Clear all.
    await page.locator('.gs-filter-chip__clear-all').click();
    await expect(page.locator('.gs-filter-chip')).toHaveCount(0);
    await expect(page.locator('.gs-filter-chip-container')).toBeEmpty();
  });

  test('zero-match → empty-state message renders', async ({ page }) => {
    await enableGridSight(page);
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]').click();
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(0).fill('99999');
    await page.locator('.gs-filter-popup--numeric').getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.gs-filter-empty-state')).toContainText('No rows match');
  });
});
