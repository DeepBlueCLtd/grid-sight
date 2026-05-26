import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for spec 012 — Story 2 (runtime visitor toggle panel).
 *
 * The dedicated demo (`public/demo/toggle/live-enrichments.html`) declares
 * `showToggleUi: true` and a `[data-gs-toggle-panel]` container. These tests
 * exercise live toggling, persistence, and reload restoration.
 */

const PORT = 3122;
const DEMO = `http://localhost:${PORT}/grid-sight/demo/toggle/live-enrichments.html`;

test.describe('US2: live enrichment toggle panel', () => {
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

  test('panel mounts into [data-gs-toggle-panel] container', async ({ page }) => {
    await page.goto(DEMO);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await expect(page.locator('[data-gs-toggle-panel-root]')).toBeVisible();

    // The panel renders one checkbox per *shipped* enrichment (per the
    // comment in src/ui/toggle-panel.ts). Spec-only entries stay in the
    // registry but are not user-toggleable, so they intentionally do not
    // surface a checkbox. Update this list when a new enrichment flips
    // `shipped: true` in src/core/enrichment-registry.ts.
    const shippedIds = [
      'heatmap',
      'sliders',
      'slider-threshold',
      'statistics',
      'frequency',
      'frequency-chart',
      'sort',
      'filter',
      'annotations',
    ];
    for (const id of shippedIds) {
      await expect(
        page.locator(`[data-gs-toggle-panel-root] input[type="checkbox"][value="${id}"]`),
      ).toHaveCount(1);
    }
    // And no checkbox exists for any unshipped id.
    const count = await page.locator('[data-gs-toggle-panel-root] input[type="checkbox"]').count();
    expect(count).toBe(shippedIds.length);
  });

  test('unticking heatmap removes the heatmap lozenge live', async ({ page }) => {
    await page.goto(DEMO);
    await page.waitForFunction(() => !!(window as any).gridSight);

    // Enable GS on the demo table so lozenges render.
    await page.locator('#mixed-table .grid-sight-toggle').first().click();
    await expect(page.locator('#mixed-table [data-gs-lozenge-id="heatmap"]').first()).toBeVisible();

    // Untick heatmap in the panel.
    await page.locator('[data-gs-toggle-panel-root] input[value="heatmap"]').uncheck();

    // Wait one frame.
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(null))));

    await expect(page.locator('#mixed-table [data-gs-lozenge-id="heatmap"]')).toHaveCount(0);
  });

  test('reload restores the persisted set from the URL fragment', async ({ page }) => {
    await page.goto(DEMO);
    await page.waitForFunction(() => !!(window as any).gridSight);

    await page.locator('[data-gs-toggle-panel-root] input[value="heatmap"]').uncheck();
    await page.locator('[data-gs-toggle-panel-root] input[value="statistics"]').uncheck();

    // URL fragment carries the survivors.
    const hash = await page.evaluate(() => location.hash);
    expect(hash).toMatch(/gs\.e=/);
    expect(hash).not.toMatch(/heatmap/);
    expect(hash).not.toMatch(/statistics/);

    // Reload: the persisted set must take effect before lozenges are rendered.
    await page.reload();
    await page.waitForFunction(() => !!(window as any).gridSight);
    const enabled = await page.evaluate(() => ({
      heatmap: (window as any).gridSight.isEnrichmentEnabled('heatmap'),
      statistics: (window as any).gridSight.isEnrichmentEnabled('statistics'),
      sliders: (window as any).gridSight.isEnrichmentEnabled('sliders'),
    }));
    expect(enabled.heatmap).toBe(false);
    expect(enabled.statistics).toBe(false);
    expect(enabled.sliders).toBe(true);
  });
});
