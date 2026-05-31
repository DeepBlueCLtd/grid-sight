import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';
import { readPageProfile } from './helpers/demo-discovery';
import {
  activateGridSight,
  setEnrichment,
  panelEnrichmentIds,
} from './helpers/toggle-panel';
import { snapshotTable, expectRoundTrip } from './helpers/teardown';
import { pairwise } from './helpers/applicability';
import type { EnrichmentId } from './helpers/gridsight-window';

/**
 * US2 — per-permutation interaction sweep (spec 015) on the opt-in playground.
 *
 * Two layers:
 *  1. PAIRWISE non-interference + joint teardown — every unordered pair of
 *     controllable enrichments is enabled together (relative to an all-off
 *     baseline), must not throw, and must round-trip byte-identically when
 *     both are disabled.
 *  2. A curated RICH combo asserting concrete cross-behaviour (10A): filter
 *     recomputes the summary-row aggregate over visible rows; sort leaves that
 *     aggregate stable; find-in-table highlights survive a filter.
 *
 * The playground ships every enrichment OFF, so it is the natural composition
 * surface (FR-003).
 */

const URL = '/grid-sight/demo/toggle/opt-in-playground.html';
// The mixed table has a proper <thead> with a categorical (Region) and a
// numeric (Amount) column — ideal for filter/sort/summary interactions.
const TABLE = 'grid-mixed';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

async function gotoPlayground(page: Page): Promise<{ controllable: EnrichmentId[] }> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as { gridSight?: unknown }).gridSight);
  await activateGridSight(page, TABLE);
  const profile = await readPageProfile(page);
  const controls = new Set(await panelEnrichmentIds(page));
  return { controllable: profile.offered.filter((id) => controls.has(id)) as EnrichmentId[] };
}

/* ───────────────────── Pairwise non-interference + teardown ──────────────── */

test('pairwise: every enabled pair composes without throwing and tears down clean', async ({ page }) => {
  // 120 pairs × (enable·enable·disable·disable + a round-trip snapshot) is a
  // heavy sweep; on the slower engines (WebKit ≈ 37 s) it overruns the 30 s
  // default. Mark it slow so the budget tracks the work rather than flaking.
  test.slow();
  const { controllable } = await gotoPlayground(page);
  expect(controllable.length).toBeGreaterThan(1);

  const pairs = pairwise(controllable);
  // Baseline with everything off (the playground default, made explicit).
  for (const id of controllable) await setEnrichment(page, id, false);
  const baseline = await snapshotTable(page, TABLE);

  for (const [a, b] of pairs) {
    await test.step(`${a} + ${b}`, async () => {
      await setEnrichment(page, a, true);
      await setEnrichment(page, b, true);
      // No assertion throws ⇒ the two affordances coexisted. The table stays a
      // valid, enabled grid (the GS toggle survives).
      await expect(page.locator(`#${TABLE}`)).toBeVisible();

      await setEnrichment(page, a, false);
      await setEnrichment(page, b, false);
      await expectRoundTrip(page, TABLE, baseline);
    });
  }
});

/* ───────────────────────── Curated rich-combo (10A) ──────────────────────── */

// `#grid-mixed`: col 0 Product, col 1 Region (categorical), col 2 Amount (numeric).
const AMOUNT_VALUE = '#grid-mixed tfoot tr.gs-summary-row td:nth-child(3) .gs-summary-value';
const AMOUNT_CTRL = '#grid-mixed tfoot tr.gs-summary-row td:nth-child(3) .gs-summary-agg';

