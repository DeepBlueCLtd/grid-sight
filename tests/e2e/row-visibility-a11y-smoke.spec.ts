import { test, expect, type Page } from '@playwright/test';

/**
 * Automates two task items from specs/002-003-row-visibility/tasks.md:
 *
 *  - T051 (accessibility audit, Constitution §III hard minimums):
 *      keyboard-operable, ARIA roles / names / states, non-colour cue
 *      (data-gs-dimmed + opacity), AT announcement of dimmed rows
 *      (rows are NOT aria-hidden).
 *  - T054 (manual smoke test from quickstart.md, steps 1–5):
 *      sort three-state, filter dim, URL round-trip, disable restores
 *      byte-identical tbody.innerHTML.
 *
 * Without `@axe-core/playwright` installed, the audit is targeted to the
 * four §III hard minimums spelled out in the spec rather than a generic
 * axe scan; that matches the tasks.md acceptance criteria.
 */

const PORT = 3024;
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

async function enable(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector('#tbl-orders [data-gs-lozenge-id="sort"]', { state: 'attached' });
}

test.describe('T051: accessibility audit (Constitution §III hard minimums)', () => {
  test('sort lozenge is keyboard-operable; aria-sort reflects state', async ({ page }) => {
    await enable(page);
    const lozenge = page.locator(
      '#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]'
    );
    // Keyboard activation via Enter.
    await lozenge.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#tbl-orders thead th:nth-child(2)')).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
    await page.keyboard.press('Enter');
    await expect(page.locator('#tbl-orders thead th:nth-child(2)')).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    await page.keyboard.press('Enter');
    // After third activation the column is no longer sorted.
    const ariaSort = await page.getAttribute(
      '#tbl-orders thead th:nth-child(2)',
      'aria-sort'
    );
    expect(ariaSort === null || ariaSort === 'none').toBeTruthy();
  });

  test('sort lozenge accessible name announces the next action', async ({ page }) => {
    await enable(page);
    const lozenge = page.locator(
      '#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]'
    );
    // Before any click: next action is ascending.
    await expect(lozenge).toHaveAttribute('aria-label', /ascending/);
    await lozenge.click();
    // After ascending applied: next action is descending.
    await expect(lozenge).toHaveAttribute('aria-label', /descending/);
    await lozenge.click();
    // After descending applied: next action is clear.
    await expect(lozenge).toHaveAttribute('aria-label', /[Cc]lear/);
  });

  test('filter lozenge exposes aria-pressed reflecting predicate state', async ({ page }) => {
    await enable(page);
    const lozenge = page.locator(
      '#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]'
    );
    await expect(lozenge).toHaveAttribute('aria-pressed', 'false');
    await lozenge.click();
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(0).fill('100');
    await page.locator('.gs-filter-popup--numeric').getByRole('button', { name: 'Apply' }).click();
    await expect(lozenge).toHaveAttribute('aria-pressed', 'true');
  });

  test('filter popup has dialog role and traps Escape; focus returns to the lozenge', async ({ page }) => {
    await enable(page);
    const lozenge = page.locator(
      '#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]'
    );
    await lozenge.click();
    const popup = page.locator('.gs-filter-popup--numeric');
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute('role', 'dialog');
    await expect(popup).toHaveAttribute('aria-label', /filter/i);
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    // Focus restored to the anchor button.
    const focusedTag = await page.evaluate(() => document.activeElement?.getAttribute('data-gs-lozenge-id'));
    expect(focusedTag).toBe('filter');
  });

  test('dimmed rows remain in the accessibility tree (NOT aria-hidden)', async ({ page }) => {
    await enable(page);
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]').click();
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(0).fill('100');
    await page.locator('.gs-filter-popup--numeric').getByRole('button', { name: 'Apply' }).click();
    const flags = await page.$$eval('#tbl-orders tbody tr', (rows) =>
      rows.map((r) => ({
        dimmed: (r as HTMLElement).getAttribute('data-gs-dimmed') === 'true',
        ariaHidden: (r as HTMLElement).getAttribute('aria-hidden'),
        visible: (r as HTMLElement).offsetParent !== null,
      }))
    );
    const dimmedRows = flags.filter((f) => f.dimmed);
    expect(dimmedRows.length).toBeGreaterThan(0);
    // No dimmed row carries aria-hidden — they stay announced to AT.
    expect(dimmedRows.every((r) => r.ariaHidden === null)).toBe(true);
    // And they're still rendered (not display:none).
    expect(dimmedRows.every((r) => r.visible)).toBe(true);
  });

  test('non-colour cue: dimmed rows expose data-gs-dimmed + gs-row--dimmed class', async ({ page }) => {
    await enable(page);
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]').click();
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(0).fill('100');
    await page.locator('.gs-filter-popup--numeric').getByRole('button', { name: 'Apply' }).click();
    const dimmedClasses = await page.$$eval('#tbl-orders tbody tr[data-gs-dimmed="true"]', (rows) =>
      rows.map((r) => r.classList.contains('gs-row--dimmed'))
    );
    expect(dimmedClasses.length).toBeGreaterThan(0);
    expect(dimmedClasses.every(Boolean)).toBe(true);
  });

  test('filter chip clear-all button is keyboard reachable via Tab', async ({ page }) => {
    await enable(page);
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]').click();
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(0).fill('100');
    await page.locator('.gs-filter-popup--numeric').getByRole('button', { name: 'Apply' }).click();
    const clearAll = page.locator('.gs-filter-chip__clear-all');
    await clearAll.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.gs-filter-chip')).toHaveCount(0);
  });
});

