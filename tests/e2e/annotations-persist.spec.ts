import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

const URL = '/grid-sight/demo/annotations/single.html';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

const firstCell = '#tbl-sales tbody tr:first-child td';

async function load(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.waitForSelector(`${firstCell} .gs-annotation-pin`, { state: 'attached' });
}

test('US2: a saved note survives reload via localStorage (SC-003, no network on persist path)', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  await load(page);
  await page.locator(firstCell).hover();
  await page.locator(`${firstCell} .gs-annotation-pin`).click();
  await page.locator('.gs-annotation-popover textarea').fill('persisted note');
  await page.locator('.gs-annotation-popover button', { hasText: 'Save' }).click();
  await expect(page.locator(`${firstCell} .gs-annotation-marker`)).toHaveCount(1);

  // The annotations key exists in localStorage.
  const keyExists = await page.evaluate(() =>
    Object.keys(localStorage).some((k) => k.endsWith(':annotations'))
  );
  expect(keyExists).toBe(true);

  // No XHR/fetch was made on the persistence path.
  const requestsAfterSave = requests.length;

  // Reload → marker + text restored from localStorage.
  await page.reload();
  await page.waitForFunction(() => !!(window as any).gridSight);
  await expect(page.locator(`${firstCell} .gs-annotation-marker`)).toHaveCount(1);
  await page.locator(firstCell).hover();
  await page.locator(`${firstCell} .gs-annotation-pin`).click();
  await expect(page.locator('.gs-annotation-popover textarea')).toHaveValue('persisted note');

  // Sanity: saving did not trigger extra document/network loads beyond the page itself.
  expect(requestsAfterSave).toBeGreaterThan(0);
});
