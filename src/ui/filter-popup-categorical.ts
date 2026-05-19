/**
 * Categorical filter popup. Count-labelled checkbox list + search + Select all/none.
 */

import { categoricalInclusion } from '../enrichments/filter';
import type { FilterPredicate } from '../utils/visible-rows';
import { installPopupChrome, positionPopup } from './filter-popup-numeric';

export interface CategoricalPopupArgs {
  anchorEl: HTMLElement;
  columnIndex: number;
  columnKey: string;
  current: { allowed: ReadonlySet<string>; hideEmpty: boolean } | null;
  valueCounts: ReadonlyMap<string, number>;
  onApply: (predicate: FilterPredicate | null) => void;
  onClose: () => void;
}

export function openCategoricalFilterPopup(args: CategoricalPopupArgs): () => void {
  const popup = document.createElement('div');
  popup.className = 'gs-filter-popup gs-filter-popup--categorical';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Categorical filter');

  // Search input
  const searchRow = document.createElement('div');
  searchRow.className = 'gs-filter-popup__row';
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'gs-filter-popup__search';
  search.placeholder = 'Search values';
  search.setAttribute('aria-label', 'Filter the value list');
  searchRow.appendChild(search);

  // Toggle row (select all / none, hide empty)
  const toggleRow = document.createElement('div');
  toggleRow.className = 'gs-filter-popup__row';
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.textContent = 'Select all';
  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.textContent = 'Select none';
  toggleRow.append(allBtn, noneBtn);

  const hideRow = document.createElement('div');
  hideRow.className = 'gs-filter-popup__row';
  const hideLabel = document.createElement('label');
  const hideInput = document.createElement('input');
  hideInput.type = 'checkbox';
  hideInput.checked = !!args.current?.hideEmpty;
  hideLabel.appendChild(hideInput);
  hideLabel.appendChild(document.createTextNode(' Hide empty cells'));
  hideRow.appendChild(hideLabel);

  // Checkbox list
  const list = document.createElement('div');
  list.className = 'gs-filter-popup__list';

  // Sort entries: empty first, then by count desc.
  const entries = Array.from(args.valueCounts.entries()).sort((a, b) => {
    if (a[0] === '' && b[0] !== '') return -1;
    if (b[0] === '' && a[0] !== '') return 1;
    return b[1] - a[1];
  });

  const initialAllowed = args.current?.allowed
    ? new Set(args.current.allowed)
    : new Set(entries.map(([v]) => v));

  interface ItemEntry { value: string; checkbox: HTMLInputElement; label: HTMLLabelElement; }
  const items: ItemEntry[] = entries.map(([value, count]) => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = initialAllowed.has(value);
    cb.value = value;
    label.appendChild(cb);
    const text = value === '' ? '(empty)' : value;
    label.appendChild(document.createTextNode(` ${text} (${count})`));
    list.appendChild(label);
    return { value, checkbox: cb, label };
  });

  function applyFilterTerm(term: string): void {
    const q = term.trim().toLowerCase();
    for (const item of items) {
      const shown = !q || item.value.toLowerCase().includes(q);
      item.label.style.display = shown ? '' : 'none';
    }
  }

  search.addEventListener('input', () => applyFilterTerm(search.value));
  allBtn.addEventListener('click', () => items.forEach((i) => { if (i.label.style.display !== 'none') i.checkbox.checked = true; }));
  noneBtn.addEventListener('click', () => items.forEach((i) => { if (i.label.style.display !== 'none') i.checkbox.checked = false; }));

  // Actions
  const actionsRow = document.createElement('div');
  actionsRow.className = 'gs-filter-popup__actions';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear';
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.textContent = 'Apply';
  actionsRow.append(clearBtn, applyBtn);

  popup.append(searchRow, toggleRow, hideRow, list, actionsRow);
  positionPopup(popup, args.anchorEl);
  document.body.appendChild(popup);
  search.focus();

  const focusables: HTMLElement[] = [search, allBtn, noneBtn, hideInput, ...items.map((i) => i.checkbox), clearBtn, applyBtn];

  const dispose = installPopupChrome(popup, args.anchorEl, focusables, () => {
    args.onClose();
  });

  function readPredicate(): FilterPredicate | null {
    const allowed = items.filter((i) => i.checkbox.checked).map((i) => i.value);
    const hideEmpty = hideInput.checked;
    if (allowed.length === items.length && !hideEmpty) return null;
    return categoricalInclusion({
      columnIndex: args.columnIndex,
      columnKey: args.columnKey,
      allowed,
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

  return dispose;
}
