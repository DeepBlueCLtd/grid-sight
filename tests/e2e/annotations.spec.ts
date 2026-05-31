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

test('US1: annotate → marker → reopen → delete (SC-001 ≤ 3 interactions)', async ({ page }) => {
  await load(page);

  // 1. Reveal the pin and open the editor.
  await page.locator(firstCell).hover();
  await page.locator(`${firstCell} .gs-annotation-pin`).click();

  // 2. Type a note and save.
  await page.locator('.gs-annotation-popover textarea').fill('check this');
  await page.locator('.gs-annotation-popover button', { hasText: 'Save' }).click();

  // Marker appears + aria-describedby wired.
  const marker = page.locator(`${firstCell} .gs-annotation-marker`);
  await expect(marker).toHaveCount(1);
  await expect(page.locator(firstCell)).toHaveAttribute('aria-describedby', /.+/);

  // Reopen via the pin → existing text shown, Delete enabled.
  await page.locator(firstCell).hover();
  await page.locator(`${firstCell} .gs-annotation-pin`).click();
  await expect(page.locator('.gs-annotation-popover textarea')).toHaveValue('check this');
  const del = page.locator('.gs-annotation-popover button', { hasText: 'Delete' });
  await expect(del).toBeEnabled();

  // Delete → marker and aria-describedby disappear.
  await del.click();
  await expect(marker).toHaveCount(0);
  await expect(page.locator(firstCell)).not.toHaveAttribute('aria-describedby', /.+/);
});