test.describe('rich combo: summary-row × filter × sort × find-in-table (10A)', () => {
  test('filter recomputes the summary aggregate; sort leaves it stable; find highlights survive filter', async ({ page }) => {
    const { controllable } = await gotoPlayground(page);
    for (const id of ['summary-row', 'filter', 'sort', 'find-in-table'] as EnrichmentId[]) {
      expect(controllable, `playground should offer ${id}`).toContain(id);
      await setEnrichment(page, id, true);
    }
    await page.waitForFunction(() => !!document.querySelector('#grid-mixed tfoot .gs-summary-row'));

    // Amount defaults to sum: 999+299+120+450+15+75+35+180 = 2173.
    await expect(page.locator(AMOUNT_CTRL)).toHaveText('sum');
    const fullSum = (await page.locator(AMOUNT_VALUE).textContent())?.trim() ?? '';
    expect(fullSum).not.toBe('');

    // — FILTER ⇒ aggregate recomputes over the visible set. Keep Amount >= 200
    //   programmatically (the proven pattern from navigation-and-analysis): the
    //   live pipeline drives both the dimming and the summary recompute.
    await page.evaluate(() => {
      const t = document.getElementById('grid-mixed') as HTMLTableElement;
      (window as unknown as {
        __gridSightVisibleRows: {
          setFilter: (t: HTMLTableElement, i: number, f: unknown) => void;
        };
      }).__gridSightVisibleRows.setFilter(t, 2, {
        columnIndex: 2,
        columnKey: 'amount',
        test: (row: HTMLTableRowElement) => {
          const v = parseFloat((row.cells[2]?.textContent ?? '').replace(/[^0-9.\-]/g, ''));
          return Number.isFinite(v) && v >= 200;
        },
        toDirective: () => ({ kind: 'numeric-range', columnKey: 'amount', min: 200, max: null, hideEmpty: false }),
      });
    });
    // 999 + 299 + 450 = 1748 over the three visible rows.
    await expect(page.locator(AMOUNT_VALUE)).not.toHaveText(fullSum);
    const filteredSum = (await page.locator(AMOUNT_VALUE).textContent())?.trim() ?? '';

    // — SORT reorders rows but must not change the aggregate over the same
    //   visible set (10A: sort preserves the multiset).
    await page.locator('#grid-mixed thead th:nth-child(3) [data-gs-lozenge-id="sort"]').click();
    await page.waitForTimeout(100);
    await expect(page.locator(AMOUNT_VALUE), 'sort changed the summary aggregate').toHaveText(filteredSum);

    // — FIND highlights survive the active filter: 'EU' appears in visible
    //   Region cells; the find box highlights them while the filter is on.
    await page.locator('#grid-mixed [data-gs-lozenge-id="find-in-table"]').first().click();
    await expect(page.locator('.gs-find-box')).toBeVisible();
    await page.locator('.gs-find-box input').fill('EU');
    await page.waitForTimeout(100);
    await expect(
      page.locator('#grid-mixed .gs-find-match').first(),
      'find produced no highlight under an active filter',
    ).toBeVisible();
    // And the summary aggregate is still the filtered value (find didn't disturb it).
    await expect(page.locator(AMOUNT_VALUE)).toHaveText(filteredSum);
  });
});

/* ─────────── More curated rich combos (10A) — higher-confidence groups ────── */

test.describe('rich combo: heatmap × sort (visual enrichment survives reorder)', () => {
  test('column heatmap shading is preserved cell-for-cell after a sort', async ({ page }) => {
    const { controllable } = await gotoPlayground(page);
    for (const id of ['heatmap', 'sort'] as EnrichmentId[]) {
      expect(controllable, `playground should offer ${id}`).toContain(id);
      await setEnrichment(page, id, true);
    }

    // Activate the heatmap on the Amount column (index 3 → nth-child(3)).
    await page.locator('#grid-mixed thead th:nth-child(3) [data-gs-lozenge-id="heatmap"]').click();
    await page.waitForTimeout(100);

    // Capture the per-row {text → background} mapping while unsorted.
    const before = await page.$$eval('#grid-mixed tbody td:nth-child(3)', (tds) =>
      tds.map((td) => ({ text: td.textContent?.trim() ?? '', bg: (td as HTMLElement).style.backgroundColor })),
    );
    const shadedBefore = before.filter((c) => c.bg).length;
    expect(shadedBefore, 'heatmap shaded no Amount cells').toBeGreaterThan(0);

    // Sort the Amount column ascending.
    await page.locator('#grid-mixed thead th:nth-child(3) [data-gs-lozenge-id="sort"]').click();
    await page.waitForTimeout(100);

    const after = await page.$$eval('#grid-mixed tbody td:nth-child(3)', (tds) =>
      tds.map((td) => ({ text: td.textContent?.trim() ?? '', bg: (td as HTMLElement).style.backgroundColor })),
    );

    // The rows reordered, but every value kept its own shade (a value's colour
    // is intrinsic to the value, not the row position) and none were dropped.
    expect(after.filter((c) => c.bg).length, 'sort dropped heatmap shading').toBe(shadedBefore);
    const byText = new Map(before.map((c) => [c.text, c.bg]));
    for (const cell of after) {
      expect(cell.bg, `Amount "${cell.text}" lost/changed its shade after sort`).toBe(byText.get(cell.text));
    }
    // And the sort actually reordered (ascending numeric).
    const order = after.map((c) => Number(c.text.replace(/[^0-9.\-]/g, '')));
    expect(order, 'Amount did not sort ascending').toEqual([...order].sort((x, y) => x - y));
  });
});

