import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * End-to-end tests for spec 015 — welcome page redesign & per-table options.
 *
 * The rewritten `public/index.html` is the first real consumer of the per-table
 * API: each inline demo table is addressed by id in `pageConfig.tables` and
 * offered exactly its section's enrichment(s), most starting active. These tests
 * run against the built page served by the shared Playwright webServer.
 */

const WELCOME = '/grid-sight/';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

async function gotoWelcome(page: Page): Promise<void> {
  await page.goto(WELCOME);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!(window as unknown as { gridSight?: unknown }).gridSight);
}

function lozengeIds(page: Page, tableId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const els = document.querySelectorAll<HTMLElement>(`#${id} [data-gs-lozenge-id]`);
    return Array.from(new Set(Array.from(els, (el) => el.getAttribute('data-gs-lozenge-id') as string)));
  }, tableId);
}

/* ── US1: first-time visitor understands what Grid-Sight is ── */
test.describe('US1: hero + principles', () => {
  test('intro communicates purpose and all five principles, even with GS disabled', async ({ page }) => {
    await gotoWelcome(page);

    // Turn Grid-Sight off — the intro must not depend on any table.
    await page.locator('#gs-page-toggle').uncheck();

    await expect(page.locator('.hero h1')).toHaveText('Grid-Sight');
    await expect(page.locator('.hero .tagline')).toBeVisible();
    await expect(page.locator('.hero .problem')).toBeVisible();

    const principles = page.locator('.principle h3');
    await expect(principles).toHaveCount(5);
    const text = (await principles.allInnerTexts()).join(' ').toLowerCase();
    expect(text).toContain('offline');
    expect(text).toContain('dependencies');
    expect(text).toContain('progressive');
    expect(text).toContain('accessible');
    expect(text).toContain('teardown');
  });
});

