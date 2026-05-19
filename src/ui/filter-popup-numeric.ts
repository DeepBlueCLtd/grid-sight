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

interface NumericInputs {
  min: HTMLInputElement;
  max: HTMLInputElement;
  hideEmpty: HTMLInputElement;
}

function buildLabelledInput(
  labelText: string,
  type: 'number' | 'checkbox',
  initialValue: string | boolean
): { row: HTMLDivElement; input: HTMLInputElement } {
  const row = document.createElement('div');
  row.className = 'gs-filter-popup__row';
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = type;
  if (type === 'number') {
    label.textContent = labelText + ' ';
    input.value = initialValue as string;
    input.placeholder = '—';
    label.appendChild(input);
  } else {
    input.checked = initialValue as boolean;
    label.appendChild(input);
    label.appendChild(document.createTextNode(' ' + labelText));
  }
  row.appendChild(label);
  return { row, input };
}

function buildPopupShell(args: NumericPopupArgs): { popup: HTMLDivElement; inputs: NumericInputs; clearBtn: HTMLButtonElement; applyBtn: HTMLButtonElement } {
  const popup = document.createElement('div');
  popup.className = 'gs-filter-popup gs-filter-popup--numeric';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Numeric filter');

  const min = buildLabelledInput('Min', 'number', stringifyNumber(args.current?.min));
  const max = buildLabelledInput('Max', 'number', stringifyNumber(args.current?.max));
  const hide = buildLabelledInput('Hide empty cells', 'checkbox', !!args.current?.hideEmpty);

  const actionsRow = document.createElement('div');
  actionsRow.className = 'gs-filter-popup__actions';
  const clearBtn = makeButton('Clear');
  const applyBtn = makeButton('Apply');
  actionsRow.appendChild(clearBtn);
  actionsRow.appendChild(applyBtn);

  popup.append(min.row, max.row, hide.row, actionsRow);
  return {
    popup,
    inputs: { min: min.input, max: max.input, hideEmpty: hide.input },
    clearBtn,
    applyBtn,
  };
}

function stringifyNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n);
}

function makeButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  return btn;
}

function parseNumberInput(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 'invalid';
}

function readPredicateFromInputs(args: NumericPopupArgs, inputs: NumericInputs): FilterPredicate | null {
  const min = parseNumberInput(inputs.min.value);
  const max = parseNumberInput(inputs.max.value);
  if (min === 'invalid' || max === 'invalid') return null;
  const hideEmpty = inputs.hideEmpty.checked;
  if (min === null && max === null && !hideEmpty) return null;
  return numericRange({
    columnIndex: args.columnIndex,
    columnKey: args.columnKey,
    min,
    max,
    hideEmpty,
  });
}

export function openNumericFilterPopup(args: NumericPopupArgs): () => void {
  const { popup, inputs, clearBtn, applyBtn } = buildPopupShell(args);
  positionPopup(popup, args.anchorEl);
  document.body.appendChild(popup);

  const focusables: HTMLElement[] = [inputs.min, inputs.max, inputs.hideEmpty, clearBtn, applyBtn];
  inputs.min.focus();

  const dispose = installPopupChrome(popup, args.anchorEl, focusables, args.onClose);

  const apply = () => {
    args.onApply(readPredicateFromInputs(args, inputs));
    dispose();
  };
  applyBtn.addEventListener('click', apply);
  clearBtn.addEventListener('click', () => {
    args.onApply(null);
    dispose();
  });
  popup.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target !== clearBtn) {
      ev.preventDefault();
      apply();
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
    if (ev.shiftKey && idx <= 0) {
      ev.preventDefault();
      focusables[focusables.length - 1].focus();
    } else if (!ev.shiftKey && idx === focusables.length - 1) {
      ev.preventDefault();
      focusables[0].focus();
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
