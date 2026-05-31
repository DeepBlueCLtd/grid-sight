import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * End-to-end tests for spec 012 — Story 1.
 *
 * A page declares `window.gridSight.pageConfig.enrichments` BEFORE the bundle
 * loads; only the declared enrichments produce lozenges and menu items. This
 * suite covers Story 1 acceptance scenarios 1–4 against the dedicated fixture.
 *
 * The per-demo "declares an explicit subset" assertions that used to live here
 * (Story 3) were folded into the discovery-driven precedence block in
 * `enrichment-matrix.spec.ts` (spec 015, T030): coverage now follows the
 * filesystem rather than a hand-maintained list, so a new demo or a changed
 * `pageConfig` is checked automatically.
 */

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

test.describe('US1: per-page enrichment subset (capability filtering)', () => {
  test('fixture: pageConfig limits lozenges to the declared set', async ({ page }) => {
    await page.goto(`/grid-sight/demo/capability-filtering/fixture.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!(window as any).gridSight);

    // gridSight.enrichmentIds is exposed.
    const ids = await page.evaluate(() => Array.from((window as any).gridSight.enrichmentIds));
    expect(ids).toEqual(expect.arrayContaining(['heatmap', 'sliders', 'statistics', 'frequency']));

    // isEnrichmentEnabled reflects the declared set.
    const enabled = await page.evaluate(() => {
      const gs = (window as any).gridSight;
      return {
        heatmap: gs.isEnrichmentEnabled('heatmap'),
        sliders: gs.isEnrichmentEnabled('sliders'),
        statistics: gs.isEnrichmentEnabled('statistics'),
        frequency: gs.isEnrichmentEnabled('frequency'),
        sort: gs.isEnrichmentEnabled('sort'),
      };
    });
    expect(enabled).toEqual({
      heatmap: true, sliders: true, statistics: true,
      frequency: false, sort: false,
    });

    // Enable GS on the numeric table.
    await page.locator('#numeric-table .grid-sight-toggle').first().click();
    // Lozenges only carry ids from the declared set.
    const lozengeIds = await page.evaluate(() => {
      const els = document.querySelectorAll<HTMLElement>('#numeric-table [data-gs-lozenge-id]');
      return Array.from(new Set(Array.from(els).map(el => el.getAttribute('data-gs-lozenge-id'))));
    });
    expect(new Set(lozengeIds)).toEqual(new Set(['heatmap', 'sliders', 'statistics']));
  });

  test('fixture: categorical column shows only enabled enrichments (frequency disabled)', async ({ page }) => {
    await page.goto(`/grid-sight/demo/capability-filtering/fixture.html`);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.locator('#mixed-table .grid-sight-toggle').first().click();

    const lozengeIds = await page.evaluate(() => {
      const els = document.querySelectorAll<HTMLElement>('#mixed-table [data-gs-lozenge-id]');
      return Array.from(new Set(Array.from(els).map(el => el.getAttribute('data-gs-lozenge-id'))));
    });
    // 'frequency' and 'frequency-chart' are not in the declared set — must be absent.
    expect(lozengeIds).not.toContain('frequency');
    expect(lozengeIds).not.toContain('frequency-chart');
  });
});
