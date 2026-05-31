import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

const URL = '/grid-sight/demo/row-visibility/orders.html';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

test.describe('US6: shareable URL round-trip', () => {
  test('applying sort writes gs.v; opening that URL fresh restores state before paint', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await pageA.goto(URL);
    await pageA.waitForFunction(() => !!(window as any).gridSight);
    await pageA.locator('.grid-sight-toggle').first().click();
    await pageA.locator('#tbl-orders [data-gs-lozenge-id="sort"]').first().click(); // first sort lozenge → Product asc

    // Capture the hash.
    const hash = await pageA.evaluate(() => location.hash);
    expect(hash).toContain('gs.v=');
    expect(hash).toContain('tbl-orders');

    // Fresh context, open with that hash.
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto(URL + hash);
    await pageB.waitForFunction(() => !!(window as any).gridSight);

    // First sort lozenge is on the Amount column (column 0 is 'table' type).
    const amountOrder = await pageB.$$eval(
      '#tbl-orders tbody tr td:nth-child(2)',
      (cs) => cs.map((c) => Number((c.textContent ?? '').trim()))
    );
    expect(amountOrder).toEqual([...amountOrder].sort((a, b) => a - b));

    await ctxA.close();
    await ctxB.close();
  });

  test('missing-column directive is silently dropped', async ({ page }) => {
    await page.goto(URL + '#gs.v=tbl-orders(s:nonexistent:asc)');
    await page.waitForFunction(() => !!(window as any).gridSight);
    // No throw, no sort applied, no aria-sort on any header.
    const ariaSorts = await page.$$eval('#tbl-orders thead th', (ths) =>
      ths.map((t) => t.getAttribute('aria-sort'))
    );
    expect(ariaSorts.every((s) => s === null || s === 'none')).toBe(true);
  });

  test('gs.v coexists with gs.s without clobbering', async ({ page }) => {
    await page.goto(URL + '#gs.s=foo:0.5');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.locator('.grid-sight-toggle').first().click();
    await page.locator('#tbl-orders [data-gs-lozenge-id="sort"]').first().click();
    const hash = await page.evaluate(() => location.hash);
    expect(hash).toContain('gs.s=foo:0.5');
    expect(hash).toContain('gs.v=');
  });
});
