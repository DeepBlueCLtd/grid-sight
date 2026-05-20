/**
 * Sort lozenge button (↕) — three-state asc → desc → off cycle.
 */

import type { SortDirective } from '../utils/visible-rows';
import type { SortColumnType } from '../enrichments/sort';

export interface SortLozengeArgs {
  columnIndex: number;
  columnKey: string;
  columnType: SortColumnType;
  getCurrentSort: () => SortDirective | null;
  onChange: (next: SortDirective | null) => void;
}

const LOZENGE_CLASS = 'gs-lozenge';
const LOZENGE_SORT_CLASS = 'gs-lozenge--sort';
const LOZENGE_ACTIVE_CLASS = 'gs-lozenge--active';

function nextState(current: SortDirective | null, args: SortLozengeArgs): SortDirective | null {
  if (!current || current.columnIndex !== args.columnIndex) {
    return { columnIndex: args.columnIndex, columnKey: args.columnKey, direction: 'asc' };
  }
  if (current.direction === 'asc') {
    return { columnIndex: args.columnIndex, columnKey: args.columnKey, direction: 'desc' };
  }
  return null;
}

function actionLabel(current: SortDirective | null, args: SortLozengeArgs): string {
  const next = nextState(current, args);
  if (!next) return `Clear sort on column ${args.columnIndex + 1}`;
  return `Sort column ${args.columnIndex + 1} ${next.direction}ending`;
}

export function createSortLozenge(args: SortLozengeArgs): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${LOZENGE_CLASS} ${LOZENGE_SORT_CLASS}`;
  btn.setAttribute('data-gs-lozenge-id', 'sort');
  btn.textContent = '↕'; // ↕
  const refresh = () => {
    const cur = args.getCurrentSort();
    const active = !!(cur && cur.columnIndex === args.columnIndex);
    btn.classList.toggle(LOZENGE_ACTIVE_CLASS, active);
    btn.setAttribute('aria-label', actionLabel(cur, args));
    btn.title = actionLabel(cur, args);
  };
  refresh();
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const cur = args.getCurrentSort();
    const next = nextState(cur, args);
    args.onChange(next);
    refresh();
  });
  return btn;
}
