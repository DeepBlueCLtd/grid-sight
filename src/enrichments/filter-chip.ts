/**
 * Filter summary chip + clear-all + zero-match empty-state.
 *
 * Subscribes to the pipeline; renders a chip after the table that lists
 * every active filter with a per-filter "×" remove button and a global
 * "Clear all filters" affordance.
 */

import {
  clearFilters,
  getVisibleRows,
  onVisibleRowsChange,
  setFilter,
  type FilterDirective,
  type FilterPredicate,
  type VisibleRowSequence,
} from '../utils/visible-rows';

const CONTAINER_CLASS = 'gs-filter-chip-container';
const CHIP_CLASS = 'gs-filter-chip';
const CHIP_REMOVE_CLASS = 'gs-filter-chip__remove';
const CLEAR_ALL_CLASS = 'gs-filter-chip__clear-all';
const EMPTY_STATE_CLASS = 'gs-filter-empty-state';

const containers = new WeakMap<HTMLTableElement, HTMLDivElement>();
const unsubscribers = new WeakMap<HTMLTableElement, () => void>();

export function mountFilterChip(table: HTMLTableElement): void {
  if (containers.has(table)) return;
  const container = document.createElement('div');
  container.className = CONTAINER_CLASS;
  if (table.parentNode) {
    table.parentNode.insertBefore(container, table.nextSibling);
  }
  containers.set(table, container);
  const unsub = onVisibleRowsChange(table, (seq) => render(table, container, seq));
  unsubscribers.set(table, unsub);
  // Initial render reflects current state (may be empty).
  render(table, container, getVisibleRows(table));
}

export function unmountFilterChip(table: HTMLTableElement): void {
  const unsub = unsubscribers.get(table);
  if (unsub) unsub();
  unsubscribers.delete(table);
  const container = containers.get(table);
  if (container && container.parentNode) container.parentNode.removeChild(container);
  containers.delete(table);
}

function render(
  table: HTMLTableElement,
  container: HTMLDivElement,
  seq: VisibleRowSequence
): void {
  container.textContent = '';
  if (seq.filters.size === 0) return;

  for (const [columnIndex, predicate] of seq.filters) {
    container.appendChild(buildChip(table, columnIndex, predicate));
  }

  const clearAll = document.createElement('button');
  clearAll.type = 'button';
  clearAll.className = CLEAR_ALL_CLASS;
  clearAll.textContent = 'Clear all filters';
  clearAll.addEventListener('click', () => clearFilters(table));
  container.appendChild(clearAll);

  // Zero-match empty state
  const anyVisible = seq.entries.some((e) => e.state === 'visible');
  if (!anyVisible && seq.entries.length > 0) {
    const msg = document.createElement('span');
    msg.className = EMPTY_STATE_CLASS;
    msg.textContent = 'No rows match the current filters.';
    container.appendChild(msg);
  }
}

function buildChip(
  table: HTMLTableElement,
  columnIndex: number,
  predicate: FilterPredicate
): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = CHIP_CLASS;

  const columnName = columnLabel(table, columnIndex, predicate.columnKey);
  const summary = summariseDirective(predicate.toDirective());
  const text = document.createElement('span');
  text.textContent = `${columnName}: ${summary}`;
  chip.appendChild(text);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = CHIP_REMOVE_CLASS;
  remove.setAttribute('aria-label', `Remove ${columnName} filter`);
  remove.textContent = '×';
  remove.addEventListener('click', () => setFilter(table, columnIndex, null));
  chip.appendChild(remove);

  return chip;
}

function columnLabel(table: HTMLTableElement, columnIndex: number, fallback: string): string {
  const headerRow = table.rows[0];
  const cell = headerRow?.cells[columnIndex];
  const text = cell?.textContent?.trim();
  return text || fallback || `Column ${columnIndex + 1}`;
}

function summariseDirective(d: FilterDirective): string {
  if (d.kind === 'numeric-range') {
    const min = d.min === null ? '−∞' : String(d.min);
    const max = d.max === null ? '+∞' : String(d.max);
    return `${min} – ${max}${d.hideEmpty ? ' (no empties)' : ''}`;
  }
  if (d.allowed.length === 0) return '(none)';
  if (d.allowed.length <= 3) return d.allowed.map((v) => v || '(empty)').join(', ');
  return `${d.allowed.length} values`;
}
