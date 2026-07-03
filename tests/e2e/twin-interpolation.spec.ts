import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * End-to-end tests for spec 016 — twin (grouped) interpolation.
 * Drives the offline demo (`public/demo/twin-table/index.html`): enable
 * Grid-Sight, add the synced twin sliders, and exercise the value-sync +
 * out-of-range-disable behaviour across the Summer / Winter blocks.
 */

const SPEED = 'input[data-gs-twin-input="speed"]';

async function enableTwin(page: import('@playwright/test').Page) {
  await page.goto('/grid-sight/demo/twin-table/index.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.locator('#twin-table .grid-sight-toggle').first().click();
  await page.locator('#twin-table [data-gs-lozenge-id="sliders"]').first().click();
}

test.describe('spec 016: twin interpolation', () => {
  test.beforeEach(async ({ page }) => {
    await isolateState(page);
  });

  test('only the slider lozenge is offered (no misplaced H/#)', async ({ page }) => {
    await page.goto('/grid-sight/demo/twin-table/index.html');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.locator('#twin-table .grid-sight-toggle').first().click();
    await expect(page.locator('#twin-table [data-gs-lozenge-id]')).toHaveCount(1);
    await expect(page.locator('#twin-table [data-gs-lozenge-id="sliders"]')).toHaveCount(1);
  });

  test('adds one shared direction slider and one speed slider per block', async ({ page }) => {
    await enableTwin(page);
    await expect(page.locator('#twin-table input[data-gs-twin-input="dir"]')).toHaveCount(1);
    await expect(page.locator(`#twin-table ${SPEED}`)).toHaveCount(2);
    // Both blocks live inside the initial overlap: 8 highlighted cells (4 each).
    await expect(page.locator('#twin-table .gs-slider-highlight')).toHaveCount(8);
    // One interpolated-position marker (circle) per block, both visible.
    const markers = page.locator('[data-gs-marker]');
    await expect(markers).toHaveCount(2);
    for (let i = 0; i < 2; i++) await expect(markers.nth(i)).toBeVisible();
  });

  test('speed syncs across blocks in the overlap', async ({ page }) => {
    await enableTwin(page);
    const speeds = page.locator(`#twin-table ${SPEED}`);
    await speeds.first().evaluate((el: HTMLInputElement) => {
      el.value = '50';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(speeds.nth(1)).toHaveJSProperty('value', '50');
    await expect(speeds.first()).toHaveJSProperty('disabled', false);
    await expect(speeds.nth(1)).toHaveJSProperty('disabled', false);
  });

  test('turning Grid-Sight off removes all twin adornments', async ({ page }) => {
    await enableTwin(page);
    await expect(page.locator(`#twin-table ${SPEED}`)).toHaveCount(2);
    // Click the corner GS toggle off.
    await page.locator('#twin-table .grid-sight-toggle').first().click();
    await expect(page.locator('#twin-table [data-gs-twin-input]')).toHaveCount(0);
    await expect(page.locator('#twin-table [data-gs-twin-row]')).toHaveCount(0);
    await expect(page.locator('#twin-table [data-gs-twin-block-ui]')).toHaveCount(0);
    await expect(page.locator('#twin-table .gs-slider-highlight')).toHaveCount(0);
    await expect(page.locator('#twin-table [data-gs-lozenge-id]')).toHaveCount(0);
  });

  test('out-of-range block disables its slider and clears its marker', async ({ page }) => {
    await enableTwin(page);
    const speeds = page.locator(`#twin-table ${SPEED}`);
    await speeds.first().evaluate((el: HTMLInputElement) => {
      el.value = '70'; // inside Summer (30–80), outside Winter (20–60)
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(speeds.first()).toHaveJSProperty('disabled', false);
    await expect(speeds.nth(1)).toHaveJSProperty('disabled', true);
    // Only Summer's four cells stay highlighted.
    await expect(page.locator('#twin-table .gs-slider-highlight')).toHaveCount(4);
    const winterReadout = page.locator('#twin-table .gs-twin-readout[data-out-of-range]');
    await expect(winterReadout).toHaveText('—');
  });
});
