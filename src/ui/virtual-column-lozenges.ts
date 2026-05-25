/**
 * Virtual-column affordances (spec 012-virtual-columns) as enrichment
 * descriptors. Each of the three virtual columns registers a descriptor whose
 * `mount(ctx)` returns its lozenge for the matching header context:
 *
 *   - cumulative (Σ) — one per numeric column header
 *   - sparkline (⌇)  — corner cluster (table header), needs ≥ 3 numeric cols
 *   - compare (Δ)    — corner cluster (table header), needs ≥ 2 numeric cols
 *
 * The generic injection pass (`mountEnrichments` in header-utils) places the
 * returned element into the same lozenge cluster as the classic lozenges and
 * gates it by the effective enabled set — so virtual columns are no longer a
 * parallel, ungated injection path. See docs/architecture/enrichments.md.
 */

import {
  activateDirective,
  mutateDirective,
  removeDirective,
  getColumnKeys,
  getNumericColumns,
  _internalGetContext,
} from '../enrichments/virtual-column';
import type {
  CompareDirective,
  CumulativeDirective,
  SparklineDirective,
} from '../types/virtual-column';
import { openComparePicker } from './compare-picker';
import {
  registerEnrichment,
  type AffordanceContext,
} from '../core/enrichment-registry';

function makeLozenge(glyph: string, label: string, kind: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gs-vc-lozenge';
  btn.textContent = glyph;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', 'false');
  btn.dataset.gsVcKind = kind;
  return btn;
}

function activeDirectiveMode(table: HTMLTableElement, directiveId: string): string | null {
  const ctx = _internalGetContext(table);
  const d = ctx.directives.find((x) => x.id === directiveId);
  if (!d) return null;
  if (d.kind === 'cumulative' || d.kind === 'compare') return d.mode;
  return 'on';
}

/* ── Cumulative (Σ) ──────────────────────────────────────────────────── */

function mountCumulative(ctx: AffordanceContext): HTMLButtonElement | null {
  const { table, colIndex } = ctx;
  const colKey = getColumnKeys(table)[colIndex];
  if (!colKey) return null;
  const directiveId = `cum-${colKey}`;
  const sigma = makeLozenge(
    'Σ',
    `Toggle cumulative for ${ctx.header.textContent?.trim() || colKey}`,
    'cumulative',
  );

  // Initialise state from any directive already active (survives cluster
  // rebuilds triggered by the toggle panel or the GS toggle).
  let mode: 'sum' | 'percent' | null =
    (activeDirectiveMode(table, directiveId) as 'sum' | 'percent' | null) ?? null;
  if (mode) sigma.setAttribute('aria-pressed', 'true');

  sigma.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (mode === null) {
      const directive: CumulativeDirective = {
        id: directiveId,
        kind: 'cumulative',
        tableEl: table,
        sourceColKey: colKey,
        mode: 'sum',
        activationIndex: 0,
      };
      if (!activateDirective(directive)) return;
      mode = 'sum';
      sigma.setAttribute('aria-pressed', 'true');
    } else if (mode === 'sum') {
      mode = 'percent';
      mutateDirective(directiveId, { mode: 'percent' } as Partial<CumulativeDirective>);
    } else {
      mode = null;
      removeDirective(directiveId);
      sigma.setAttribute('aria-pressed', 'false');
    }
  });
  return sigma;
}

registerEnrichment({
  id: 'cumulative',
  appliesTo: (ctx) =>
    ctx.headerType === 'column' &&
    ctx.columnType === 'numeric' &&
    !ctx.table.hasAttribute('data-gs-no-cumulative') &&
    getNumericColumns(ctx.table).has(getColumnKeys(ctx.table)[ctx.colIndex]),
  mount: mountCumulative,
  isActive: (ctx) =>
    activeDirectiveMode(ctx.table, `cum-${getColumnKeys(ctx.table)[ctx.colIndex]}`) !== null,
});

/* ── Sparkline (⌇) ───────────────────────────────────────────────────── */

function mountSparkline(ctx: AffordanceContext): HTMLButtonElement | null {
  const { table } = ctx;
  const lozenge = makeLozenge('⌇', 'Toggle trend column', 'sparkline');
  let active = activeDirectiveMode(table, 'spark') !== null;
  if (active) lozenge.setAttribute('aria-pressed', 'true');

  lozenge.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!active) {
      const directive: SparklineDirective = {
        id: 'spark',
        kind: 'sparkline',
        tableEl: table,
        scale: 'per-row',
        style: 'bar',
      };
      if (!activateDirective(directive)) return;
      active = true;
      lozenge.setAttribute('aria-pressed', 'true');
    } else {
      removeDirective('spark');
      active = false;
      lozenge.setAttribute('aria-pressed', 'false');
    }
  });
  return lozenge;
}

registerEnrichment({
  id: 'sparkline',
  appliesTo: (ctx) =>
    ctx.headerType === 'table' &&
    !ctx.table.hasAttribute('data-gs-no-sparkline') &&
    getNumericColumns(ctx.table).size >= 3,
  mount: mountSparkline,
  isActive: (ctx) => activeDirectiveMode(ctx.table, 'spark') !== null,
});

/* ── Compare (Δ) ─────────────────────────────────────────────────────── */

function mountCompare(ctx: AffordanceContext): HTMLButtonElement | null {
  const { table } = ctx;
  const lozenge = makeLozenge('Δ', 'Toggle column compare', 'compare');

  // Recover an active compare directive's id/mode after a rebuild.
  const existing = _internalGetContext(table).directives.find((d) => d.kind === 'compare');
  let activeId: string | null = existing ? existing.id : null;
  let mode: 'abs' | 'rel' | 'percent' =
    existing && existing.kind === 'compare' ? existing.mode : 'abs';
  if (activeId) lozenge.setAttribute('aria-pressed', 'true');

  lozenge.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    if (activeId) {
      if (mode === 'abs') {
        mode = 'rel';
        mutateDirective(activeId, { mode } as Partial<CompareDirective>);
      } else if (mode === 'rel') {
        mode = 'percent';
        mutateDirective(activeId, { mode } as Partial<CompareDirective>);
      } else {
        removeDirective(activeId);
        activeId = null;
        mode = 'abs';
        lozenge.setAttribute('aria-pressed', 'false');
      }
      return;
    }
    const picked = await openComparePicker(table);
    if (!picked) return;
    const directive: CompareDirective = {
      id: `cmp-${picked.colKeyA}-${picked.colKeyB}`,
      kind: 'compare',
      tableEl: table,
      colKeyA: picked.colKeyA,
      colKeyB: picked.colKeyB,
      mode: 'abs',
    };
    if (!activateDirective(directive)) return;
    activeId = directive.id;
    mode = 'abs';
    lozenge.setAttribute('aria-pressed', 'true');
  });
  return lozenge;
}

registerEnrichment({
  id: 'diff-compare',
  appliesTo: (ctx) =>
    ctx.headerType === 'table' &&
    !ctx.table.hasAttribute('data-gs-no-compare') &&
    getNumericColumns(ctx.table).size >= 2,
  mount: mountCompare,
  isActive: (ctx) =>
    _internalGetContext(ctx.table).directives.some((d) => d.kind === 'compare'),
});
