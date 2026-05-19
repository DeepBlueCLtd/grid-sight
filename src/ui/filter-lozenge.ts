/**
 * Filter lozenge (▽) — opens the type-appropriate filter popup.
 */

import {
  collectCategoricalValues,
  numericRange,
  categoricalInclusion,
} from '../enrichments/filter';
import type { FilterPredicate, FilterDirective } from '../utils/visible-rows';
import { openNumericFilterPopup } from './filter-popup-numeric';
import { openCategoricalFilterPopup } from './filter-popup-categorical';

export interface FilterLozengeArgs {
  table: HTMLTableElement;
  columnIndex: number;
  columnKey: string;
  columnType: 'numeric' | 'categorical';
  getCurrentFilter: () => FilterPredicate | null;
  onChange: (predicate: FilterPredicate | null) => void;
}

const LOZENGE_CLASS = 'gs-lozenge';
const LOZENGE_FILTER_CLASS = 'gs-lozenge--filter';
const LOZENGE_ACTIVE_CLASS = 'gs-lozenge--active';

export function createFilterLozenge(args: FilterLozengeArgs): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${LOZENGE_CLASS} ${LOZENGE_FILTER_CLASS}`;
  btn.setAttribute('data-gs-lozenge-id', 'filter');
  btn.textContent = '▽';
  const refresh = () => {
    const active = !!args.getCurrentFilter();
    btn.classList.toggle(LOZENGE_ACTIVE_CLASS, active);
    btn.setAttribute('aria-pressed', String(active));
    const label = active
      ? `Edit filter on column ${args.columnIndex + 1}`
      : `Add filter on column ${args.columnIndex + 1}`;
    btn.setAttribute('aria-label', label);
    btn.title = label;
  };
  refresh();

  let closer: (() => void) | null = null;
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (closer) {
      closer();
      closer = null;
      return;
    }
    closer = openPopup(args, btn, () => {
      closer = null;
      refresh();
    });
  });

  // Re-expose refresh as an attribute the host can call.
  (btn as any).__gsRefreshFilterLozenge = refresh;
  return btn;
}

function openPopup(
  args: FilterLozengeArgs,
  btn: HTMLButtonElement,
  onClosed: () => void
): () => void {
  const current = args.getCurrentFilter();
  const directive = current?.toDirective() ?? null;

  if (args.columnType === 'numeric') {
    return openNumericFilterPopup({
      anchorEl: btn,
      columnIndex: args.columnIndex,
      columnKey: args.columnKey,
      current: directiveToNumeric(directive),
      onApply: (predicate) => args.onChange(predicate),
      onClose: onClosed,
    });
  }

  const counts = collectCategoricalValues(args.table, args.columnIndex);
  return openCategoricalFilterPopup({
    anchorEl: btn,
    columnIndex: args.columnIndex,
    columnKey: args.columnKey,
    current: directiveToCategorical(directive),
    valueCounts: counts,
    onApply: (predicate) => args.onChange(predicate),
    onClose: onClosed,
  });
}

function directiveToNumeric(
  d: FilterDirective | null
): { min: number | null; max: number | null; hideEmpty: boolean } | null {
  if (!d || d.kind !== 'numeric-range') return null;
  return { min: d.min, max: d.max, hideEmpty: d.hideEmpty };
}

function directiveToCategorical(
  d: FilterDirective | null
): { allowed: ReadonlySet<string>; hideEmpty: boolean } | null {
  if (!d || d.kind !== 'categorical') return null;
  return { allowed: new Set(d.allowed), hideEmpty: d.hideEmpty };
}

// Re-export the predicate factories so the test surface is one import.
export { numericRange, categoricalInclusion };
