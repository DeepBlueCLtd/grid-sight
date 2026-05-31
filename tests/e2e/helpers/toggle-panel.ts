import type { Page } from '@playwright/test';
import type { EnrichmentId } from './gridsight-window';

/** Resolve after the next animation frame, so lozenge DOM mutations settle. */
export const raf = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

/**
 * Drive the real toggle panel: tick/untick the checkbox whose `value` is the
 * enrichment id (`src/ui/toggle-panel.ts` sets `input.value = entry.id`), then
 * wait for the resulting DOM mutation to settle.
 */
export async function setEnrichment(page: Page, id: EnrichmentId, on: boolean): Promise<void> {
  const checkbox = page.locator(
    `[data-gs-toggle-panel-root] input[type=checkbox][value="${id}"]`,
  );
  await checkbox.setChecked(on);
  await raf(page);
}

/**
 * Placement-aware (3A): a lozenge for `id` lives either in a per-column header
 * or in the table-level corner cluster — both sit inside (or alongside) the
 * table. We scope the search to the table's wrapper so corner-mounted lozenges
 * (e.g. sliders) are found too.
 */
function lozengeSelector(tableId: string, id: EnrichmentId): string {
  return `#${tableId} [data-gs-lozenge-id="${id}"], ` +
    `#${tableId} ~ * [data-gs-lozenge-id="${id}"]`;
}

export async function hasActiveLozenge(
  page: Page,
  tableId: string,
  id: EnrichmentId,
): Promise<boolean> {
  const loz = page.locator(lozengeSelector(tableId, id)).first();
  if ((await loz.count()) === 0) return false;
  const cls = (await loz.getAttribute('class')) ?? '';
  const disabled = (await loz.getAttribute('aria-disabled')) === 'true';
  return cls.includes('gs-lozenge--active') && !disabled;
}

export async function hasDisabledLozenge(
  page: Page,
  tableId: string,
  id: EnrichmentId,
): Promise<boolean> {
  const loz = page.locator(lozengeSelector(tableId, id)).first();
  if ((await loz.count()) === 0) return false;
  const cls = (await loz.getAttribute('class')) ?? '';
  const disabled = (await loz.getAttribute('aria-disabled')) === 'true';
  return cls.includes('gs-lozenge--disabled') || disabled;
}
