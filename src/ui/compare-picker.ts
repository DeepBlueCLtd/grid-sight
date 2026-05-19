/**
 * Compare picker overlay (spec 012-virtual-columns US3).
 * Highlights numeric column headers, captures two clicks, returns (colKeyA, colKeyB).
 * Escape cancels.
 */

import { getColumnKeys, getNumericColumns } from '../enrichments/virtual-column';

export interface PickerResult {
  colKeyA: string;
  colKeyB: string;
}

const HIGHLIGHT_CLASS = 'gs-vc-pick-target';

export function openComparePicker(
  table: HTMLTableElement,
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
      cell.classList.add(HIGHLIGHT_CLASS);
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      targets.push(cell);
      targetByKey.set(cell.dataset.gsPickKey = key, cell);
    });

    let pickedA: string | null = null;

    function cleanup() {
      for (const cell of targets) {
        cell.classList.remove(HIGHLIGHT_CLASS);
        cell.removeAttribute('role');
        cell.removeAttribute('tabindex');
        delete cell.dataset.gsPickKey;
      }
      document.removeEventListener('keydown', onKey);
      for (const cell of targets) cell.removeEventListener('click', onClick);
    }

    function pick(key: string) {
      if (pickedA === null) {
        pickedA = key;
        const cell = targetByKey.get(key);
        if (cell) cell.setAttribute('aria-pressed', 'true');
      } else {
        if (key === pickedA) {
          // re-pick A — reset
          const cell = targetByKey.get(pickedA);
          if (cell) cell.removeAttribute('aria-pressed');
          pickedA = null;
          return;
        }
        const result = { colKeyA: pickedA, colKeyB: key };
        cleanup();
        resolve(result);
      }
    }

    function onClick(ev: MouseEvent) {
      const cell = ev.currentTarget as HTMLTableCellElement;
      const key = cell.dataset.gsPickKey;
      if (key) pick(key);
    }

    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    }

    for (const cell of targets) {
      cell.addEventListener('click', onClick);
    }
    document.addEventListener('keydown', onKey);

    if (targets.length === 0) {
      cleanup();
      resolve(null);
    }
  });
}
