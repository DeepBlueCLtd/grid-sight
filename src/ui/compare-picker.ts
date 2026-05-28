/**
 * Compare picker overlay (spec 012-virtual-columns US3).
 *
 * Affordance (per UX request):
 *  - the Δ lozenge takes a reversed-colour state while compare mode is armed;
 *  - numeric column headers are marked as clickable candidates;
 *  - each picked column header takes the same reversed-colour state;
 *  - the reversed state is cleared once the compare column is shown (resolve)
 *    or the pick is cancelled;
 *  - clicking anything that is not a candidate column header cancels the pick
 *    (so does Escape). Keyboard: a focused candidate is picked with Enter/Space.
 */

import { getColumnKeys, getNumericColumns } from '../enrichments/virtual-column';

export interface PickerResult {
  colKeyA: string;
  colKeyB: string;
}

const TARGET_CLASS = 'gs-vc-pick-target';
const ACTIVE_CLASS = 'gs-vc-pick-active';

export function openComparePicker(
  table: HTMLTableElement,
  lozenge?: HTMLElement,
): Promise<PickerResult | null> {
  return new Promise((resolve) => {
    const head = table.tHead?.rows[0];
    if (!head) {
      resolve(null);
      return;
    }
    const columnKeys = getColumnKeys(table);
    const numeric = getNumericColumns(table);
    const targets: HTMLTableCellElement[] = [];
    const targetByKey = new Map<string, HTMLTableCellElement>();

    Array.from(head.cells).forEach((cell, i) => {
      const key = columnKeys[i];
      if (!numeric.has(key)) return;
      cell.classList.add(TARGET_CLASS);
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      targets.push(cell);
      targetByKey.set((cell.dataset.gsPickKey = key), cell);
    });

    if (targets.length === 0) {
      resolve(null);
      return;
    }

    // Reverse the Δ lozenge's colours for the duration of the pick.
    lozenge?.classList.add(ACTIVE_CLASS);

    let pickedA: string | null = null;
    let settled = false;

    function cleanup() {
      for (const cell of targets) {
        cell.classList.remove(TARGET_CLASS, ACTIVE_CLASS);
        cell.removeAttribute('role');
        cell.removeAttribute('tabindex');
        cell.removeAttribute('aria-pressed');
        delete cell.dataset.gsPickKey;
      }
      lozenge?.classList.remove(ACTIVE_CLASS);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onOutside, true);
      for (const cell of targets) {
        cell.removeEventListener('click', onClick);
      }
    }

    function finish(result: PickerResult | null) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function pick(key: string) {
      const cell = targetByKey.get(key);
      if (pickedA === null) {
        pickedA = key;
        if (cell) {
          cell.classList.add(ACTIVE_CLASS);
          cell.setAttribute('aria-pressed', 'true');
        }
        return;
      }
      if (key === pickedA) {
        // Re-clicking the first pick deselects it.
        const a = targetByKey.get(pickedA);
        if (a) {
          a.classList.remove(ACTIVE_CLASS);
          a.removeAttribute('aria-pressed');
        }
        pickedA = null;
        return;
      }
      finish({ colKeyA: pickedA, colKeyB: key });
    }

    function onClick(ev: MouseEvent) {
      const cell = ev.currentTarget as HTMLTableCellElement;
      const key = cell.dataset.gsPickKey;
      if (key) pick(key);
    }

    function onOutside(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      // The lozenge owns its own toggle behaviour; ignore clicks on it.
      if (lozenge && (target === lozenge || lozenge.contains(target))) return;
      // A click on (or inside) a candidate header is a pick — handled by
      // onClick — not a cancel. This runs in the capture phase, before
      // onClick, so the candidate check must be explicit here.
      const th = target.closest('th') as HTMLTableCellElement | null;
      if (th && targets.includes(th)) return;
      // Anything else clears the pick.
      finish(null);
    }

    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        finish(null);
        return;
      }
      if (ev.key === 'Enter' || ev.key === ' ') {
        const active = document.activeElement as HTMLElement | null;
        const key = active?.dataset?.gsPickKey;
        if (key && targetByKey.has(key)) {
          ev.preventDefault();
          pick(key);
        }
      }
    }

    for (const cell of targets) {
      cell.addEventListener('click', onClick);
    }
    document.addEventListener('keydown', onKey);
    // Attach the outside-click canceller on the next tick so the click that
    // opened the picker (on the Δ lozenge) does not immediately cancel it.
    setTimeout(() => {
      if (!settled) document.addEventListener('click', onOutside, true);
    }, 0);
  });
}
