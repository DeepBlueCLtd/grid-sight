/**
 * `summary-row` enrichment (spec 014). A per-column aggregate footer
 * (sum / avg / min / max / count) computed over the VISIBLE rows.
 *
 * Auto-rendered (no lozenge): `applySummaryRow` injects one `<tfoot>` row whose
 * cells align to the logical columns and are marked `data-gs-injected`, so the
 * addressing layer and the visible-rows pipeline (which both read `<tbody>`
 * only) never treat the footer as data. It subscribes to `onVisibleRowsChange`
 * to recompute on sort/filter, and persists the per-column aggregate choice
 * under the `gs:` scheme. `removeSummaryRow` unsubscribes and removes the footer
 * for a byte-identical teardown; the registry provides both `apply` and
 * `tearDown` so the toggle-panel off→on round-trip restores it without a reload.
 */

import { headerRow, gridCells, columnCells, cellValue } from '../core/table-grid';
import { cleanNumericCell } from '../core/type-detection';
import { onVisibleRowsChange, visibleBodyRows } from '../utils/visible-rows';
import { storageKeyFor } from '../utils/slider-persistence';
import { formatNumber } from './statistics';
import { mountAggregateControl, ensureSummaryStyles } from '../ui/summary-row-control';

export type Aggregate = 'sum' | 'avg' | 'min' | 'max' | 'count';

const FOOT_ATTR = 'data-gs-injected';
const ROW_CLASS = 'gs-summary-row';
const VALUE_CLASS = 'gs-summary-value';
const LABEL_CLASS = 'gs-summary-label';
const STORAGE_VERSION = 1;

const VALID: ReadonlySet<string> = new Set<Aggregate>(['sum', 'avg', 'min', 'max', 'count']);
function isAggregate(v: unknown): v is Aggregate {
  return typeof v === 'string' && VALID.has(v);
}

interface SummaryState {
  unsub: () => void;
  footRow: HTMLTableRowElement;
  createdTfoot: boolean;
  /** logical column index → chosen aggregate. */
  choices: Map<number, Aggregate>;
}
const states = new WeakMap<HTMLTableElement, SummaryState>();

let storageWarned = false;
/** Test-only reset of the module's warn-once + per-table state flags. */
export function __resetSummaryRow(): void {
  storageWarned = false;
}
function warnStorageOnce(): void {
  if (storageWarned) return;
  storageWarned = true;
  console.warn('[gridsight] summary-row: localStorage unavailable; aggregate choices will not persist.');
}

/* ── Pure aggregation ───────────────────────────────────────────────── */

/** Compute one aggregate over a numeric value list (blanks already excluded by
 *  the caller). `count` returns the list length; the footer's column-level
 *  `count` (non-blank cells) is handled by `summarizeColumn`. */
export function aggregate(values: number[], kind: Aggregate): number {
  if (values.length === 0) return NaN;
  switch (kind) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
  }
}

/** Format one column's footer text for `kind` from its raw visible cell texts.
 *  `count` counts non-blank cells; the numeric aggregates exclude blank /
 *  non-numeric cells and render blank when nothing numeric remains. */
export function summarizeColumn(texts: string[], kind: Aggregate): string {
  if (kind === 'count') {
    return String(texts.filter((t) => t.trim() !== '').length);
  }
  const nums: number[] = [];
  for (const t of texts) {
    const v = cleanNumericCell(t);
    if (v !== null) nums.push(v);
  }
  if (nums.length === 0) return '';
  return formatNumber(aggregate(nums, kind));
}

/* ── Persistence (gs: scheme) ───────────────────────────────────────── */

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function tableKey(table: HTMLTableElement): string {
  const explicit = table.getAttribute('data-gs-key');
  if (explicit) return explicit;
  if (table.id) return table.id;
  const cap = table.querySelector('caption');
  const capText = cap?.textContent?.trim();
  if (capText) return slug(capText) || 'caption';
  if (typeof document !== 'undefined') {
    const all = Array.from(document.querySelectorAll('table'));
    const idx = all.indexOf(table);
    if (idx >= 0) return `idx-${idx}`;
  }
  return 'table';
}

