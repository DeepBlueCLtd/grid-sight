/**
 * Numeric-range filter popup. Min/Max inputs + "Hide empty cells" toggle.
 *
 * Apply emits a `FilterPredicate | null` (null clears the filter).
 */

import { numericRange } from '../enrichments/filter';
import type { FilterPredicate } from '../utils/visible-rows';

export interface NumericPopupArgs {
  anchorEl: HTMLElement;
  columnIndex: number;
  columnKey: string;
  current: { min: number | null; max: number | null; hideEmpty: boolean } | null;
  onApply: (predicate: FilterPredicate | null) => void;
  onClose: () => void;
}

export function openNumericFilterPopup(args: NumericPopupArgs): () => void {
  const popup = document.createElement('div');
  popup.className = 'gs-filter-popup gs-filter-popup--numeric';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Numeric filter');

  const minRow = document.createElement('div');
  minRow.className = 'gs-filter-popup__row';
  const minLabel = document.createElement('label');
  minLabel.textContent = 'Min ';
  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.value = args.current?.min ?? '' as any;
  minInput.placeholder = '—';
  minLabel.appendChild(minInput);
  minRow.appendChild(minLabel);

  const maxRow = document.createElement('div');
  maxRow.className = 'gs-filter-popup__row';
  const maxLabel = document.createElement('label');
  maxLabel.textContent = 'Max ';
  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.value = args.current?.max ?? '' as any;
  maxInput.placeholder = '—';
  maxLabel.appendChild(maxInput);
  maxRow.appendChild(maxLabel);

  const hideRow = document.createElement('div');
  hideRow.className = 'gs-filter-popup__row';
  const hideLabel = document.createElement('label');
  const hideInput = document.createElement('input');
  hideInput.type = 'checkbox';
  hideInput.checked = !!args.current?.hideEmpty;
  hideLabel.appendChild(hideInput);
  hideLabel.appendChild(document.createTextNode(' Hide empty cells'));
  hideRow.appendChild(hideLabel);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'gs-filter-popup__actions';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.textContent = 'Apply';
  actionsRow.appendChild(clearBtn);
  actionsRow.appendChild(applyBtn);

  popup.append(minRow, maxRow, hideRow, actionsRow);

  positionPopup(popup, args.anchorEl);
  document.body.appendChild(popup);

  const focusables: HTMLElement[] = [minInput, maxInput, hideInput, clearBtn, applyBtn];
  minInput.focus();

  const dispose = installPopupChrome(popup, args.anchorEl, focusables, () => {
    args.onClose();
  });

  function readPredicate(): FilterPredicate | null {
    const minRaw = minInput.value.trim();
    const maxRaw = maxInput.value.trim();
    const min = minRaw === '' ? null : Number(minRaw);
    const max = maxRaw === '' ? null : Number(maxRaw);
    const hideEmpty = hideInput.checked;
    if (min === null && max === null && !hideEmpty) return null;
    if (min !== null && !Number.isFinite(min)) return null;
    if (max !== null && !Number.isFinite(max)) return null;
    return numericRange({
      columnIndex: args.columnIndex,
      columnKey: args.columnKey,
      min,
      max,
      hideEmpty,
    });
  }

  applyBtn.addEventListener('click', () => {
    args.onApply(readPredicate());
    dispose();
  });
  clearBtn.addEventListener('click', () => {
    args.onApply(null);
    dispose();
  });

  // Apply on Enter.
  popup.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target !== clearBtn) {
      ev.preventDefault();
      args.onApply(readPredicate());
      dispose();
    }
  });

  return dispose;
}

/* ── Shared popup chrome (focus trap, outside-click, Escape) ────────── */

export function installPopupChrome(
  popup: HTMLElement,
  anchorEl: HTMLElement,
  focusables: readonly HTMLElement[],
  onClose: () => void
): () => void {
  let disposed = false;

  const trap = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      dispose();
      return;
    }
    if (ev.key !== 'Tab' || focusables.length === 0) return;
    const idx = focusables.indexOf(document.activeElement as HTMLElement);
    if (ev.shiftKey) {
      if (idx <= 0) {
        ev.preventDefault();
        focusables[focusables.length - 1].focus();
      }
    } else {
      if (idx === focusables.length - 1) {
        ev.preventDefault();
        focusables[0].focus();
      }
    }
  };

  const outside = (ev: MouseEvent) => {
    if (!popup.contains(ev.target as Node) && ev.target !== anchorEl) {
      dispose();
    }
  };

  popup.addEventListener('keydown', trap);
  setTimeout(() => document.addEventListener('mousedown', outside), 0);

  function dispose() {
    if (disposed) return;
    disposed = true;
    popup.removeEventListener('keydown', trap);
    document.removeEventListener('mousedown', outside);
    if (popup.parentNode) popup.parentNode.removeChild(popup);
    try { anchorEl.focus(); } catch { /* ignore */ }
    onClose();
  }

  return dispose;
}

export function positionPopup(popup: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  popup.style.position = 'absolute';
  popup.style.top = `${rect.bottom + window.scrollY + 2}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
}
