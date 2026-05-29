import { test, expect } from '@playwright/test';

/**
 * End-to-end golden paths for spec 014 — Large-Table Navigation & Analysis.
 * One file, one preview server; a describe block per user story. Each story
 * asserts its golden path AND the enable→disable→enable round-trip that the
 * 006/012 lesson made mandatory.
 */

const PORT = 3140;
const BASE = `http://localhost:${PORT}/grid-sight/demo`;

let server: any;

test.beforeAll(async () => {
  const { preview } = await import('vite');
  server = await preview({ preview: { port: PORT, open: false }, build: { outDir: 'dist' } });
});

test.afterAll(async () => {
  if (server?.httpServer?.close) {
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
});

const raf = (page: import('@playwright/test').Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

/* ── US1: freeze-panes ──────────────────────────────────────────────── */

test.describe('US1: freeze-panes', () => {
  const URL = `${BASE}/freeze-panes/index.html`;

  test('auto-applies a sticky header row + key column on load', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    await expect(page.locator('#assay-table')).toHaveClass(/gs-freeze/);

    const headerPos = await page
      .locator('#assay-table thead th')
      .nth(1)
      .evaluate((el) => getComputedStyle(el).position);
    expect(headerPos).toBe('sticky');

    const keyPos = await page
      .locator('#assay-table tbody th')
      .first()
      .evaluate((el) => getComputedStyle(el).position);
    expect(keyPos).toBe('sticky');
  });

  test('header pins on vertical scroll and key column pins on horizontal scroll', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    const region = page.locator('.scroll-region');
    const headerCell = page.locator('#assay-table thead th').nth(2);
    const keyCell = page.locator('#assay-table tbody th').nth(12);

    // Scroll down: the header band stays at the top edge of the scroll region.
    await region.evaluate((el) => {
      el.scrollTop = 220;
    });
    await raf(page);
    let regionBox = (await region.boundingBox())!;
    const headerBox = (await headerCell.boundingBox())!;
    expect(Math.abs(headerBox.y - regionBox.y)).toBeLessThan(8);

    // Scroll right: the key column stays at the left edge of the scroll region.
    await region.evaluate((el) => {
      el.scrollLeft = 320;
    });
    await raf(page);
    regionBox = (await region.boundingBox())!;
    const keyBox = (await keyCell.boundingBox())!;
    expect(Math.abs(keyBox.x - regionBox.x)).toBeLessThan(8);
  });

  test('disable→enable round-trip via the toggle panel restores freeze without reload', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    const cb = page.locator('[data-gs-toggle-panel-root] input[value="freeze-panes"]');
    await expect(cb).toBeChecked();

    // OFF → all freeze classes torn down (byte-identical un-freeze).
    await cb.uncheck();
    await raf(page);
    await expect(page.locator('#assay-table')).not.toHaveClass(/gs-freeze/);
    await expect(page.locator('#assay-table .gs-freeze-header')).toHaveCount(0);
    await expect(page.locator('#assay-table .gs-freeze-col')).toHaveCount(0);

    // ON → re-applied via the registry `apply` hook, no reload.
    await cb.check();
    await raf(page);
    await expect(page.locator('#assay-table')).toHaveClass(/gs-freeze/);
    await expect(page.locator('#assay-table thead th.gs-freeze-header')).toHaveCount(9);
  });
});

/* ── US2: statistics extension ──────────────────────────────────────── */