function readChoices(table: HTMLTableElement): Record<number, Aggregate> {
  if (typeof localStorage === 'undefined') {
    warnStorageOnce();
    return {};
  }
  try {
    const raw = localStorage.getItem(storageKeyFor('summary:' + tableKey(table)));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as { version?: unknown }).version !== STORAGE_VERSION ||
      typeof (parsed as { choices?: unknown }).choices !== 'object'
    ) {
      return {}; // malformed → ignored (development-phase posture)
    }
    const out: Record<number, Aggregate> = {};
    for (const [k, v] of Object.entries((parsed as { choices: Record<string, unknown> }).choices)) {
      const idx = Number(k);
      if (Number.isInteger(idx) && idx >= 0 && isAggregate(v)) out[idx] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeChoices(table: HTMLTableElement, choices: Map<number, Aggregate>): void {
  if (typeof localStorage === 'undefined') {
    warnStorageOnce();
    return;
  }
  const obj: Record<string, Aggregate> = {};
  for (const [k, v] of choices) obj[k] = v;
  try {
    localStorage.setItem(
      storageKeyFor('summary:' + tableKey(table)),
      JSON.stringify({ version: STORAGE_VERSION, choices: obj }),
    );
  } catch {
    warnStorageOnce();
  }
}

/* ── Visible rows + column reads ────────────────────────────────────── */

function columnIsNumeric(table: HTMLTableElement, colIndex: number): boolean {
  return columnCells(table, colIndex).some((c) => cleanNumericCell(cellValue(c)) !== null);
}

/** A row-header / identifier column — its body cells are all `<th>` (e.g.
 *  `<th scope="row">`). Such columns hold labels, not data, so the summary row
 *  shows a "Total" caption there rather than (mis-)aggregating them. */
function isRowHeaderColumn(table: HTMLTableElement, colIndex: number): boolean {
  const cells = columnCells(table, colIndex);
  return cells.length > 0 && cells.every((c) => c.tagName === 'TH');
}

function visibleColumnTexts(table: HTMLTableElement, colIndex: number): string[] {
  return visibleBodyRows(table).map((row) => {
    const cell = gridCells(row)[colIndex];
    return cell ? cellValue(cell) : '';
  });
}

/* ── Recompute ──────────────────────────────────────────────────────── */

function recomputeCell(table: HTMLTableElement, colIndex: number): void {
  const st = states.get(table);
  if (!st) return;
  const td = st.footRow.cells[colIndex];
  if (!td) return;
  const valueSpan = td.querySelector<HTMLElement>('.' + VALUE_CLASS);
  if (!valueSpan) return;
  const kind = st.choices.get(colIndex) ?? 'count';
  valueSpan.textContent = summarizeColumn(visibleColumnTexts(table, colIndex), kind);
}

function recomputeAll(table: HTMLTableElement): void {
  const st = states.get(table);
  if (!st) return;
  for (let i = 0; i < st.footRow.cells.length; i++) recomputeCell(table, i);
}

/* ── Lifecycle ──────────────────────────────────────────────────────── */

/** Inject the summary footer, restore persisted choices, subscribe to
 *  visible-rows changes. Idempotent. */
export function applySummaryRow(table: HTMLTableElement): void {
  if (states.has(table)) {
    recomputeAll(table);
    return;
  }
  const header = headerRow(table);
  if (!header) return;
  const colCount = gridCells(header).length;
  if (colCount === 0) return;

  ensureSummaryStyles();
  const persisted = readChoices(table);
  const choices = new Map<number, Aggregate>();

  let tfoot = table.tFoot;
  let createdTfoot = false;
  if (!tfoot) {
    tfoot = document.createElement('tfoot');
    tfoot.setAttribute(FOOT_ATTR, '');
    table.appendChild(tfoot);
    createdTfoot = true;
  }

  const footRow = document.createElement('tr');
  footRow.className = ROW_CLASS;
  footRow.setAttribute(FOOT_ATTR, '');

  for (let i = 0; i < colCount; i++) {
    const td = document.createElement('td');
    td.setAttribute(FOOT_ATTR, '');

    // Identifier columns (row-header <th> cells) are not data — caption them
    // "Total" and never aggregate them (spec 014 review).
    if (isRowHeaderColumn(table, i)) {
      const label = document.createElement('span');
      label.className = LABEL_CLASS;
      label.textContent = 'Total';
      td.appendChild(label);
      footRow.appendChild(td);
      continue;
    }

    const numeric = columnIsNumeric(table, i);
    const def: Aggregate = numeric ? 'sum' : 'count';
    const restored = persisted[i];
    const choice: Aggregate = restored && (numeric || restored === 'count') ? restored : def;
    choices.set(i, choice);

    const valueSpan = document.createElement('span');
    valueSpan.className = VALUE_CLASS;
    td.appendChild(valueSpan);

    const colIndex = i;
    mountAggregateControl(td, choice, numeric, (next) => {
      choices.set(colIndex, next);
      writeChoices(table, choices);
      recomputeCell(table, colIndex);
    });

    footRow.appendChild(td);
  }

  tfoot.appendChild(footRow);
  const unsub = onVisibleRowsChange(table, () => recomputeAll(table));
  states.set(table, { unsub, footRow, createdTfoot, choices });
  recomputeAll(table);
}

/** Unsubscribe + remove the injected footer. Byte-identical teardown. */
export function removeSummaryRow(table: HTMLTableElement): void {
  const st = states.get(table);
  if (!st) {
    // Defensive: clear any stray injected summary row (e.g. double teardown).
    table
      .querySelectorAll<HTMLTableRowElement>(`tr.${ROW_CLASS}[${FOOT_ATTR}]`)
      .forEach((r) => r.remove());
    return;
  }
  try {
    st.unsub();
  } catch {
    /* ignore */
  }
  const tfoot = st.footRow.parentElement;
  st.footRow.remove();
  if (st.createdTfoot && tfoot && tfoot.tagName === 'TFOOT' && tfoot.children.length === 0) {
    tfoot.remove();
  }
  states.delete(table);
}