test.describe('rich combo: statistics × filter (popup recomputes over visible rows)', () => {
  test('the open statistics popup recomputes its Count/Sum when a filter narrows the set', async ({ page }) => {
    const { controllable } = await gotoPlayground(page);
    for (const id of ['statistics', 'filter'] as EnrichmentId[]) {
      expect(controllable, `playground should offer ${id}`).toContain(id);
      await setEnrichment(page, id, true);
    }

    // Open the statistics popup on the Amount column.
    await page.locator('#grid-mixed thead th:nth-child(3) [data-gs-lozenge-id="statistics"]').click();
    const popup = page.locator('.gs-statistics-popup--visible');
    await expect(popup).toBeVisible();

    const readStat = async (label: string): Promise<string> =>
      popup.evaluate((root, lbl) => {
        const rows = Array.from(root.querySelectorAll('tr, .gs-stat-row, li, div'));
        for (const r of rows) {
          const t = r.textContent ?? '';
          if (t.trim().startsWith(lbl)) return t.replace(lbl, '').trim();
        }
        // Fallback: whole-text scan "label<value>".
        const m = (root.textContent ?? '').match(new RegExp(lbl + '\\s*([\\d.,%()\\s]+)'));
        return m ? m[1].trim() : '';
      }, label);

    // All 8 rows visible initially (Count 8).
    expect(await readStat('Count')).toContain('8');

    // Filter Amount >= 200 → 3 visible rows (999, 299, 450); popup recomputes.
    await page.evaluate(() => {
      const t = document.getElementById('grid-mixed') as HTMLTableElement;
      (window as unknown as {
        __gridSightVisibleRows: { setFilter: (t: HTMLTableElement, i: number, f: unknown) => void };
      }).__gridSightVisibleRows.setFilter(t, 2, {
        columnIndex: 2,
        columnKey: 'amount',
        test: (row: HTMLTableRowElement) => {
          const v = parseFloat((row.cells[2]?.textContent ?? '').replace(/[^0-9.\-]/g, ''));
          return Number.isFinite(v) && v >= 200;
        },
        toDirective: () => ({ kind: 'numeric-range', columnKey: 'amount', min: 200, max: null, hideEmpty: false }),
      });
    });
    await page.waitForTimeout(150);

    // The still-open popup now reflects the narrowed visible set.
    expect(await readStat('Count'), 'statistics did not recompute after filter').toContain('3');
  });
});

test.describe('rich combo: cumulative virtual column × sort (appended cells follow rows)', () => {
  test('a cumulative column composes with sort and tears down byte-identically', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as { gridSight?: unknown }).gridSight);
    await activateGridSight(page, 'grid-quarterly');
    const { offered } = await readPageProfile(page);
    for (const id of ['cumulative', 'sort'] as EnrichmentId[]) {
      expect(offered, `playground should offer ${id}`).toContain(id);
    }

    const baseline = await snapshotTable(page, 'grid-quarterly');

    // Cumulative appends Σ running-total cells on the numeric quarter columns.
    await setEnrichment(page, 'cumulative' as EnrichmentId, true);
    await page.waitForTimeout(100);
    const vcCells = await page.locator('#grid-quarterly .gs-vc-lozenge[data-gs-vc-kind="cumulative"]').count();
    expect(vcCells, 'cumulative added no virtual-column lozenges').toBeGreaterThan(0);

    // Enable sort alongside it — the two compose without error and the table
    // stays a valid grid.
    await setEnrichment(page, 'sort' as EnrichmentId, true);
    await expect(page.locator('#grid-quarterly')).toBeVisible();

    // Disable both → byte-identical teardown (no appended-cell residue).
    await setEnrichment(page, 'sort' as EnrichmentId, false);
    await setEnrichment(page, 'cumulative' as EnrichmentId, false);
    await expectRoundTrip(page, 'grid-quarterly', baseline);
  });
});
