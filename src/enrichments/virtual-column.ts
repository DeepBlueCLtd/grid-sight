/**
 * Virtual column scaffold (spec 012-virtual-columns).
 * Single owner of right-edge DOM append/detach, canonical ordering, renderer
 * registry, URL persistence, copy-as-CSV registration, and pipeline fan-out.
 *
 * See specs/012-virtual-columns/research.md §R-1..R-12.
 */

import type {
  AppendedColumnRecord,
  Renderer,
  VirtualColumnDirective,
  VirtualColumnKind,
  VisibleRowEntry,
} from '../types/virtual-column';
import { sortCanonical } from './virtual-column-registry';
import {
  getVisibleRows,
  type VisibleRowSubscription,
} from '../utils/visible-rows';
import {
  registerVirtualColumnForCopy,
  unregisterVirtualColumnForCopy,
} from '../utils/copy-as-csv-registry';
import {
  readFromHash,
  writeHash,
  slugifyColumnKey,
  type PersistedToken,
  type PersistedVirtualColumnState,
} from './virtual-column-persistence';
import { extractTableData, detectColumnTypes } from '../core/type-detection';

interface TableContext {
  tableEl: HTMLTableElement;
  tableKey: string;
  directives: VirtualColumnDirective[];
  records: Map<string, AppendedColumnRecord>;
  numericColumns: Set<string>;
  columnKeys: string[]; // slug per source column index
  subscription: VisibleRowSubscription | null;
  unsubscribe: (() => void) | null;
}

const renderers = new Map<VirtualColumnKind, Renderer<VirtualColumnDirective>>();
const tableContexts = new WeakMap<HTMLTableElement, TableContext>();

let persistEnabled = true;
let urlParam = 'gs.vc'; // (overridable in future; currently informational)
void urlParam;

let activationCounter = 0;
let pendingFrame: number | null = null;
const pendingTables = new Set<HTMLTableElement>();

export function registerRenderer<D extends VirtualColumnDirective>(
  renderer: Renderer<D>,
): void {
  renderers.set(renderer.kind, renderer as unknown as Renderer<VirtualColumnDirective>);
}

/** For host pages or third-party builds. */
export const registerVirtualColumn = registerRenderer;

function deriveTableKey(table: HTMLTableElement): string {
  if (table.id) return table.id;
  // Fallback: derive from header text hash. Keep simple/short.
  const head = table.tHead?.rows[0];
  const headers = head ? Array.from(head.cells).map((c) => c.textContent?.trim() || '') : [];
  let hash = 0;
  const s = headers.join('|');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return `t-${(hash >>> 0).toString(36)}`;
}

function buildColumnKeys(table: HTMLTableElement): string[] {
  const head = table.tHead?.rows[0];
  if (!head) return [];
  const seen = new Map<string, number>();
  const keys: string[] = [];
  Array.from(head.cells).forEach((cell) => {
    const slug = slugifyColumnKey(cell.textContent || '') || 'col';
    const n = seen.get(slug) ?? 0;
    seen.set(slug, n + 1);
    keys.push(n === 0 ? slug : `${slug}-${n + 1}`);
  });
  return keys;
}

function detectNumericColumns(table: HTMLTableElement, columnKeys: string[]): Set<string> {
  const data = extractTableData(table);
  // Drop header row for detection
  const body = data.slice(1);
  const types = detectColumnTypes(body);
  const numeric = new Set<string>();
  for (let i = 0; i < columnKeys.length; i++) {
    if (types[i] === 'numeric') numeric.add(columnKeys[i]);
  }
  return numeric;
}

export function getColumnKeys(table: HTMLTableElement): string[] {
  const ctx = ensureContext(table);
  return [...ctx.columnKeys];
}

export function getNumericColumns(table: HTMLTableElement): ReadonlySet<string> {
  const ctx = ensureContext(table);
  return ctx.numericColumns;
}

export function getSourceColumnIndex(table: HTMLTableElement, colKey: string): number {
  const ctx = ensureContext(table);
  return ctx.columnKeys.indexOf(colKey);
}

