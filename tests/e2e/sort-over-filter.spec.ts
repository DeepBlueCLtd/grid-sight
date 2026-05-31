import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

const URL = '/grid-sight/demo/row-visibility/orders.html';
const PERF_URL = '/grid-sight/demo/row-visibility/perf-1000.html';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

async function enableGridSight(page: Page, url = URL): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector('table [data-gs-lozenge-id="sort"]', { state: 'attached' });
}

test.describe('US5: sort over filter (golden flow)', () => {
  test('filter then sort: dimmed rows anchor; visible rows fill in sort order', async ({ page }) => {
    await enableGridSight(page);

    // Filter Amount >= 100 (dims 15, 75, 35).
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]').click();
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(0).fill('100');
    await page.locator('.gs-filter-popup--numeric').getByRole('button', { name: 'Apply' }).click();

    // Sort Amount desc.
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();

    const rows = await page.$$eval('#tbl-orders tbody tr', (rs) =>
      rs.map((r) => ({
        amount: (r.querySelector('td:nth-child(2)')?.textContent ?? '').trim(),
        dimmed: (r as HTMLElement).getAttribute('data-gs-dimmed') === 'true',
      }))
    );

    // Dimmed rows (15, 75, 35) keep OOR positions 4,5,6.
    expect(rows[4]).toEqual({ amount: '15', dimmed: true });
    expect(rows[5]).toEqual({ amount: '75', dimmed: true });
    expect(rows[6]).toEqual({ amount: '35', dimmed: true });

    // Visible-row slots (0,1,2,3,7) get amounts sorted desc: 999,450,299,180,120.
    const visibleAmounts = [rows[0], rows[1], rows[2], rows[3], rows[7]]
      .filter((r) => !r.dimmed)
      .map((r) => r.amount);
    expect(visibleAmounts).toEqual(['999', '450', '299', '180', '120']);
  });

  test('clearing the filter shows every row in sort order', async ({ page }) => {
    await enableGridSight(page);
    // Sort desc, then filter, then clear filter.
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();

    await page.locator('#tbl-orders thead th:nth-child(3) [data-gs-lozenge-id="filter"]').click();
    const popup = page.locator('.gs-filter-popup--categorical');
    const labels = popup.locator('.gs-filter-popup__list label');
    const lc = await labels.count();
    for (let i = 0; i < lc; i++) {
      const t = (await labels.nth(i).textContent()) ?? '';
      if (!t.startsWith(' EU')) await labels.nth(i).locator('input[type="checkbox"]').uncheck();
    }
    await popup.getByRole('button', { name: 'Apply' }).click();

    // Clear via the clear-all chip.
    await page.locator('.gs-filter-chip__clear-all').click();
    await expect(page.locator('.gs-filter-chip')).toHaveCount(0);

    // All rows un-dimmed and in desc order.
    const flags = await page.$$eval('#tbl-orders tbody tr', (rows) =>
      rows.map((r) => (r as HTMLElement).getAttribute('data-gs-dimmed') === 'true')
    );
    expect(flags.every((f) => !f)).toBe(true);
    const amounts = await page.$$eval(
      '#tbl-orders tbody tr td:nth-child(2)',
      (cs) => cs.map((c) => Number((c.textContent ?? '').trim()))
    );
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });
});

test.describe('SC-002: performance budget', () => {
  test('1 000-row sort completes within 100 ms', async ({ page }) => {
    await enableGridSight(page, PERF_URL);
    // Use programmatic API for a precise measurement (avoid click latency).
    const elapsed = await page.evaluate(() => {
      const t = document.getElementById('tbl-perf') as HTMLTableElement;
      const headerLozenge = t.querySelector(
        'thead th:nth-child(2) [data-gs-lozenge-id="sort"]'
      ) as HTMLButtonElement;
      const start = performance.now();
      headerLozenge.click();
      return performance.now() - start;
    });
    expect(elapsed).toBeLessThan(100);
  });
});
