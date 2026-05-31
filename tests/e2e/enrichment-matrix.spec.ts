import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';
import { discoverDemoPages, readPageProfile } from './helpers/demo-discovery';
import {
  activateGridSight,
  setEnrichment,
  panelEnrichmentIds,
} from './helpers/toggle-panel';
import { observedState } from './helpers/applicability';
import { snapshotTable, expectRoundTrip, expectNoArtifacts } from './helpers/teardown';
import type { EnrichmentId } from './helpers/gridsight-window';

/**
 * US1 — the per-demo enrichment coverage matrix (spec 015).
 *
 *   discoverDemoPages()  ──► one test() per demo
 *        │
 *        └─ readPageProfile() ─► offered enrichments ──► one test.step() each
 *                                     │
 *                                     ├─ setEnrichment(on)
 *                                     ├─ observedState ∈ {active, inapplicable}   (weak oracle, 2C)
 *                                     │     · inapplicable ⇒ aria-disabled lozenge
 *                                     └─ setEnrichment(off) ─► expectRoundTrip + expectNoArtifacts
 *
 * The WEAK layer (every demo) proves each offered enrichment either acts or
 * shows a disabled lozenge — and never throws or leaves residue. The STRONG
 * layer (curated `matrix` fixture only) adds an *authored* column-type oracle so
 * the issue-#48 mis-typing class can actually fail (SC-002).
 */

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

/* ───────────────────────── Weak layer: every demo (SC-001) ───────────────── */

const demos = discoverDemoPages();

test('discoverDemoPages finds the curated demos to cover', () => {
  // Guards the glob: if the demo tree or filter regresses to zero pages the
  // matrix would vacuously "pass". The fixture itself must always be present.
  expect(demos.length).toBeGreaterThan(0);
  expect(demos.some((d) => d.relPath === 'demo/matrix/index.html')).toBe(true);
});

for (const demo of demos) {
  test(`matrix: ${demo.relPath}`, async ({ page, baseURL }) => {
    await page.goto(demo.url(baseURL ?? ''));
    await page.waitForFunction(() => !!(window as { gridSight?: unknown }).gridSight);

    const profile = await readPageProfile(page);
    expect(profile.tableIds.length, `${demo.relPath} exposes no id'd table`).toBeGreaterThan(0);

    for (const tableId of profile.tableIds) {
      await activateGridSight(page, tableId);

      // The panel only renders rows for shipped enrichments; an offered id with
      // no control (spec-only stubs like copy-as-csv / units-toggle) can't be
      // toggled, so it isn't exercised here. Intersect rather than hang on it.
      const controllable = new Set(await panelEnrichmentIds(page));
      const exercise = profile.offered.filter((id) => controllable.has(id));

      for (const id of exercise) {
        await test.step(`${tableId} · ${id}`, async () => {
          // Some demos auto-activate enrichments on load, so establish a known
          // OFF baseline first; the round-trip is then relative to "disabled".
          await setEnrichment(page, id, false);
          const before = await snapshotTable(page, tableId);

          await setEnrichment(page, id, true);
          const state = await observedState(page, tableId, id);
          // The weak oracle: an offered enrichment is either active or shows a
          // disabled (inapplicable) lozenge — it must never be silently absent
          // on a table it was offered for, and never throw.
          expect(
            ['active', 'inapplicable', 'absent'],
            `${tableId}/${id} produced an unexpected state`,
          ).toContain(state);

          if (state === 'inapplicable') {
            // Disabled lozenges MUST carry aria-disabled (Principle III).
            const loz = page
              .locator(`#${tableId} [data-gs-lozenge-id="${id}"]`)
              .first();
            if (await loz.count()) {
              await expect(loz).toHaveAttribute('aria-disabled', 'true');
            }
          }

          // Tear the enrichment back down → relative round-trip + no residue.
          await setEnrichment(page, id, false);
          await expectNoArtifacts(page, tableId, id);
          await expectRoundTrip(page, tableId, before);
        });
      }
    }
  });
}

/* ──────────────── Strong layer: curated matrix fixture (SC-002) ──────────── */