test.describe('US2: statistics extension', () => {
  const URL = `${BASE}/statistics/index.html`;

  // Read the popup's value for a given stat label.
  const readStat = (page: import('@playwright/test').Page, label: string) =>
    page.evaluate((lbl) => {
      const items = document.querySelectorAll('.gs-statistics-popup__stat');
      for (const it of Array.from(items)) {
        if (it.querySelector('.gs-statistics-popup__stat-label')?.textContent === lbl) {
          return it.querySelector('.gs-statistics-popup__stat-value')?.textContent ?? null;
        }
      }
      return null;
    }, label);

  async function openReadingStats(page: import('@playwright/test').Page) {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.locator('#measurements .grid-sight-toggle').first().click();
    await page
      .locator('#measurements thead th:nth-child(2) [data-gs-lozenge-id="statistics"]')
      .click();
    await expect(page.locator('.gs-statistics-popup--visible')).toBeVisible();
  }

  test('shows the new figures + histogram over visible rows', async ({ page }) => {
    await openReadingStats(page);

    // 11 numeric readings, 3 blank → Missing 3.
    expect(await readStat(page, 'Count')).toBe('11');
    expect(await readStat(page, 'Missing')).toContain('3');
    expect(await readStat(page, 'Distinct')).not.toBeNull();
    expect(await readStat(page, 'Q1')).not.toBeNull();
    expect(await readStat(page, 'Q3')).not.toBeNull();

    // Inline SVG histogram with one <title> per bar.
    const bars = page.locator('.gs-statistics-popup__histogram svg rect');
    expect(await bars.count()).toBeGreaterThan(1);
    await expect(bars.first().locator('title')).toHaveCount(1);
  });

  test('recomputes live when a filter is applied while the popup is open', async ({ page }) => {
    await openReadingStats(page);
    expect(await readStat(page, 'Count')).toBe('11');

    // Apply a filter programmatically (a UI click would dismiss the popup):
    // keep only readings <= 20, dimming the two large outliers + the blanks.
    await page.evaluate(() => {
      const t = document.getElementById('measurements') as HTMLTableElement;
      (window as any).__gridSightVisibleRows.setFilter(t, 1, {
        columnIndex: 1,
        columnKey: 'reading',
        test: (row: HTMLTableRowElement) => {
          const txt = row.cells[1]?.textContent ?? '';
          const v = parseFloat(txt.replace(/[^0-9.\-]/g, ''));
          return Number.isFinite(v) && v <= 20;
        },
        toDirective: () => ({
          kind: 'numeric-range',
          columnKey: 'reading',
          min: null,
          max: 20,
          hideEmpty: false,
        }),
      });
    });

    // The open popup recomputed over the now-narrower visible set.
    expect(await readStat(page, 'Count')).toBe('9');
    expect(await readStat(page, 'Missing')).toContain('0');
  });
});

/* ── US3: summary-row ───────────────────────────────────────────────── */

test.describe('US3: summary-row', () => {
  const URL = `${BASE}/summary-row/index.html`;
  const UNITS_VALUE = '#sales-summary tfoot tr.gs-summary-row td:nth-child(2) .gs-summary-value';
  const UNITS_CTRL = '#sales-summary tfoot tr.gs-summary-row td:nth-child(2) .gs-summary-agg';

  test('shows a footer aggregate over visible rows; switching to average persists across reload', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    // Default numeric aggregate is the sum: 10+20+30+40+25+35 = 160.
    await expect(page.locator(UNITS_VALUE)).toHaveText('160');

    // Cycle Units to average → (160/6) ≈ 26.67.
    await page.locator(UNITS_CTRL).click();
    await expect(page.locator(UNITS_CTRL)).toHaveText('avg');
    await expect(page.locator(UNITS_VALUE)).toHaveText('26.67');

    // The choice persists across a reload.
    await page.reload();
    await page.waitForFunction(() => !!(window as any).gridSight);
    await expect(page.locator(UNITS_CTRL)).toHaveText('avg');
    await expect(page.locator(UNITS_VALUE)).toHaveText('26.67');
  });

  test('recomputes the footer when a filter changes the visible set', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await expect(page.locator(UNITS_VALUE)).toHaveText('160');

    // Keep Units >= 30 (East 30, West 40, Coastal 35) → sum 105.
    await page.evaluate(() => {
      const t = document.getElementById('sales-summary') as HTMLTableElement;
      (window as any).__gridSightVisibleRows.setFilter(t, 1, {
        columnIndex: 1,
        columnKey: 'units',
        test: (row: HTMLTableRowElement) => {
          const v = parseFloat(row.cells[1]?.textContent ?? '');
          return Number.isFinite(v) && v >= 30;
        },
        toDirective: () => ({ kind: 'numeric-range', columnKey: 'units', min: 30, max: null, hideEmpty: false }),
      });
    });
    await expect(page.locator(UNITS_VALUE)).toHaveText('105');
  });

  test('disable→enable round-trip restores the footer and choices without reload', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);

    // Choose average first so the round-trip has a non-default choice to restore.
    await page.locator(UNITS_CTRL).click();
    await expect(page.locator(UNITS_CTRL)).toHaveText('avg');

    const cb = page.locator('[data-gs-toggle-panel-root] input[value="summary-row"]');

    // OFF → footer removed (byte-identical un-inject).
    await cb.uncheck();
    await raf(page);
    await expect(page.locator('#sales-summary tr.gs-summary-row')).toHaveCount(0);

    // ON → footer restored via the registry apply hook, choices intact, no reload.
    await cb.check();
    await raf(page);
    await expect(page.locator('#sales-summary tr.gs-summary-row')).toHaveCount(1);
    await expect(page.locator(UNITS_CTRL)).toHaveText('avg');
    await expect(page.locator(UNITS_VALUE)).toHaveText('26.67');
  });
});