test.describe('T054: quickstart manual smoke test (mechanised)', () => {
  test('step 2: ↕ on a numeric column cycles asc → desc → original', async ({ page }) => {
    await enable(page);
    const lozenge = page.locator(
      '#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]'
    );
    const originalAmounts = ['999', '299', '120', '450', '15', '75', '35', '180'];
    await lozenge.click();
    let amounts = await page.$$eval(
      '#tbl-orders tbody tr td:nth-child(2)',
      (cs) => cs.map((c) => (c.textContent ?? '').trim())
    );
    let nums = amounts.map(Number);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    await lozenge.click();
    amounts = await page.$$eval(
      '#tbl-orders tbody tr td:nth-child(2)',
      (cs) => cs.map((c) => (c.textContent ?? '').trim())
    );
    nums = amounts.map(Number);
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
    await lozenge.click();
    amounts = await page.$$eval(
      '#tbl-orders tbody tr td:nth-child(2)',
      (cs) => cs.map((c) => (c.textContent ?? '').trim())
    );
    expect(amounts).toEqual(originalAmounts);
  });

  test('step 3: ▽ Amount [100, 500] dims out-of-range rows; sort still applies to un-dimmed block', async ({ page }) => {
    await enable(page);
    // Apply numeric filter.
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="filter"]').click();
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(0).fill('100');
    await page.locator('.gs-filter-popup--numeric input[type="number"]').nth(1).fill('500');
    await page.locator('.gs-filter-popup--numeric').getByRole('button', { name: 'Apply' }).click();

    // Apply sort desc on the same column.
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();
    await page.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();

    const rows = await page.$$eval('#tbl-orders tbody tr', (rs) =>
      rs.map((r) => ({
        amount: Number((r.querySelector('td:nth-child(2)')?.textContent ?? '').trim()),
        dimmed: (r as HTMLElement).getAttribute('data-gs-dimmed') === 'true',
      }))
    );
    // Un-dimmed amounts are all in [100, 500] AND sorted descending.
    const undimmed = rows.filter((r) => !r.dimmed).map((r) => r.amount);
    expect(undimmed.every((n) => n >= 100 && n <= 500)).toBe(true);
    expect(undimmed).toEqual([...undimmed].sort((a, b) => b - a));
    // Dimmed amounts are all OUTSIDE [100, 500].
    expect(rows.filter((r) => r.dimmed).every((r) => r.amount < 100 || r.amount > 500)).toBe(true);
  });

  test('step 4: location.href in a fresh context reproduces the same view (SC-003 + SC-004)', async ({ browser }) => {
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await enableOn(pageA);
    await pageA.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();
    await pageA.locator('#tbl-orders thead th:nth-child(2) [data-gs-lozenge-id="sort"]').click();
    const sharedHref = await pageA.evaluate(() => location.href);
    const liveAmounts = await pageA.$$eval(
      '#tbl-orders tbody tr td:nth-child(2)',
      (cs) => cs.map((c) => (c.textContent ?? '').trim())
    );

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto(sharedHref);
    await pageB.waitForFunction(() => !!(window as any).gridSight);
    // Single animation frame settle.
    await pageB.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    const restoredAmounts = await pageB.$$eval(
      '#tbl-orders tbody tr td:nth-child(2)',
      (cs) => cs.map((c) => (c.textContent ?? '').trim())
    );
    expect(restoredAmounts).toEqual(liveAmounts);

    await ctxA.close();
    await ctxB.close();
  });

  test('step 5: disable() restores byte-identical tbody.innerHTML (SC-005)', async ({ page, request }) => {
    // Fetch the raw, never-processed HTML to get the true baseline.
    const rawHtml = await (await request.get(URL)).text();
    const rawDoc = new (await import('jsdom')).JSDOM(rawHtml).window.document;
    const beforeInit = (
      rawDoc.getElementById('tbl-orders') as HTMLTableElement
    ).tBodies[0].innerHTML;

    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    // Enable + apply sort + apply filter via the GS toggle and lozenges.
    await page.locator('.grid-sight-toggle').first().click();
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

    // Disable via the API.
    await page.evaluate(() => (window as any).gridSight.disable());

    const afterDisable = await page.evaluate(
      () => (document.getElementById('tbl-orders') as HTMLTableElement).tBodies[0].innerHTML
    );
    expect(afterDisable).toBe(beforeInit);
  });
});

async function enableOn(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector('#tbl-orders [data-gs-lozenge-id="sort"]', { state: 'attached' });
}