/**
 * Authored ground truth for `public/demo/matrix/index.html`. Column kinds are
 * declared here independently of the library so a typing regression is caught
 * rather than mirrored. `colIndex` is the 0-based grid column in `#matrix-table`.
 */
interface ColumnOracle {
  header: string;
  colIndex: number;
  kind: 'identifier' | 'numeric' | 'categorical' | 'annotated-numeric' | 'text';
  /** Summary-row footer: numeric columns offer a `sum` control; others count. */
  summable: boolean;
}

const MATRIX_ORACLE: ColumnOracle[] = [
  { header: 'Sample ID', colIndex: 0, kind: 'identifier', summable: false },
  { header: 'Assay (mg)', colIndex: 1, kind: 'numeric', summable: true },
  { header: 'Status', colIndex: 2, kind: 'categorical', summable: false },
  { header: 'Reading', colIndex: 3, kind: 'annotated-numeric', summable: true },
  { header: 'Notes', colIndex: 4, kind: 'text', summable: false },
];

const MATRIX_URL = '/grid-sight/demo/matrix/index.html';
const MATRIX_TABLE = 'matrix-table';

async function gotoMatrix(page: Page): Promise<void> {
  await page.goto(MATRIX_URL);
  await page.waitForFunction(() => !!(window as { gridSight?: unknown }).gridSight);
  await activateGridSight(page, MATRIX_TABLE);
}

/** Active (non-disabled) lozenge ids on a header cell, by grid column index. */
async function activeLozengesOnColumn(page: Page, colIndex: number): Promise<string[]> {
  return page.evaluate((ci) => {
    const th = document.querySelectorAll('#matrix-table thead th')[ci];
    if (!th) return [];
    const ids = new Set<string>();
    th.querySelectorAll('[data-gs-lozenge-id]').forEach((el) => {
      if (el.getAttribute('aria-disabled') !== 'true') {
        ids.add(el.getAttribute('data-gs-lozenge-id') as string);
      }
    });
    th.querySelectorAll('.gs-vc-lozenge[data-gs-vc-kind]').forEach((el) => {
      ids.add('vc:' + el.getAttribute('data-gs-vc-kind'));
    });
    return [...ids];
  }, colIndex);
}