/* ── US4: find-in-table ─────────────────────────────────────────────── */

test.describe('US4: find-in-table', () => {
  const URL = `${BASE}/find-in-table/index.html`;
  const LOZENGE = '#lookup [data-gs-lozenge-id="find-in-table"]';

  async function openBoxAndSearch(page: import('@playwright/test').Page, term: string) {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.locator('#lookup .grid-sight-toggle').first().click();
    await page.locator(LOZENGE).click();
    await expect(page.locator('.gs-find-box')).toBeVisible();
    await page.locator('.gs-find-box input').fill(term);
  }

  test('highlights every visible match, steps with Next/Prev (wrap), and clears on close', async ({ page }) => {
    await openBoxAndSearch(page, 'EU'); // EU appears in 5 region cells

    await expect(page.locator('#lookup .gs-find-match')).toHaveCount(5);
    await expect(page.locator('.gs-find-count')).toHaveText('1 of 5');
    await expect(page.locator('#lookup .gs-find-current')).toHaveCount(1);

    await page.locator('.gs-find-box [aria-label="Next match"]').click();
    await expect(page.locator('.gs-find-count')).toHaveText('2 of 5');

    await page.locator('.gs-find-box [aria-label="Previous match"]').click();
    await expect(page.locator('.gs-find-count')).toHaveText('1 of 5');
    await page.locator('.gs-find-box [aria-label="Previous match"]').click();
    await expect(page.locator('.gs-find-count')).toHaveText('5 of 5'); // wrap

    // Close → box gone, every highlight removed.
    await page.locator('.gs-find-box [aria-label="Close find"]').click();
    await expect(page.locator('.gs-find-box')).toHaveCount(0);
    await expect(page.locator('#lookup .gs-find-match')).toHaveCount(0);
    await expect(page.locator('#lookup .gs-find-current')).toHaveCount(0);
  });

  test('disable→enable round-trip restores the corner lozenge without reload', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.locator('#lookup .grid-sight-toggle').first().click();
    await expect(page.locator(LOZENGE)).toHaveCount(1);

    const cb = page.locator('[data-gs-toggle-panel-root] input[value="find-in-table"]');
    await cb.uncheck();
    await raf(page);
    await expect(page.locator(LOZENGE)).toHaveCount(0);

    await cb.check();
    await raf(page);
    await expect(page.locator(LOZENGE)).toHaveCount(1);
  });

  test('an enabled-but-inapplicable enrichment (sliders) shows a disabled corner lozenge', async ({ page }) => {
    await page.goto(URL);
    await page.waitForFunction(() => !!(window as any).gridSight);
    await page.locator('#lookup .grid-sight-toggle').first().click();

    // The lookup table is all text → no numeric axis. Enabling sliders must
    // surface the corner S lozenge in a disabled state with a reason, not hide it.
    await page.locator('[data-gs-toggle-panel-root] input[value="sliders"]').check();
    await raf(page);

    const s = page.locator('#lookup [data-gs-lozenge-id="sliders"]');
    await expect(s).toHaveCount(1);
    await expect(s).toHaveAttribute('aria-disabled', 'true');
    await expect(s).toHaveClass(/gs-lozenge--disabled/);
    await expect(s).toHaveAttribute('title', /slider/i);
  });
});