const hostTables = new Set<HTMLTableElement>();

function ensureContext(table: HTMLTableElement): TableContext {
  let ctx = tableContexts.get(table);
  if (!ctx) {
    const columnKeys = buildColumnKeys(table);
    ctx = {
      tableEl: table,
      tableKey: deriveTableKey(table),
      directives: [],
      records: new Map(),
      numericColumns: detectNumericColumns(table, columnKeys),
      columnKeys,
      subscription: null,
      unsubscribe: null,
    };
    tableContexts.set(table, ctx);
  }
  hostTables.add(table);
  return ctx;
}

function ensureSubscription(ctx: TableContext): void {
  if (ctx.subscription) return;
  ctx.subscription = getVisibleRows(ctx.tableEl);
  ctx.unsubscribe = ctx.subscription.subscribe((entries) => {
    schedulePipelineFanout(ctx.tableEl, entries);
  });
}

function teardownSubscription(ctx: TableContext): void {
  if (ctx.unsubscribe) {
    ctx.unsubscribe();
    ctx.unsubscribe = null;
  }
  ctx.subscription = null;
}

function schedulePipelineFanout(table: HTMLTableElement, _entries: VisibleRowEntry[]): void {
  pendingTables.add(table);
  if (pendingFrame !== null) return;
  pendingFrame = (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number)(() => {
    pendingFrame = null;
    const tables = Array.from(pendingTables);
    pendingTables.clear();
    for (const t of tables) {
      const ctx = tableContexts.get(t);
      if (!ctx || !ctx.subscription) continue;
      const seq = ctx.subscription.current();
      fanoutPipelineChange(ctx, seq);
    }
  });
}

function fanoutPipelineChange(ctx: TableContext, sequence: VisibleRowEntry[]): void {
  for (const directive of ctx.directives) {
    const renderer = renderers.get(directive.kind);
    if (!renderer) continue;
    const record = ctx.records.get(directive.id);
    if (!record) continue;
    try {
      renderer.onPipelineChange(directive, record, sequence);
    } catch (err) {
      console.error('virtual-column onPipelineChange error', err);
    }
  }
}

/** Test-only: run any pending rAF callback synchronously. */
export function __flushVirtualColumnFrame(): void {
  if (pendingFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
  }
  const tables = Array.from(pendingTables);
  pendingTables.clear();
  for (const t of tables) {
    const ctx = tableContexts.get(t);
    if (!ctx || !ctx.subscription) continue;
    fanoutPipelineChange(ctx, ctx.subscription.current());
  }
}

function computeInsertionPosition(ctx: TableContext, directive: VirtualColumnDirective): number {
  // Position is the count of directives that sort before the given one in canonical order.
  const sorted = sortCanonical([...ctx.directives, directive]);
  return sorted.indexOf(directive);
}

