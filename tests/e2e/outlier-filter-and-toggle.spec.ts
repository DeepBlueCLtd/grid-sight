import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

const URL = '/grid-sight/demo/outlier/measurements.html';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

const LAT = '#tbl-measurements thead th:nth-child(2) [data-gs-lozenge-id="outlier"]';
const MARKED = '#tbl-measurements td.gs-outlier-cell';

async function enable(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector(LAT, { state: 'attached' });
}

/** Is the Latency 200 cell (row S15) currently marked? */
function spikeMarked(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('#tbl-measurements tbody tr');
    // The row-label cell also hosts row-level lozenges (H/#), so match by prefix.
    const s15 = Array.from(rows).find((r) => (r.cells[0].textContent || '').trim().startsWith('S15'));
    return s15?.cells[1].classList.contains('gs-outlier-cell') ?? false;
  });
}

test.describe('Filter-aware recompute (FR-008)', () => {
  test('marks recompute over un-dimmed rows when a filter is applied and cleared', async ({ page }) => {
    await enable(page);
    await page.locator(LAT).click(); // 2σ
    await page.locator(LAT).click(); // 1σ → 5 marks incl the 200 spike
    expect(await page.locator(MARKED).count()).toBe(5);
    expect(await spikeMarked(page)).toBe(true);

    // Dim the spike row (Latency ≥ 160) via the sanctioned pipeline hook.
    await page.evaluate(() => {
      const vr = (window as any).__gridSightVisibleRows;
      const table = document.getElementById('tbl-measurements');
      vr.setFilter(table, 1, {
        columnIndex: 1,
        columnKey: 'latency',
        test: (r: HTMLTableRowElement) =>
          parseFloat((r.cells[1].textContent || '').replace(/[^0-9.]/g, '')) < 160,
        toDirective: () => ({ kind: 'numeric-range', columnKey: 'latency', min: null, max: 160, hideEmpty: false }),
      });
    });

    // The dimmed spike is excluded from σ and is no longer marked; the set changed.
    expect(await spikeMarked(page)).toBe(false);
    expect(await page.locator(MARKED).count()).not.toBe(5);

    // Clearing the filter recomputes over all rows → original marked set returns.
    await page.evaluate(() => {
      const vr = (window as any).__gridSightVisibleRows;
      vr.clearFilters(document.getElementById('tbl-measurements'));
    });
    expect(await page.locator(MARKED).count()).toBe(5);
    expect(await spikeMarked(page)).toBe(true);
  });
});

test.describe('Grid-Sight off teardown (FR-021, SC-005)', () => {
  test('disable() removes every marker/tooltip but keeps gs.o; enable() restores', async ({ page }) => {
    await enable(page);
    await page.locator(LAT).click(); // 2σ
    await page.locator(LAT).click(); // 1σ → 5 marks
    expect(await page.locator(MARKED).count()).toBe(5);

    await page.evaluate(() => (window as any).gridSight.disable());

    // All outlier DOM is gone…
    expect(await page.locator(MARKED).count()).toBe(0);
    expect(await page.locator('.gs-outlier-tooltip').count()).toBe(0);
    // …but the encoded state remains in the URL (FR-021).
    expect(await page.evaluate(() => location.hash)).toContain('gs.o');

    // Re-enabling restores the flagged view from gs.o.
    await page.evaluate(() => (window as any).gridSight.enable());
    await page.waitForSelector(MARKED, { state: 'attached' });
    expect(await page.locator(MARKED).count()).toBe(5);
  });
});
