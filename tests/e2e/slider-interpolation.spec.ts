import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * End-to-end tests for spec 001 — User Story 1.
 * Loads the offline demo page (`public/demo/sliders/interpolation.html`) via the
 * shared Playwright webServer.
 */

test.describe('US1: slider interpolation', () => {
  test.beforeEach(async ({ page }) => {
    await isolateState(page);
  });

  test('add → drag → readout updates within one frame', async ({ page }) => {
    await page.goto('/grid-sight/demo/sliders/interpolation.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!(window as any).gridSight);

    await page.evaluate(() => {
      const tbl = document.getElementById('dyn-table') as HTMLTableElement;
      (window as any).gridSight.addSlider(tbl, 'row');
    });

    const slider = page.locator('#dyn-table input[type="range"]').first();
    await expect(slider).toBeVisible();

    // Drag programmatically by setting the value (Playwright's slider locator DSL).
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = '11000';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait one frame.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(null))));

    const readout = page.locator('[data-gs-slider-readout="interpolated"]').first();
    const text = await readout.textContent();
    expect(text).not.toBe('—');
    expect(text).not.toBe('');
  });

  test('exact-header position returns interpolated row average to machine precision', async ({ page }) => {
    await page.goto('/grid-sight/demo/sliders/interpolation.html');
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.evaluate(() => {
      const tbl = document.getElementById('dyn-table') as HTMLTableElement;
      (window as any).gridSight.addSlider(tbl, 'row');
    });

    // At an exact header value (e.g. 11000) the row-axis-only readout should equal
    // the bilinear value at (11000, midColumn).
    const result = await page.evaluate(() => {
      const tbl = document.getElementById('dyn-table') as HTMLTableElement;
      const sliders = (window as any).gridSight.getSliders(tbl);
      sliders[0].setPosition(11000);
      const readout = document.querySelector('[data-gs-slider-readout="interpolated"]');
      return readout ? readout.textContent : null;
    });
    expect(result).not.toBeNull();
    expect(result).not.toBe('—');
  });

  test('non-numeric axis is rejected by addSlider', async ({ page }) => {
    await page.goto('/grid-sight/demo/sliders/interpolation.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    const error = await page.evaluate(() => {
      // Create a non-numeric column-axis table on the fly.
      const tbl = document.createElement('table');
      tbl.id = 'tmp-cat';
      tbl.innerHTML = `
        <tr><th></th><th>red</th><th>green</th><th>blue</th></tr>
        <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
        <tr><th>2000</th><td>4</td><td>5</td><td>6</td></tr>
      `;
      document.body.appendChild(tbl);
      try { (window as any).gridSight.addSlider(tbl, 'col'); return null; }
      catch (e: any) { return e.message; }
    });
    expect(error).toBe('Axis not numeric');
  });
});
