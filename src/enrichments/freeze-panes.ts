/**
 * `freeze-panes` enrichment (spec 014). Sticky header row + frozen key column
 * while scrolling a large table.
 *
 * Pure class-tagging: the apply pass adds `gs-freeze` to the table,
 * `gs-freeze-header` to every header-row cell, and `gs-freeze-col` to the first
 * *logical* cell of every grid row (the key column). The header row's first
 * cell carries both classes — it is the pinned corner. All positioning lives in
 * the injected `gs-freeze-styles` sheet (`ensureFreezeStyles`).
 *
 * No DOM wrapping, no text-node surgery, no inline styles: `removeFreezePanes`
 * just strips the three classes (and any now-empty `class=""` attribute) to
 * leave the table byte-identical to its pre-apply DOM (constitution §IV).
 *
 * The key column is resolved through the table-grid addressing layer
 * (`gridCells(row)[0]`), never `:first-child`, so a slider scaffold cell never
 * gets mistaken for the key column (spec 013).
 */

import { ensureFreezeStyles } from '../ui/freeze-panes-styles';
import { gridRows, gridCells, headerRow } from '../core/table-grid';

const FREEZE_CLASS = 'gs-freeze';
const HEADER_CLASS = 'gs-freeze-header';
const COL_CLASS = 'gs-freeze-col';

/** Remove a class and drop the attribute entirely if it became empty — an
 *  element that had no `class` before must have none after (byte-identity). */
function dropClass(el: Element, cls: string): void {
  el.classList.remove(cls);
  if (el.getAttribute('class') === '') el.removeAttribute('class');
}

/** Tag the header row + key column and mark the table as frozen.
 *  Idempotent. No-op if the table has no grid rows. */
export function applyFreezePanes(table: HTMLTableElement): void {
  const rows = gridRows(table);
  if (rows.length === 0) return; // nothing to freeze
  ensureFreezeStyles();

  const hr = headerRow(table);
  if (hr) {
    for (const cell of gridCells(hr)) cell.classList.add(HEADER_CLASS);
  }
  for (const row of rows) {
    const first = gridCells(row)[0];
    if (first) first.classList.add(COL_CLASS);
  }

  table.classList.add(FREEZE_CLASS);
}

/** Remove all freeze classes. MUST leave the table byte-identical to its
 *  pre-apply DOM. */
export function removeFreezePanes(table: HTMLTableElement): void {
  // Remove header class first; corner cells then still carry the col class so
  // the second query finds them and clears that too.
  table.querySelectorAll('.' + HEADER_CLASS).forEach((c) => dropClass(c, HEADER_CLASS));
  table.querySelectorAll('.' + COL_CLASS).forEach((c) => dropClass(c, COL_CLASS));
  dropClass(table, FREEZE_CLASS);
}