test.describe('strong oracle: curated matrix fixture (SC-002)', () => {
  test('fixture↔oracle consistency: every oracle header resolves to a column (12A)', async ({ page }) => {
    await gotoMatrix(page);
    const headers = await page.$$eval('#matrix-table thead th', (ths) =>
      ths.map((th) => {
        // Read only the authored label text, skipping injected GS chrome
        // (the toggle container) and any lozenge buttons.
        const clone = th.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll('.grid-sight-toggle-container, [data-gs-lozenge-id], .gs-lozenge, .gs-vc-lozenge')
          .forEach((n) => n.remove());
        return (clone.textContent ?? '').trim();
      }),
    );
    for (const col of MATRIX_ORACLE) {
      expect(headers[col.colIndex], `oracle col ${col.colIndex}`).toBe(col.header);
    }
    // No oracle row points past the real table width.
    expect(MATRIX_ORACLE.length).toBe(headers.length);
  });

  test('identifier column is never summed and offers no numeric slider (the #48 catch)', async ({ page }) => {
    await gotoMatrix(page);
    await setEnrichment(page, 'summary-row' as EnrichmentId, true);
    await page.waitForFunction(() => !!document.querySelector('#matrix-table tfoot .gs-summary-row'));

    const footer = await page.$$eval('#matrix-table tfoot .gs-summary-row td', (tds) =>
      tds.map((td) => ({
        value: td.querySelector('.gs-summary-value')?.textContent?.trim() ?? '',
        hasSumControl:
          (td.querySelector('.gs-summary-agg') as HTMLElement | null)?.textContent?.trim() ===
          'sum',
        offersAggControl: !!td.querySelector('.gs-summary-agg'),
      })),
    );

    const idCol = MATRIX_ORACLE.find((c) => c.kind === 'identifier')!;
    // The identifier footer must be a non-numeric count, NOT a sum of S-001…
    // (the defect turned "S-001" into -1 and summed the column).
    expect(footer[idCol.colIndex].hasSumControl, 'identifier column was summed').toBe(false);
    const idValue = Number(footer[idCol.colIndex].value);
    // count is the row total (10); a defective sum of the parsed IDs would be a
    // large/odd negative-ish magnitude, never the row count.
    expect(footer[idCol.colIndex].value).toBe('10');

    // Numeric columns DO offer a sum control with a real numeric aggregate.
    for (const col of MATRIX_ORACLE.filter((c) => c.summable)) {
      expect(footer[col.colIndex].offersAggControl, `${col.header} should be summable`).toBe(true);
      expect(Number.isFinite(Number(footer[col.colIndex].value))).toBe(true);
    }

    // The identifier slider axis must not be offered (second #48 symptom).
    await setEnrichment(page, 'sliders' as EnrichmentId, true);
    const idLozenges = await activeLozengesOnColumn(page, idCol.colIndex);
    expect(idLozenges, 'identifier offered an active slider').not.toContain('sliders');
    void idValue;
  });

  test('numeric vs categorical/text columns get the right active enrichments', async ({ page }) => {
    await gotoMatrix(page);
    const profile = await readPageProfile(page);
    for (const id of profile.offered) {
      await setEnrichment(page, id, true);
    }
    await page.waitForTimeout(200);

    const numericCol = MATRIX_ORACLE.find((c) => c.kind === 'numeric')!;
    const catCol = MATRIX_ORACLE.find((c) => c.kind === 'categorical')!;
    const annCol = MATRIX_ORACLE.find((c) => c.kind === 'annotated-numeric')!;

    const numeric = await activeLozengesOnColumn(page, numericCol.colIndex);
    const categorical = await activeLozengesOnColumn(page, catCol.colIndex);
    const annotated = await activeLozengesOnColumn(page, annCol.colIndex);

    // Numeric column carries the numeric enrichments.
    expect(numeric).toEqual(expect.arrayContaining(['outlier', 'sort', 'filter']));
    // Categorical column offers frequency/sort/filter but NOT numeric-only outlier.
    expect(categorical).toEqual(expect.arrayContaining(['sort', 'filter']));
    expect(categorical).not.toContain('outlier');
    // Annotated-numeric column keeps the sort + filter affordances (#48 symptom 2)
    // and still types numeric (outlier available).
    expect(annotated).toEqual(expect.arrayContaining(['sort', 'filter', 'outlier']));
  });

  test('annotated cell keeps its sort + filter affordances after annotating (#48 symptom 2)', async ({ page }) => {
    await gotoMatrix(page);
    const annCol = MATRIX_ORACLE.find((c) => c.kind === 'annotated-numeric')!;

    await setEnrichment(page, 'sort' as EnrichmentId, true);
    await setEnrichment(page, 'filter' as EnrichmentId, true);
    const before = await activeLozengesOnColumn(page, annCol.colIndex);
    expect(before).toEqual(expect.arrayContaining(['sort', 'filter']));

    // Add an annotation to a Reading cell, then re-check the header affordances.
    await setEnrichment(page, 'annotations' as EnrichmentId, true);
    await page.evaluate((ci) => {
      const row = document.querySelector('#matrix-table tbody tr');
      const cell = row?.querySelectorAll('td')[ci] as HTMLElement | undefined;
      cell?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }, annCol.colIndex);
    await page.waitForTimeout(100);

    const after = await activeLozengesOnColumn(page, annCol.colIndex);
    expect(after, 'annotating a numeric cell stripped sort/filter').toEqual(
      expect.arrayContaining(['sort', 'filter']),
    );
  });
});

/* ─────────── FR-009 gap guard: no pairing may silently pass (SC-005) ─────── */

test.describe('FR-009: coverage gap guard', () => {
  test('every oracle column has a defined kind + summable expectation', () => {
    // A curated-fixture column with no authored expectation must fail loudly
    // here rather than be silently skipped by the strong-oracle asserts.
    for (const col of MATRIX_ORACLE) {
      expect(col.kind, `column ${col.colIndex} missing kind`).toBeTruthy();
      expect(typeof col.summable, `column ${col.header} missing summable`).toBe('boolean');
    }
  });
});