/* ── US2: visitor experiments with features inline ── */
test.describe('US2: four feature sections, distinct sets co-resident', () => {
  const demoTables = ['demo-sliders', 'demo-visual', 'demo-nav', 'demo-derived'];

  test('every feature area has a live operable table', async ({ page }) => {
    await gotoWelcome(page);
    for (const id of demoTables) {
      await expect(page.locator(`#${id} .grid-sight-toggle`)).toHaveCount(1);
    }
  });

  test('two tables expose DIFFERENT enrichment sets simultaneously (SC-005)', async ({ page }) => {
    await gotoWelcome(page);
    // Both start active, so lozenges are present on load.
    const sliders = await lozengeIds(page, 'demo-sliders');
    const visual = await lozengeIds(page, 'demo-visual');

    expect(sliders).toContain('sliders');
    expect(sliders).not.toContain('heatmap');

    expect(visual).toContain('heatmap');
    expect(visual).not.toContain('sliders');
  });

  test('sections alternate via CSS order on wide screens; stack with no overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await gotoWelcome(page);

    // A reverse section places its narrative after the demo visually (order:2)
    // while staying narrative-first in the DOM.
    const reverseOrder = await page.evaluate(() => {
      const n = document.querySelector('.feature--reverse .feature__narrative') as HTMLElement;
      return getComputedStyle(n).order;
    });
    expect(reverseOrder).toBe('2');

    // Mobile: the swap collapses and the page must not overflow horizontally.
    await page.setViewportSize({ width: 390, height: 900 });
    const { order, overflow } = await page.evaluate(() => {
      const n = document.querySelector('.feature--reverse .feature__narrative') as HTMLElement;
      return {
        order: getComputedStyle(n).order,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(order).toBe('0');
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('auto-activate applies the configured enrichment on load (v1 subset)', async ({ page }) => {
    await gotoWelcome(page);
    const state = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gs = (window as any).gridSight;
      const byId = (id: string) => document.getElementById(id);
      const shaded = (id: string) =>
        Array.from(document.querySelectorAll(`#${id} td`)).some((c) => {
          const bg = getComputedStyle(c as HTMLElement).backgroundColor;
          return !!bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)';
        });
      return {
        sliders: gs.getSliders(byId('demo-sliders')).length,
        sparks: gs.virtualColumns.list(byId('demo-derived')).filter((d: { kind: string }) => d.kind === 'sparkline').length,
        heatmapShaded: shaded('demo-visual'),
        // The nav demo deliberately auto-applies nothing.
        navVirtualCols: gs.virtualColumns.list(byId('demo-nav')).length,
        navShaded: shaded('demo-nav'),
      };
    });
    expect(state.sliders).toBeGreaterThan(0);     // #demo-sliders → activate:['sliders']
    expect(state.sparks).toBeGreaterThan(0);      // #demo-derived → activate:['sparkline']
    expect(state.heatmapShaded).toBe(true);       // #demo-visual  → activate:['heatmap']
    expect(state.navVirtualCols).toBe(0);         // #demo-nav     → nothing auto-applied
    expect(state.navShaded).toBe(false);
  });

  test('each feature section links to its demo page(s) (FR-008)', async ({ page }) => {
    await gotoWelcome(page);
    const sectionLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.feature .demo-links a'), (a) => (a as HTMLAnchorElement).getAttribute('href'))
    );
    expect(sectionLinks.length).toBeGreaterThanOrEqual(4);
    for (const href of sectionLinks) expect(href).toMatch(/^demo\//);
  });
});

/* ── US3: on/off and start-state explained and demonstrated ── */
test.describe('US3: global toggle + start-state contrast', () => {
  test('one table starts active, one starts inactive', async ({ page }) => {
    await gotoWelcome(page);
    expect((await lozengeIds(page, 'start-active')).length).toBeGreaterThan(0);
    expect((await lozengeIds(page, 'start-inactive')).length).toBe(0);
    // The inactive table still has a GS button to reveal in place.
    await expect(page.locator('#start-inactive .grid-sight-toggle')).toHaveCount(1);
  });

  test('clicking a GS toggle reveals then hides enrichments in place', async ({ page }) => {
    await gotoWelcome(page);
    expect((await lozengeIds(page, 'start-inactive')).length).toBe(0);

    await page.locator('#start-inactive .grid-sight-toggle').click();
    expect((await lozengeIds(page, 'start-inactive')).length).toBeGreaterThan(0);

    await page.locator('#start-inactive .grid-sight-toggle').click();
    expect((await lozengeIds(page, 'start-inactive')).length).toBe(0);
  });

  test('global off→on restores each table to its configured start-state (R-6)', async ({ page }) => {
    await gotoWelcome(page);

    await page.locator('#gs-page-toggle').uncheck();
    await expect(page.locator('#start-active .grid-sight-toggle')).toHaveCount(0);

    await page.locator('#gs-page-toggle').check();
    // start-active returns to revealed, start-inactive returns to hidden.
    await expect(page.locator('#start-active .grid-sight-toggle')).toHaveCount(1);
    expect((await lozengeIds(page, 'start-active')).length).toBeGreaterThan(0);
    expect((await lozengeIds(page, 'start-inactive')).length).toBe(0);
  });

  test('the data-gs-ignore reference table stays raw', async ({ page }) => {
    await gotoWelcome(page);
    await expect(page.locator('#reference-raw .grid-sight-toggle')).toHaveCount(0);
    expect((await lozengeIds(page, 'reference-raw')).length).toBe(0);
  });
});

/* ── US5: every existing demo remains reachable ── */
test.describe('US5: all demos reachable', () => {
  const DEMOS = [
    'demo/sliders/interpolation.html',
    'demo/sliders/alternate-calc-models.html',
    'demo/sliders/synced-tables.html',
    'demo/toggle/live-enrichments.html',
    'demo/toggle/opt-in-playground.html',
    'demo/virtual-columns.html',
    'demo/annotations/index.html',
    'demo/outlier/measurements.html',
    'demo/freeze-panes/index.html',
    'demo/statistics/index.html',
    'demo/summary-row/index.html',
    'demo/find-in-table/index.html',
  ];

  test('all 12 demo pages are linked and resolve (FR-012, SC-006)', async ({ page }) => {
    await gotoWelcome(page);
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'), (a) => (a as HTMLAnchorElement).getAttribute('href'))
    );
    const hrefSet = new Set(hrefs);
    for (const demo of DEMOS) {
      expect(hrefSet.has(demo), `welcome page should link ${demo}`).toBe(true);
      const res = await page.request.get(`${WELCOME}${demo}`);
      expect(res.status(), `${demo} should resolve`).toBe(200);
    }
  });
});

/* ── Offline / file:// smoke (FR-013, SC-007) ── */
test.describe('Offline: no external network', () => {
  test('the page and inline demos make no cross-origin requests', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1') && !url.startsWith('data:')) {
        external.push(url);
      }
    });
    await gotoWelcome(page);
    // Exercise a start-active table to make sure no enrichment fetches anything.
    await page.locator('#demo-visual [data-gs-lozenge-id="heatmap"]').first().click();
    expect(external).toEqual([]);
  });
});
