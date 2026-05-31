import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * Validates the literal quickstart §1 embed snippet (manual `window.gridSight
 * .init()`), not an auto-init fixture. Catches doc/impl drift and confirms the
 * documented pattern does not double-mount when auto-init also fires.
 */

const URL = '/grid-sight/demo/annotations/embed-snippet.html';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

const cell = '#sales tbody tr:first-child td';

test('quickstart §1 embed snippet works and does not double-mount', async ({ page }) => {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);

  // Exactly one GS toggle despite manual init() + auto-init both running.
  await expect(page.locator('#sales .grid-sight-toggle')).toHaveCount(1);

  // Annotations are live: pin present, exactly one per cell.
  await page.waitForSelector(`${cell} .gs-annotation-pin`, { state: 'attached' });
  await expect(page.locator(`${cell} .gs-annotation-pin`)).toHaveCount(1);

  // The documented annotate flow produces a marker.
  await page.locator(cell).hover();
  await page.locator(`${cell} .gs-annotation-pin`).click();
  await page.locator('.gs-annotation-popover textarea').fill('from the embed snippet');
  await page.locator('.gs-annotation-popover button', { hasText: 'Save' }).click();
  await expect(page.locator(`${cell} .gs-annotation-marker`)).toHaveCount(1);
});
