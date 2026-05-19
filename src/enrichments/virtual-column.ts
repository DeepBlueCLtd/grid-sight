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

function requestFrame(cb: FrameRequestCallback): number {
  if (typeof requestAnimationFrame !== 'undefined') return requestAnimationFrame(cb);
  return setTimeout(() => cb(0), 0) as unknown as number;
}

function drainPendingFanout(): void {
  pendingFrame = null;
  const tables = Array.from(pendingTables);
  pendingTables.clear();
  for (const t of tables) {
    const ctx = tableContexts.get(t);
    if (!ctx || !ctx.subscription) continue;
    fanoutPipelineChange(ctx, ctx.subscription.current());
  }
}

function schedulePipelineFanout(table: HTMLTableElement, _entries: VisibleRowEntry[]): void {
  pendingTables.add(table);
  if (pendingFrame !== null) return;
  pendingFrame = requestFrame(drainPendingFanout);
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
  }
  drainPendingFanout();
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

function canActivate(
  ctx: TableContext,
  directive: VirtualColumnDirective,
  renderer: Renderer<VirtualColumnDirective>,
): boolean {
  if (cardinalityViolation(ctx, directive)) return false;
  if (renderer.canActivate && !renderer.canActivate(directive, ctx.tableEl, ctx.numericColumns)) return false;
  return true;
}

function assignActivationIndex(directive: VirtualColumnDirective): void {
  if (directive.kind === 'cumulative' && directive.activationIndex === 0) {
    directive.activationIndex = ++activationCounter;
  }
}

export function activateDirective(
  directive: VirtualColumnDirective,
): AppendedColumnRecord | null {
  const table = directive.tableEl;
  if (table.hasAttribute('data-gs-ignore')) return null;
  const ctx = ensureContext(table);
  const renderer = renderers.get(directive.kind);
  if (!renderer || !canActivate(ctx, directive, renderer)) return null;

  assignActivationIndex(directive);
  ctx.directives = sortCanonical([...ctx.directives, directive]);
  const record = appendCellsForDirective(ctx, directive, renderer);
  ctx.records.set(directive.id, record);
  safeRegisterExporter(table, renderer, directive);
  ensureSubscription(ctx);
  persistAll();
  return record;
}

function resetCellForRender(td: HTMLTableCellElement): void {
  while (td.firstChild) td.removeChild(td.firstChild);
  td.removeAttribute('aria-label');
  td.className = '';
}

function safeRenderCell(
  renderer: Renderer<VirtualColumnDirective>,
  directive: VirtualColumnDirective,
  td: HTMLTableCellElement,
  rowEl: HTMLTableRowElement,
  sequence: VisibleRowEntry[],
  rowIndex: number,
): void {
  try {
    renderer.renderCell(directive, td, rowEl, sequence, rowIndex);
  } catch (err) {
    console.error('virtual-column renderCell error', err);
  }
}

function rerenderRecord(
  renderer: Renderer<VirtualColumnDirective>,
  directive: VirtualColumnDirective,
  record: AppendedColumnRecord,
  sequence: VisibleRowEntry[],
): void {
  if (record.headerCells[0]) {
    record.headerCells[0].textContent = renderer.headerText(directive);
  }
  let i = 0;
  for (const [rowEl, td] of record.bodyCells) {
    resetCellForRender(td);
    const seqIdx = sequence.findIndex((e) => e.rowEl === rowEl);
    safeRenderCell(renderer, directive, td, rowEl, sequence, seqIdx >= 0 ? seqIdx : i);
    i++;
  }
}

function safeRegisterExporter(
  table: HTMLTableElement,
  renderer: Renderer<VirtualColumnDirective>,
  directive: VirtualColumnDirective,
): void {
  try {
    registerVirtualColumnForCopy(table, directive.id, renderer.exporter(directive));
  } catch (err) {
    console.error('virtual-column exporter error', err);
  }
}

export function mutateDirective(
  directiveId: string,
  patch: Partial<VirtualColumnDirective>,
): void {
  for (const directive of allDirectives()) {
    if (directive.id !== directiveId) continue;
    Object.assign(directive, patch);
    const table = directive.tableEl;
    const ctx = ensureContext(table);
    const renderer = renderers.get(directive.kind);
    const record = ctx.records.get(directiveId);
    if (!renderer || !record) return;

    rerenderRecord(renderer, directive, record, getVisibleRows(table).current());
    safeRegisterExporter(table, renderer, directive);
    persistAll();
    return;
  }
}

function safeOnDetach(
  renderer: Renderer<VirtualColumnDirective> | undefined,
  directive: VirtualColumnDirective,
  record: AppendedColumnRecord,
): void {
  if (!renderer?.onDetach) return;
  try {
    renderer.onDetach(directive, record);
  } catch (err) {
    console.error('virtual-column onDetach error', err);
  }
}

function detachDirectiveFromContext(
  ctx: TableContext,
  directive: VirtualColumnDirective,
): void {
  const renderer = renderers.get(directive.kind);
  const record = ctx.records.get(directive.id);
  if (record) {
    safeOnDetach(renderer, directive, record);
    detachRecord(record);
    ctx.records.delete(directive.id);
  }
  unregisterVirtualColumnForCopy(ctx.tableEl, directive.id);
}

export function removeDirective(directiveId: string): void {
  for (const directive of allDirectives()) {
    if (directive.id !== directiveId) continue;
    const ctx = ensureContext(directive.tableEl);
    detachDirectiveFromContext(ctx, directive);
    ctx.directives = ctx.directives.filter((d) => d.id !== directiveId);
    if (ctx.directives.length === 0) teardownSubscription(ctx);
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

function detachContext(ctx: TableContext): void {
  // Remove directives in reverse insertion order so renderers tear down
  // their state in the inverse of build order (R-12).
  const directives = [...ctx.directives].reverse();
  for (const directive of directives) detachDirectiveFromContext(ctx, directive);
  ctx.directives = [];
  teardownSubscription(ctx);
}

/** Detach every appended cell across all tracked tables. Used by GridSight.disable.
 *  URL state is left intact (FR-VC-012). */
export function detachAll(): void {
  for (const table of Array.from(hostTables)) {
    const ctx = tableContexts.get(table);
    if (ctx) detachContext(ctx);
  }
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

  requestFrame(() => {
    for (const block of state.blocks) {
      const table = tableByKey.get(block.tableKey);
      if (table) restoreBlock(table, block.tokens);
    }
  });
}

function restoreBlock(table: HTMLTableElement, tokens: ReadonlyArray<PersistedToken>): void {
  const ctx = ensureContext(table);
  for (const token of tokens) restoreToken(ctx, table, token);
}

function restoreToken(
  ctx: TableContext,
  table: HTMLTableElement,
  token: PersistedToken,
): void {
  const numeric = ctx.numericColumns;
  if (token.kind === 'cumulative') {
    if (!numeric.has(token.colKey)) return;
    activateDirective({
      id: `cum-${token.colKey}`,
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: token.colKey,
      mode: token.mode,
      activationIndex: 0,
    });
    return;
  }
  if (token.kind === 'compare') {
    if (!numeric.has(token.colKeyA) || !numeric.has(token.colKeyB)) return;
    activateDirective({
      id: `cmp-${token.colKeyA}-${token.colKeyB}`,
      kind: 'compare',
      tableEl: table,
      colKeyA: token.colKeyA,
      colKeyB: token.colKeyB,
      mode: token.mode,
    });
    return;
  }
  if (token.kind === 'sparkline') {
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: token.scale,
      style: 'bar',
    });
  }
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