function appendCellsForDirective(
  ctx: TableContext,
  directive: VirtualColumnDirective,
  renderer: Renderer<VirtualColumnDirective>,
): AppendedColumnRecord {
  const table = ctx.tableEl;
  const positionFromRightEnd = ctx.directives.length - computeInsertionPosition(ctx, directive);
  // We append from the rightmost source column; subsequent directives' positions get pushed right.
  // For simplicity, we treat appending: insert at index = sourceColCount + canonicalIndex.
  const sourceCount = ctx.columnKeys.length;
  const canonicalIdx = computeInsertionPosition(ctx, directive);
  const insertBeforeIdx = sourceCount + canonicalIdx;
  void positionFromRightEnd;

  const headerCells: HTMLTableCellElement[] = [];
  const bodyCells = new Map<HTMLTableRowElement, HTMLTableCellElement>();
  const footerCells: HTMLTableCellElement[] = [];

  // Header
  const thead = table.tHead;
  if (thead) {
    for (let i = 0; i < thead.rows.length; i++) {
      const row = thead.rows[i];
      const th = document.createElement('th');
      th.setAttribute('scope', 'col');
      th.setAttribute('data-gs-virtual-column', directive.kind);
      th.setAttribute('data-gs-virtual-column-id', directive.id);
      // Only put header text on the first header row; spacer cells on others.
      if (i === 0) {
        th.textContent = renderer.headerText(directive);
      }
      insertCellAt(row, th, insertBeforeIdx);
      headerCells.push(th);
    }
  }

  // Body
  const tbody = table.tBodies[0];
  if (tbody) {
    const subscription = getVisibleRows(table);
    const sequence = subscription.current();
    for (let i = 0; i < tbody.rows.length; i++) {
      const row = tbody.rows[i];
      const td = document.createElement('td');
      td.setAttribute('data-gs-virtual-column', directive.kind);
      td.setAttribute('data-gs-virtual-column-id', directive.id);
      insertCellAt(row, td, insertBeforeIdx);
      bodyCells.set(row, td);
      // Find rowIndex in sequence
      const seqIdx = sequence.findIndex((e) => e.rowEl === row);
      try {
        renderer.renderCell(directive, td, row, sequence, seqIdx >= 0 ? seqIdx : i);
      } catch (err) {
        console.error('virtual-column renderCell error', err);
      }
    }
  }

  // Footer
  const tfoot = table.tFoot;
  if (tfoot) {
    for (let i = 0; i < tfoot.rows.length; i++) {
      const row = tfoot.rows[i];
      const td = document.createElement('td');
      td.setAttribute('data-gs-virtual-column', directive.kind);
      td.setAttribute('data-gs-virtual-column-id', directive.id);
      insertCellAt(row, td, insertBeforeIdx);
      footerCells.push(td);
    }
  }

  return {
    directiveId: directive.id,
    headerCells,
    bodyCells,
    footerCells,
    position: canonicalIdx,
  };
}

function insertCellAt(
  row: HTMLTableRowElement,
  cell: HTMLTableCellElement,
  index: number,
): void {
  if (index >= row.cells.length) {
    row.appendChild(cell);
  } else {
    row.insertBefore(cell, row.cells[index]);
  }
}

function detachRecord(record: AppendedColumnRecord): void {
  // Reverse insertion order: footer → body → header
  for (let i = record.footerCells.length - 1; i >= 0; i--) {
    record.footerCells[i].remove();
  }
  for (const cell of record.bodyCells.values()) {
    cell.remove();
  }
  for (let i = record.headerCells.length - 1; i >= 0; i--) {
    record.headerCells[i].remove();
  }
}

function cardinalityViolation(ctx: TableContext, directive: VirtualColumnDirective): boolean {
  if (directive.kind === 'sparkline') {
    return ctx.directives.some((d) => d.kind === 'sparkline');
  }
  if (directive.kind === 'compare') {
    return ctx.directives.some((d) => d.kind === 'compare');
  }
  // cumulative: 0..N but unique per colKey
  if (directive.kind === 'cumulative') {
    return ctx.directives.some(
      (d) => d.kind === 'cumulative' && d.sourceColKey === directive.sourceColKey,
    );
  }
  return false;
}

export function activateDirective(
  directive: VirtualColumnDirective,
): AppendedColumnRecord | null {
  const table = directive.tableEl;
  if (table.hasAttribute('data-gs-ignore')) return null;

  const ctx = ensureContext(table);
  const renderer = renderers.get(directive.kind);
  if (!renderer) return null;

  if (cardinalityViolation(ctx, directive)) return null;

  if (renderer.canActivate && !renderer.canActivate(directive, table, ctx.numericColumns)) {
    return null;
  }

  if (directive.kind === 'cumulative' && directive.activationIndex === 0) {
    directive.activationIndex = ++activationCounter;
  }

  ctx.directives.push(directive);
  ctx.directives = sortCanonical(ctx.directives);

  const record = appendCellsForDirective(ctx, directive, renderer);
  ctx.records.set(directive.id, record);

  // Copy-as-CSV registration
  try {
    registerVirtualColumnForCopy(table, directive.id, renderer.exporter(directive));
  } catch (err) {
    console.error('virtual-column exporter error', err);
  }

  ensureSubscription(ctx);
  persistAll();
  return record;
}

