import { expect, type Page } from '@playwright/test';
import type { EnrichmentId } from './gridsight-window';

/**
 * Normalize a table's HTML for round-trip comparison (6A/7A). It collapses only
 * *benign* differences — insignificant whitespace between and inside tags — and
 * MUST NOT strip any `gs-*` attribute, class, or node: those are exactly the
 * enrichment artifacts a teardown assertion is checking for. Pure + unit-tested.
 */
export function normalizeForCompare(html: string): string {
  return html
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalized `outerHTML` of the table, as a round-trip baseline/comparand. */
export async function snapshotTable(page: Page, tableId: string): Promise<string> {
  const html = await page.locator(`#${tableId}`).evaluate((el) => el.outerHTML);
  return normalizeForCompare(html);
}

/**
 * Relative round-trip: the table's current normalized HTML must byte-match a
 * snapshot taken before the enrichment was toggled on (FR-004/006).
 */
export async function expectRoundTrip(page: Page, tableId: string, before: string): Promise<void> {
  const after = await snapshotTable(page, tableId);
  expect(after, `table #${tableId} did not round-trip to its pre-enrichment state`).toBe(before);
}

/**
 * Assert no residual `gs-*` artifact for `id` survives while it is disabled:
 * no active lozenge for it, and no node tagged as that enrichment's output.
 */
export async function expectNoArtifacts(page: Page, tableId: string, id: EnrichmentId): Promise<void> {
  const residual = await page.locator(`#${tableId}`).evaluate(
    (table, enrichmentId) => {
      const sel = [
        `[data-gs-lozenge-id="${enrichmentId}"].gs-lozenge--active`,
        `[data-gs-enrichment="${enrichmentId}"]`,
        `[data-gs-virtual-column-kind="${enrichmentId}"]`,
      ].join(',');
      return table.querySelectorAll(sel).length;
    },
    id,
  );
  expect(residual, `disabled enrichment "${id}" left ${residual} artifact(s) in #${tableId}`).toBe(0);
}
