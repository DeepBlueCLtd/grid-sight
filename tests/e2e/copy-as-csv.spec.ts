import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

const URL = '/grid-sight/demo/copy-as-csv/index.html';
const LOZENGE = '#tbl-sales [data-gs-lozenge-id="copy-as-csv"]';
const POPUP = '.gs-copy-popup';

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await isolateState(page);
});

async function enableGridSight(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as { gridSight?: unknown }).gridSight);
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector(LOZENGE, { state: 'attached' });
}

function clipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe('US1 — one-click CSV copy of the visible view', () => {
  test('copies the visible rows as CSV with a header row first', async ({ page }) => {
    await enableGridSight(page);
    await page.locator(LOZENGE).click();
    await expect(page.locator(POPUP)).toBeVisible();
    await page.locator(`${POPUP} .gs-copy-primary`).click();

    const text = await clipboard(page);
    const lines = text.split('\r\n');
    expect(lines[0]).toBe('Region,Quarter,Units,Revenue');
    // rowspan flatten: the value sits in its origin row, the spanned row is blank.
    expect(text).toContain('North,Q1,120,2400');
    expect(text).toContain(',Q2,150,3100');
  });

  test('announces the row × column count in a toast', async ({ page }) => {
    await enableGridSight(page);
    await page.locator(LOZENGE).click();
    await page.locator(`${POPUP} .gs-copy-primary`).click();
    const toast = page.locator('#gs-copy-toast');
    await expect(toast).toHaveText(/Copied 6 rows × 4 columns as CSV/);
  });

  test('omits rows marked data-gs-no-export even when visible', async ({ page }) => {
    await enableGridSight(page);
    await page.evaluate(() => {
      const rows = document.querySelectorAll('#tbl-sales tbody tr');
      rows.forEach((r) => {
        if (r.textContent && r.textContent.includes('East')) {
          r.setAttribute('data-gs-no-export', '');
        }
      });
    });
    await page.locator(LOZENGE).click();
    await page.locator(`${POPUP} .gs-copy-primary`).click();
    const text = await clipboard(page);
    expect(text).not.toContain('East');
    expect(text).toContain('West');
  });

  test('falls back to a pre-selected textarea when the clipboard is unavailable', async ({
    page,
    context,
  }) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        get() {
          return { writeText: () => Promise.reject(new Error('denied')) };
        },
      });
    });
    await enableGridSight(page);
    await page.locator(LOZENGE).click();
    await page.locator(`${POPUP} .gs-copy-primary`).click();
    const ta = page.locator(`${POPUP} textarea`);
    await expect(ta).toBeVisible();
    await expect(ta).toHaveValue(/Region,Quarter,Units,Revenue/);
  });

  test('toggling Grid-Sight off removes the lozenge and any open popup', async ({ page }) => {
    await enableGridSight(page);
    await page.locator(LOZENGE).click();
    await expect(page.locator(POPUP)).toBeVisible();
    await page.locator('.grid-sight-toggle').first().click();
    await expect(page.locator(LOZENGE)).toHaveCount(0);
    await expect(page.locator(POPUP)).toHaveCount(0);
  });
});

test.describe('US2 — format choice + persistence', () => {
  test('copies a GitHub-flavoured Markdown table when Markdown is picked', async ({ page }) => {
    await enableGridSight(page);
    await page.locator(LOZENGE).click();
    await page.locator(`${POPUP} input[value="md"]`).check();
    await page.locator(`${POPUP} .gs-copy-primary`).click();
    const text = await clipboard(page);
    expect(text.split('\n')[0]).toBe('| Region | Quarter | Units | Revenue |');
    expect(text.split('\n')[1]).toContain('---:'); // numeric columns right-aligned
  });

  test('remembers the chosen format across a reload', async ({ page }) => {
    await enableGridSight(page);
    await page.locator(LOZENGE).click();
    await page.locator(`${POPUP} input[value="md"]`).check();
    // close, reload, reopen
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => !!(window as { gridSight?: unknown }).gridSight);
    await page.locator('.grid-sight-toggle').first().click();
    await page.locator(LOZENGE).click();
    await expect(page.locator(`${POPUP} input[value="md"]`)).toBeChecked();
  });

  test('falls back to CSV when the URL carries an unsupported format', async ({ page }) => {
    await page.goto(`${URL}#gs.cp=fmt:xlsx;h:1;rh:1;vc:1`);
    await page.waitForFunction(() => !!(window as { gridSight?: unknown }).gridSight);
    await page.locator('.grid-sight-toggle').first().click();
    await page.waitForSelector(LOZENGE, { state: 'attached' });
    await page.locator(LOZENGE).click();
    await expect(page.locator(`${POPUP} input[value="csv"]`)).toBeChecked();
  });
});
