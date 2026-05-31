/**
 * Cross-feature regression: sort + heatmap interaction on a numeric
 * table with NO explicit <thead> (the slider-demo shape). The header
 * row sits inside the browser's implicit <tbody>, so the row-visibility
 * pipeline must explicitly skip it — otherwise it gets sorted into the
 * data block and the column labels end up on row 1 (or worse).
 *
 * Also exercises the heatmap lozenge alongside sort to confirm the two
 * features coexist on the same table.
 */
import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

const URL = '/grid-sight/demo/sliders/heatmap.html';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

async function enableAndPromoteToFullSet(page: Page): Promise<void> {
  // heatmap.html ships with pageConfig limited to ['heatmap','sliders',
  // 'slider-threshold']. For this regression we need 'sort' too, so we
  // set the visitor override via the URL fragment that spec 012's
  // resolver honours (URL > localStorage > pageConfig).
  await page.goto(URL + '#gs.e=heatmap,sliders,slider-threshold,sort');
  await page.waitForFunction(() => !!(window as any).gridSight);
  // Activate the first table (South Atlantic).
  await page.locator('#south-atlantic .grid-sight-toggle').click();
  await page.waitForSelector('#south-atlantic [data-gs-lozenge-id="sort"]', { state: 'attached' });
}

test.describe('sort on implicit-thead tables (slider-demo shape)', () => {
  test('sorting a numeric column does not move the header row', async ({ page }) => {
    await enableAndPromoteToFullSet(page);

    const headerBefore = await page.$eval('#south-atlantic tr:first-child', (tr) =>
      Array.from(tr.cells).map((c) => {
        const t = Array.from(c.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
        return ((t?.textContent ?? '')).trim();
      })
    );
    // First cell is empty (corner); next five are 10/20/30/40/50.
    expect(headerBefore.slice(1, 6)).toEqual(['10', '20', '30', '40', '50']);

    // Click the sort lozenge on the first data column ("10").
    // Column 1 (0 = corner). Lozenge is on the column header.
    await page
      .locator('#south-atlantic tr:first-child th:nth-child(2) [data-gs-lozenge-id="sort"]')
      .click();

    // After ascending sort on "10", row order should be (by first-cell):
    //   header ('' empty), then 21000, 16000, 11000, 6000, 1000
    //   (data ordered by ascending "10" column: 1.8, 2.3, 2.8, 3.4, 4.0)
    const firstCells = await page.$$eval(
      '#south-atlantic tr',
      (rows) => rows.map((r) => {
        const c = r.cells[0];
        const t = Array.from(c.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
        return ((t?.textContent ?? '')).trim();
      })
    );
    expect(firstCells[0]).toBe('');  // header row stayed put
    expect(firstCells.slice(1)).toEqual(['21000', '16000', '11000', '6000', '1000']);
  });

  test('heatmap + sort coexist: heatmap survives a sort cycle', async ({ page }) => {
    await enableAndPromoteToFullSet(page);

    // Activate column-wise heatmap on the "10" column.
    await page
      .locator('#south-atlantic tr:first-child th:nth-child(2) [data-gs-lozenge-id="heatmap"]')
      .click();

    // Heatmap should colour the data cells in that column.
    const colouredBefore = await page.$$eval(
      '#south-atlantic tr td:nth-child(2)',
      (cells) => cells.filter((c) => !!(c as HTMLElement).style.backgroundColor).length
    );
    expect(colouredBefore).toBeGreaterThan(0);

    // Now sort the same column ascending.
    await page
      .locator('#south-atlantic tr:first-child th:nth-child(2) [data-gs-lozenge-id="sort"]')
      .click();

    // Header row still at the top.
    const firstCell = await page.$eval(
      '#south-atlantic tr:first-child',
      (tr) => {
        const c = tr.cells[0];
        const t = Array.from(c.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
        return ((t?.textContent ?? '')).trim();
      }
    );
    expect(firstCell).toBe('');

    // Heatmap colouring still present on the column after sort.
    const colouredAfter = await page.$$eval(
      '#south-atlantic tr td:nth-child(2)',
      (cells) => cells.filter((c) => !!(c as HTMLElement).style.backgroundColor).length
    );
    expect(colouredAfter).toBeGreaterThanOrEqual(colouredBefore);
  });
});
