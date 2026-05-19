/**
 * Lozenge factories for virtual columns (spec 012-virtual-columns).
 * Σ on numeric headers (cumulative), ⌇ + Δ in the corner cluster.
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

function findExistingDirective(
  table: HTMLTableElement,
  predicate: (id: string) => boolean,
): string | null {
  const ctx = _internalGetContext(table);
  for (const d of ctx.directives) {
    if (predicate(d.id)) return d.id;
  }
  return null;
}

function makeLozenge(glyph: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gs-vc-lozenge';
  btn.textContent = glyph;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', 'false');
  return btn;
}

export function injectCumulativeLozenges(table: HTMLTableElement): void {
  if (table.hasAttribute('data-gs-ignore')) return;
  if (table.hasAttribute('data-gs-no-cumulative')) return;
  const head = table.tHead?.rows[0];
  if (!head) return;
  const numeric = getNumericColumns(table);
  const columnKeys = getColumnKeys(table);
  Array.from(head.cells).forEach((cell, i) => {
    const colKey = columnKeys[i];
    if (!numeric.has(colKey)) return;
    if (cell.querySelector('.gs-vc-lozenge[data-gs-vc-kind="cumulative"]')) return;
    const sigma = makeLozenge('Σ', `Toggle cumulative for ${cell.textContent?.trim() || colKey}`);
    sigma.dataset.gsVcKind = 'cumulative';

    let mode: 'sum' | 'percent' | null = null;

    sigma.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const directiveId = `cum-${colKey}`;
      const existing = findExistingDirective(table, (id) => id === directiveId);
      if (mode === null && !existing) {
        mode = 'sum';
        const directive: CumulativeDirective = {
          id: directiveId,
          kind: 'cumulative',
          tableEl: table,
          sourceColKey: colKey,
          mode: 'sum',
          activationIndex: 0,
        };
        const r = activateDirective(directive);
        if (!r) { mode = null; return; }
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

    cell.appendChild(sigma);
  });
}

function getCornerCluster(table: HTMLTableElement): HTMLElement | null {
  const head = table.tHead?.rows[0];
  return (head?.cells[0] as HTMLElement) || null;
}

export function injectSparklineLozenge(table: HTMLTableElement): void {
  if (table.hasAttribute('data-gs-ignore')) return;
  if (table.hasAttribute('data-gs-no-sparkline')) return;
  const numeric = getNumericColumns(table);
  if (numeric.size < 3) return;
  const corner = getCornerCluster(table);
  if (!corner) return;
  if (corner.querySelector('.gs-vc-lozenge[data-gs-vc-kind="sparkline"]')) return;
  const lozenge = makeLozenge('⌇', 'Toggle trend column');
  lozenge.dataset.gsVcKind = 'sparkline';

  let active = false;
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
      const r = activateDirective(directive);
      if (!r) return;
      active = true;
      lozenge.setAttribute('aria-pressed', 'true');
    } else {
      removeDirective('spark');
      active = false;
      lozenge.setAttribute('aria-pressed', 'false');
    }
  });

  corner.appendChild(lozenge);
}

export function injectCompareLozenge(table: HTMLTableElement): void {
  if (table.hasAttribute('data-gs-ignore')) return;
  if (table.hasAttribute('data-gs-no-compare')) return;
  const numeric = getNumericColumns(table);
  if (numeric.size < 2) return;
  const corner = getCornerCluster(table);
  if (!corner) return;
  if (corner.querySelector('.gs-vc-lozenge[data-gs-vc-kind="compare"]')) return;
  const lozenge = makeLozenge('Δ', 'Toggle column compare');
  lozenge.dataset.gsVcKind = 'compare';

  let activeId: string | null = null;
  let mode: 'abs' | 'rel' | 'percent' = 'abs';

  lozenge.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    if (activeId) {
      // Cycle mode: abs → rel → percent → off
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
    const r = activateDirective(directive);
    if (!r) return;
    activeId = directive.id;
    mode = 'abs';
    lozenge.setAttribute('aria-pressed', 'true');
  });

  corner.appendChild(lozenge);
}

export function injectAllVirtualColumnLozenges(table: HTMLTableElement): void {
  // Pre-warm context so column keys / numeric detection are cached.
  _internalGetContext(table);
  injectCumulativeLozenges(table);
  injectSparklineLozenge(table);
  injectCompareLozenge(table);
}
