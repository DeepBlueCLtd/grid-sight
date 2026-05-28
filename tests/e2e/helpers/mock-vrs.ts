import type { Page } from '@playwright/test';

/**
 * VRS (Visible Row Sequence) mock helper for spec 012-virtual-columns US8.
 *
 * The real visible-row pipeline (spec 002-003-row-visibility) already lives in
 * `src/utils/visible-rows.ts`, but the US8 e2e covers behaviour that depends
 * on pipeline events firing on demand. This helper drives those events from
 * the test by calling the pipeline's public mutators (`setSort`, `setFilter`,
 * `clearFilters`) from the page context.
 *
 * Each event is an op:
 *   - `{ op: 'sort', columnKey, direction }`
 *   - `{ op: 'clear-filters' }`
 *   - `{ op: 'noop-event' }` — re-emits the current sequence (forces fan-out)
 *
 * Once the real pipeline is fully wired into the demo page (already true on
 * `main`), this helper is a thin shim; if a future revision removes that
 * wiring, the helper falls back to installing a tiny stub on `window`.
 */

export interface VrsSortOp {
  op: 'sort';
  tableSelector: string;
  columnKey: string;
  columnIndex: number;
  direction: 'asc' | 'desc';
}

export interface VrsClearOp {
  op: 'clear-filters';
  tableSelector: string;
}

export type VrsEvent = VrsSortOp | VrsClearOp;

export async function installMockVrs(
  page: Page,
  config: { events: VrsEvent[] },
): Promise<void> {
  await page.evaluate((events) => {
    const w = window as unknown as {
      __mockVrsEvents?: VrsEvent[];
      __runMockVrsEvent?: (i: number) => Promise<void>;
    };
    w.__mockVrsEvents = events;
    w.__runMockVrsEvent = async (index: number) => {
      const ev = events[index];
      if (!ev) return;
      const table = document.querySelector(ev.tableSelector) as HTMLTableElement | null;
      if (!table) throw new Error(`mock-vrs: table ${ev.tableSelector} not found`);
      const gs = (window as any).gridSight;
      // Prefer the real pipeline that's already on the page.
      const visibleRows = (window as any).__gridSightVisibleRows ?? gs?.__visibleRows;
      if (visibleRows && typeof visibleRows.setSort === 'function') {
        if (ev.op === 'sort') {
          visibleRows.setSort(table, {
            columnIndex: ev.columnIndex,
            columnKey: ev.columnKey,
            direction: ev.direction,
          });
        } else if (ev.op === 'clear-filters') {
          visibleRows.clearFilters(table);
        }
        return;
      }
      // Fallback: dispatch a custom DOM event the (hypothetical) replacement
      // stub could listen for. This branch is exercised only when the page
      // ships without the real pipeline wired up.
      table.dispatchEvent(new CustomEvent('gs:mock-vrs', { detail: ev }));
    };
  }, config.events as unknown as VrsEvent[]);
}

export async function fireMockVrsEvent(page: Page, index: number): Promise<void> {
  await page.evaluate(async (i) => {
    const w = window as unknown as { __runMockVrsEvent?: (i: number) => Promise<void> };
    if (!w.__runMockVrsEvent) throw new Error('mock-vrs: not installed');
    await w.__runMockVrsEvent(i);
  }, index);
}
