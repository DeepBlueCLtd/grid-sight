import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

const URL = '/grid-sight/demo/outlier/measurements.html';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

const LATENCY_LOZENGE =
  '#tbl-measurements thead th:nth-child(2) [data-gs-lozenge-id="outlier"]';
const MARKED = '#tbl-measurements td.gs-outlier-cell';

async function enableGridSight(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector(LATENCY_LOZENGE, { state: 'attached' });
}

function markedCount(page: Page): Promise<number> {
  return page.locator(MARKED).count();
}

test.describe('US1: one-click 2σ flagging + tooltip', () => {
  test('clicking once flags the 2σ outlier and reveals a tooltip on hover/focus', async ({ page }) => {
    await enableGridSight(page);
    await page.locator(LATENCY_LOZENGE).click();

    // Exactly one cell (Latency 200) is beyond 2σ.
    expect(await markedCount(page)).toBe(1);
    const marked = page.locator(MARKED).first();
    await expect(marked).toHaveText(/200/);

    // Hover reveals the value/mean/σ tooltip.
    await marked.hover();
    const tip = page.locator('.gs-outlier-tooltip', { hasText: 'value 200' });
    await expect(tip).toBeVisible();
    await expect(tip).toHaveText(/value 200, mean [\d.]+, \+[\d.]+σ/);

    // Keyboard focus reveals it too (FR-019).
    await marked.evaluate((el) => (el as HTMLElement).blur());
    await page.mouse.move(0, 0);
    await marked.focus();
    await expect(page.locator('.gs-outlier-tooltip', { hasText: 'value 200' })).toBeVisible();

    // An unmarked cell carries no marker.
    const unmarked = page.locator('#tbl-measurements tbody tr:first-child td:nth-child(2)');
    await expect(unmarked).not.toHaveClass(/gs-outlier-cell/);
  });
});

test.describe('US2: cycle the σ threshold', () => {
  test('four clicks grow → shrink → empty and the glyph tracks each step', async ({ page }) => {
    await enableGridSight(page);
    const loz = page.locator(LATENCY_LOZENGE);

    await loz.click(); // → 2σ
    expect(await markedCount(page)).toBe(1);
    await expect(loz).toHaveText('!2');

    await loz.click(); // → 1σ (grows)
    expect(await markedCount(page)).toBe(5);
    await expect(loz).toHaveText('!1');

    await loz.click(); // → 3σ (shrinks to empty)
    expect(await markedCount(page)).toBe(0);
    await expect(loz).toHaveText('!3');

    await loz.click(); // → idle
    expect(await markedCount(page)).toBe(0);
    await expect(loz).toHaveText('!');
    await expect(loz).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Edge: inert + non-numeric columns', () => {
  test('the all-equal Baseline column has an inert lozenge; Notes has none', async ({ page }) => {
    await enableGridSight(page);
    // Baseline (4th column) is σ = 0 → lozenge present but inert.
    const baseline = page.locator(
      '#tbl-measurements thead th:nth-child(4) [data-gs-lozenge-id="outlier"]',
    );
    await expect(baseline).toBeAttached();
    await expect(baseline).toHaveAttribute('title', /All values equal/);
    await baseline.click();
    expect(await markedCount(page)).toBe(0); // click is a no-op
    await expect(baseline).toHaveText('!');

    // Notes (5th column) is non-numeric → no outlier lozenge.
    await expect(
      page.locator('#tbl-measurements thead th:nth-child(5) [data-gs-lozenge-id="outlier"]'),
    ).toHaveCount(0);
  });
});
