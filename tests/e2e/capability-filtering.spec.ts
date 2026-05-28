import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for spec 012 — Story 1.
 *
 * A page declares `window.gridSight.pageConfig.enrichments` BEFORE the bundle
 * loads; only the declared enrichments produce lozenges and menu items. This
 * suite covers Story 1 acceptance scenarios 1–4 against the dedicated
 * fixture; the demo-subset assertions in T038 (Story 3) live in this same
 * file and run against each existing demo page.
 */

const PORT = 3120;

test.describe('US1: per-page enrichment subset (capability filtering)', () => {
  let server: any;

  test.beforeAll(async () => {
    const { preview } = await import('vite');
    server = await preview({
      preview: { port: PORT, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  test('fixture: pageConfig limits lozenges to the declared set', async ({ page }) => {
    await page.goto(`http://localhost:${PORT}/grid-sight/demo/capability-filtering/fixture.html`);
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
    await page.goto(`http://localhost:${PORT}/grid-sight/demo/capability-filtering/fixture.html`);
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

test.describe('US3: each existing demo declares an explicit subset', () => {
  let server: any;

  test.beforeAll(async () => {
    const { preview } = await import('vite');
    server = await preview({
      preview: { port: PORT + 1, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  const cases: Array<{ path: string; expected: Set<string> }> = [
    {
      path: '/grid-sight/',
      expected: new Set(['heatmap', 'sliders', 'slider-threshold', 'statistics', 'frequency', 'frequency-chart', 'annotations']),
    },
    {
      path: '/grid-sight/demo/sliders/interpolation.html',
      expected: new Set(['heatmap', 'sliders', 'statistics']),
    },
    {
      // 'heatmap' added on top of spec-012's original ['sliders','statistics']
      // so post-002-003-row-visibility reviewers can confirm the H lozenge
      // still works on this demo's tables.
      path: '/grid-sight/demo/sliders/alternate-calc-models.html',
      expected: new Set(['sliders', 'statistics', 'heatmap']),
    },
    {
      // 'heatmap' added on top of spec-012's original ['sliders'] for the
      // same reason — see the demo's inline rationale comment.
      path: '/grid-sight/demo/sliders/synced-tables.html',
      expected: new Set(['sliders', 'heatmap']),
    },
    {
      path: '/grid-sight/demo/sliders/heatmap.html',
      expected: new Set(['heatmap', 'sliders', 'slider-threshold']),
    },
  ];

  for (const c of cases) {
    test(`demo ${c.path} declares ${Array.from(c.expected).join(',')}`, async ({ page }) => {
      await page.goto(`http://localhost:${PORT + 1}${c.path}`);
      await page.waitForFunction(() => !!(window as any).gridSight);

      // The configured enrichments are reflected in isEnrichmentEnabled.
      const out = await page.evaluate((expected: string[]) => {
        const gs = (window as any).gridSight;
        const all = Array.from(gs.enrichmentIds) as string[];
        const enabledSet = new Set(all.filter((id) => gs.isEnrichmentEnabled(id)));
        return { all, enabled: Array.from(enabledSet), expected };
      }, Array.from(c.expected));

      // Every id in the expected subset must be enabled.
      for (const id of c.expected) {
        expect(out.enabled, `${c.path}: ${id} should be enabled`).toContain(id);
      }
      // No id outside the expected subset is enabled (except when the demo
      // intentionally lists more — kept tight via Set equality).
      expect(new Set(out.enabled)).toEqual(c.expected);
    });
  }
});