export function mutateDirective(
  directiveId: string,
  patch: Partial<VirtualColumnDirective>,
): void {
  // Find owning context
  for (const directive of allDirectives()) {
    if (directive.id !== directiveId) continue;
    Object.assign(directive, patch);
    const table = directive.tableEl;
    const ctx = ensureContext(table);
    const renderer = renderers.get(directive.kind);
    const record = ctx.records.get(directiveId);
    if (!renderer || !record) return;

    // Re-render header text and per-row body
    if (record.headerCells[0]) {
      record.headerCells[0].textContent = renderer.headerText(directive);
    }
    const subscription = getVisibleRows(table);
    const sequence = subscription.current();
    let i = 0;
    for (const [rowEl, td] of record.bodyCells) {
      // Clear cell content before re-render
      while (td.firstChild) td.removeChild(td.firstChild);
      td.removeAttribute('aria-label');
      td.className = '';
      const seqIdx = sequence.findIndex((e) => e.rowEl === rowEl);
      try {
        renderer.renderCell(directive, td, rowEl, sequence, seqIdx >= 0 ? seqIdx : i);
      } catch (err) {
        console.error('virtual-column renderCell error', err);
      }
      i++;
    }
    // Update exporter
    try {
      registerVirtualColumnForCopy(table, directive.id, renderer.exporter(directive));
    } catch {
      /* ignore */
    }
    persistAll();
    return;
  }
}

export function removeDirective(directiveId: string): void {
  for (const directive of allDirectives()) {
    if (directive.id !== directiveId) continue;
    const table = directive.tableEl;
    const ctx = ensureContext(table);
    const renderer = renderers.get(directive.kind);
    const record = ctx.records.get(directiveId);
    if (record) {
      if (renderer?.onDetach) {
        try {
          renderer.onDetach(directive, record);
        } catch (err) {
          console.error('virtual-column onDetach error', err);
        }
      }
      detachRecord(record);
      ctx.records.delete(directiveId);
    }
    ctx.directives = ctx.directives.filter((d) => d.id !== directiveId);
    unregisterVirtualColumnForCopy(table, directiveId);
    if (ctx.directives.length === 0) {
      teardownSubscription(ctx);
    }
    persistAll();
    return;
  }
}

function* allDirectives(): IterableIterator<VirtualColumnDirective> {
  // Iterate all known table contexts. WeakMap can't be iterated; we keep a set of host tables instead.
  for (const table of hostTables) {
    const ctx = tableContexts.get(table);
    if (!ctx) continue;
    for (const d of ctx.directives) yield d;
  }
}

/** Internal accessor used by lozenge modules / tests. */
export function _internalGetContext(table: HTMLTableElement): TableContext {
  return ensureContext(table);
}

/** Detach every appended cell across all tracked tables. Used by GridSight.disable. */
export function detachAll(): void {
  for (const table of Array.from(hostTables)) {
    const ctx = tableContexts.get(table);
    if (!ctx) continue;
    // Remove in reverse order
    const ids = ctx.directives.map((d) => d.id).reverse();
    for (const id of ids) {
      const directive = ctx.directives.find((d) => d.id === id);
      const renderer = directive ? renderers.get(directive.kind) : null;
      const record = ctx.records.get(id);
      if (record) {
        if (directive && renderer?.onDetach) {
          try {
            renderer.onDetach(directive, record);
          } catch {
            /* ignore */
          }
        }
        detachRecord(record);
        ctx.records.delete(id);
      }
      unregisterVirtualColumnForCopy(table, id);
    }
    ctx.directives = [];
    teardownSubscription(ctx);
  }
  // Note: URL state is left intact (FR-VC-012).
}

