/**
 * Filter predicate factories for numeric-range and categorical filters.
 *
 * The pipeline composes any number of predicates with logical AND.
 * Predicates DIM rows; they never remove them.
 */

import { cleanNumericCell } from '../core/type-detection';
import type { FilterDirective, FilterPredicate } from '../utils/visible-rows';

/* ── Numeric range ──────────────────────────────────────────────────── */

export interface NumericRangeArgs {
  columnIndex: number;
  columnKey: string;
  min: number | null;
  max: number | null;
  hideEmpty: boolean;
}

function readNumericCell(row: HTMLTableRowElement, columnIndex: number): number | null {
  const cell = row.cells[columnIndex];
  if (!cell) return null;
  const raw = (cell.textContent ?? '').trim();
  return raw === '' ? null : cleanNumericCell(raw);
}

function withinRange(v: number, min: number | null, max: number | null): boolean {
  if (min !== null && v < min) return false;
  if (max !== null && v > max) return false;
  return true;
}

export function numericRange(args: NumericRangeArgs): FilterPredicate {
  const { columnIndex, columnKey, min, max, hideEmpty } = args;
  return {
    columnIndex,
    columnKey,
    test(row: HTMLTableRowElement): boolean {
      const v = readNumericCell(row, columnIndex);
      return v === null ? !hideEmpty : withinRange(v, min, max);
    },
    toDirective(): FilterDirective {
      return { kind: 'numeric-range', columnKey, min, max, hideEmpty };
    },
  };
}

/* ── Categorical inclusion ──────────────────────────────────────────── */

export interface CategoricalArgs {
  columnIndex: number;
  columnKey: string;
  allowed: ReadonlySet<string> | readonly string[];
  hideEmpty: boolean;
}

export function categoricalInclusion(args: CategoricalArgs): FilterPredicate {
  const { columnIndex, columnKey, hideEmpty } = args;
  const allowedSet =
    args.allowed instanceof Set
      ? (args.allowed as ReadonlySet<string>)
      : new Set(args.allowed as readonly string[]);
  const allowedArray = Array.from(allowedSet);
  return {
    columnIndex,
    columnKey,
    test(row: HTMLTableRowElement): boolean {
      const cell = row.cells[columnIndex];
      const raw = cell ? (cell.textContent ?? '').trim() : '';
      if (raw === '') return !hideEmpty && allowedSet.has('');
      return allowedSet.has(raw);
    },
    toDirective(): FilterDirective {
      return { kind: 'categorical', columnKey, allowed: allowedArray, hideEmpty };
    },
  };
}

/** Collect distinct values + counts for a given column from the live tbody. */
export function collectCategoricalValues(
  table: HTMLTableElement,
  columnIndex: number
): Map<string, number> {
  const out = new Map<string, number>();
  const tbody = table.tBodies[0];
  if (!tbody) return out;
  for (const row of Array.from(tbody.rows)) {
    const v = (row.cells[columnIndex]?.textContent ?? '').trim();
    out.set(v, (out.get(v) ?? 0) + 1);
  }
  return out;
}

/** Build a predicate from a serialised directive + resolved column index. */
export function predicateFromDirective(
  directive: FilterDirective,
  columnIndex: number
): FilterPredicate | null {
  if (directive.kind === 'numeric-range') {
    return numericRange({
      columnIndex,
      columnKey: directive.columnKey,
      min: directive.min,
      max: directive.max,
      hideEmpty: directive.hideEmpty,
    });
  }
  if (directive.kind === 'categorical') {
    return categoricalInclusion({
      columnIndex,
      columnKey: directive.columnKey,
      allowed: directive.allowed,
      hideEmpty: directive.hideEmpty,
    });
  }
  return null;
}
