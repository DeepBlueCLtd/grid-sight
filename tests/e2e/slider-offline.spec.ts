import { test, expect } from '@playwright/test';
import path from 'node:path';

/**
 * Verifies that the slider demo functions with no network access (constitution §VI).
 * Loads the demo from `file://`, exercises a full slider drag, and asserts that no
 * non-`file://` network requests are issued.
 */

test.describe('US Polish: slider works fully offline', () => {
  test('drag a slider on the file:// demo with zero network requests', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('about:')) {
        requests.push(url);
      }
    });

    const fileUrl = 'file://' + path.resolve(process.cwd(), 'dist', 'demo', 'sliders', 'interpolation.html');
    await page.goto(fileUrl);
    await page.waitForFunction(() => !!(window as any).gridSight);

    await page.evaluate(() => {
      const tbl = document.getElementById('dyn-table') as HTMLTableElement;
      (window as any).gridSight.addSlider(tbl, 'row');
      const sliders = (window as any).gridSight.getSliders(tbl);
      sliders[0].setPosition(11000);
    });

    expect(requests).toEqual([]);
  });
});