/** Build the persisted state across every tracked table. */
function buildPersistedState(): PersistedVirtualColumnState {
  const blocks: PersistedVirtualColumnState['blocks'] = [];
  for (const table of hostTables) {
    const ctx = tableContexts.get(table);
    if (!ctx || ctx.directives.length === 0) continue;
    const tokens: PersistedToken[] = [];
    for (const directive of ctx.directives) {
      if (directive.kind === 'cumulative') {
        tokens.push({ kind: 'cumulative', colKey: directive.sourceColKey, mode: directive.mode });
      } else if (directive.kind === 'compare') {
        tokens.push({
          kind: 'compare',
          colKeyA: directive.colKeyA,
          colKeyB: directive.colKeyB,
          mode: directive.mode,
        });
      } else if (directive.kind === 'sparkline') {
        tokens.push({ kind: 'sparkline', scale: directive.scale });
      }
    }
    blocks.push({ tableKey: ctx.tableKey, tokens });
  }
  return { blocks };
}

function persistAll(): void {
  if (!persistEnabled) return;
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  try {
    const state = buildPersistedState();
    const newHash = writeHash(state);
    if (newHash !== location.hash) {
      history.replaceState(null, '', `${location.pathname}${location.search}${newHash}`);
    }
  } catch (err) {
    console.error('virtual-column persist error', err);
  }
}

export function setPersistOptions(opts: { enabled?: boolean; urlParam?: string }): void {
  if (opts.enabled !== undefined) persistEnabled = opts.enabled;
  if (opts.urlParam !== undefined) urlParam = opts.urlParam;
}

/** Restore directives from the URL fragment. Should be called once after init. */
export function restoreFromUrl(tables: HTMLTableElement[]): void {
  if (typeof location === 'undefined') return;
  const state = readFromHash(location.hash);
  if (!state.blocks.length) return;

  const tableByKey = new Map<string, HTMLTableElement>();
  for (const t of tables) {
    const ctx = ensureContext(t);
    tableByKey.set(ctx.tableKey, t);
  }

  const runFrame = (cb: () => void) => {
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(cb);
    else setTimeout(cb, 0);
  };

  runFrame(() => {
    for (const block of state.blocks) {
      const table = tableByKey.get(block.tableKey);
      if (!table) continue;
      const ctx = ensureContext(table);
      for (const token of block.tokens) {
        if (token.kind === 'cumulative') {
          if (!ctx.numericColumns.has(token.colKey)) continue;
          activateDirective({
            id: `cum-${token.colKey}`,
            kind: 'cumulative',
            tableEl: table,
            sourceColKey: token.colKey,
            mode: token.mode,
            activationIndex: 0,
          });
        } else if (token.kind === 'compare') {
          if (!ctx.numericColumns.has(token.colKeyA) || !ctx.numericColumns.has(token.colKeyB)) continue;
          activateDirective({
            id: `cmp-${token.colKeyA}-${token.colKeyB}`,
            kind: 'compare',
            tableEl: table,
            colKeyA: token.colKeyA,
            colKeyB: token.colKeyB,
            mode: token.mode,
          });
        } else if (token.kind === 'sparkline') {
          activateDirective({
            id: 'spark',
            kind: 'sparkline',
            tableEl: table,
            scale: token.scale,
            style: 'bar',
          });
        }
      }
    }
  });
}

/** List active directives on a table in canonical order. */
export function listDirectives(
  table: HTMLTableElement,
): ReadonlyArray<{ id: string; kind: VirtualColumnKind; mode?: string }> {
  const ctx = tableContexts.get(table);
  if (!ctx) return [];
  return ctx.directives.map((d) => {
    if (d.kind === 'cumulative') return { id: d.id, kind: d.kind, mode: d.mode };
    if (d.kind === 'compare') return { id: d.id, kind: d.kind, mode: d.mode };
    return { id: d.id, kind: d.kind };
  });
}

export function removeAllDirectivesOnTable(table: HTMLTableElement): void {
  const ctx = tableContexts.get(table);
  if (!ctx) return;
  const ids = ctx.directives.map((d) => d.id);
  for (const id of ids) removeDirective(id);
}

/** Expose for tests; tree-shakable in production. */
if (typeof globalThis !== 'undefined' && (import.meta as { env?: { MODE?: string } }).env?.MODE !== 'production') {
  (globalThis as Record<string, unknown>).__gridSightFlushVirtualColumnFrame = __flushVirtualColumnFrame;
}

export { encodeFragment, slugifyColumnKey } from './virtual-column-persistence';
