import type { Page } from '@playwright/test';
import type { EnrichmentId } from './gridsight-window';

/** Resolve after the next animation frame, so lozenge DOM mutations settle. */
export const raf = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

/**
 * Activate Grid-Sight on a table if it is not already on. Lozenges only mount
 * once GS is enabled on the table (the `.grid-sight-toggle` control); the
 * enrichment *panel* then governs which of them appear. Idempotent.
 */
export async function activateGridSight(page: Page, tableId: string): Promise<void> {
  const toggle = page.locator(`#${tableId} .grid-sight-toggle`).first();
  if ((await toggle.count()) === 0) return;
  const alreadyOn = await page
    .locator(`#${tableId} [data-gs-lozenge-id]`)
    .count()
    .then((n) => n > 0);
  if (!alreadyOn) {
    await toggle.click();
    await raf(page);
  }
}

/**
 * Drive the real toggle panel: tick/untick the checkbox whose `value` is the
 * enrichment id (`src/ui/toggle-panel.ts` sets `input.value = entry.id`), then
 * wait for the resulting DOM mutation to settle.
 */
export async function setEnrichment(page: Page, id: EnrichmentId, on: boolean): Promise<boolean> {
  // Drive the panel checkbox through a single page-level evaluate rather than a
  // locator. The panel only renders rows for `shipped` enrichments (so an
  // offered-but-unshipped id like `copy-as-csv` has no control → returns false),
  // and some enrichments (find-in-table, summary-row) rebuild parts of the
  // panel/lozenges between calls. A locator's auto-wait then stalls on
  // WebKit/Firefox when its handle is momentarily detached; querying inside the
  // page each call sidesteps that and dispatches the same bubbling `change` the
  // real UI fires, driving the panel's delegated listener.
  const found = await page.evaluate(
    ({ enrichmentId, want }) => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-gs-toggle-panel-root] input[type=checkbox][value="${enrichmentId}"]`,
      );
      if (!input) return false;
      if (input.checked !== want) {
        input.checked = want;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    },
    { enrichmentId: id, want: on },
  );
  await raf(page);
  return found;
}

/** Current checked state of an enrichment's panel checkbox (false if absent). */
export async function isEnrichmentChecked(page: Page, id: EnrichmentId): Promise<boolean> {
  const checkbox = page.locator(
    `[data-gs-toggle-panel-root] input[type=checkbox][value="${id}"]`,
  );
  if ((await checkbox.count()) === 0) return false;
  return checkbox.isChecked();
}

/** Ids the live toggle panel actually renders a checkbox for (shipped set). */
export async function panelEnrichmentIds(page: Page): Promise<string[]> {
  return page.$$eval(
    '[data-gs-toggle-panel-root] input[type=checkbox]',
    (boxes) => boxes.map((b) => (b as HTMLInputElement).value),
  );
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
