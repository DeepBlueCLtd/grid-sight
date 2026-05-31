import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

const BASE = `/grid-sight/demo/annotations`;
const DOC_A = `${BASE}/annotations-doc-a.html`;
const DOC_B = `${BASE}/annotations-doc-b.html`;

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

async function annotateFirstCell(page: Page, tableSel: string, text: string): Promise<void> {
  const cell = `${tableSel} tbody tr[data-gs-row-key="acme"] td`;
  await page.waitForSelector(`${cell} .gs-annotation-pin`, { state: 'attached' });
  await page.locator(cell).hover();
  await page.locator(`${cell} .gs-annotation-pin`).click();
  await page.locator('.gs-annotation-popover textarea').fill(text);
  await page.locator('.gs-annotation-popover button', { hasText: 'Save' }).click();
  await expect(page.locator(`${cell} .gs-annotation-marker`)).toHaveCount(1);
}

test('US3: cross-document popup navigates to the other document and scrolls to the cell', async ({ page }) => {
  // Annotate on doc B first (persists under B's per-document localStorage key).
  await page.goto(DOC_B);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await annotateFirstCell(page, '#tbl-b', 'note on B');

  // Go to doc A and annotate there too.
  await page.goto(DOC_A);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await annotateFirstCell(page, '#tbl-a', 'note on A');

  // The cross-document menu entry is present (origin has ≥ 1 annotation).
  const entry = page.locator('.gs-annotations-menu-entry');
  await expect(entry).toBeVisible();
  await entry.click();

  // The popup lists entries from both documents.
  const popup = page.locator('.gs-annotation-popup');
  await expect(popup).toBeVisible();
  await expect(popup.locator('.gs-annotation-popup__entry')).toHaveCount(2);

  // Activate the doc-B entry → navigate to doc B with the deep-link hint.
  const bEntry = popup.locator('.gs-annotation-popup__entry', { hasText: 'note on B' });
  await bEntry.click();

  await page.waitForURL(/annotations-doc-b\.html/);
  await page.waitForFunction(() => !!(window as any).gridSight);

  // The #gs.annot hint has been consumed and cleared from the URL (SC-006).
  await expect
    .poll(async () => page.evaluate(() => location.hash))
    .not.toContain('gs.annot');

  // The target cell's marker is present and pulsing.
  const bCell = '#tbl-b tbody tr[data-gs-row-key="acme"] td';
  await expect(page.locator(`${bCell} .gs-annotation-marker`)).toHaveCount(1);
  await expect
    .poll(async () =>
      page.evaluate((sel) => {
        const m = document.querySelector(sel);
        return m ? m.classList.contains('gs-annotation-marker--pulse') : false;
      }, `${bCell} .gs-annotation-marker`)
    )
    .toBe(true);
});
