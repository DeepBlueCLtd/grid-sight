/**
 * Runtime visitor toggle panel — opt-in UI that lists every registered
 * enrichment as a checkbox and persists the visitor's choices.
 *
 * Mount path (R-5):
 *   - explicit container argument (from `mountTogglePanel(el)`), OR
 *   - first `[data-gs-toggle-panel]` element in the document, OR
 *   - fallback: `<body>` (docked top-right via CSS).
 *
 * Persistence (R-4): URL fragment `#gs.e=...` + `localStorage` key
 * `gs:<url-stem>:enrichments`, sharing `slider-persistence` helpers.
 *
 * Container-resilience guard (R-5 addition): every refresh checks
 * `root.isConnected`; if the host has removed the panel from the document,
 * the panel detaches its listeners and emits one warning.
 *
 * tearDown safety wrap (R-6 addition): each registry tearDown call is
 * wrapped in try/catch so a buggy hook does not stall the toggle.
 */

import { ENRICHMENT_REGISTRY } from '../core/enrichment-registry';
import type { EnrichmentRegistryEntry } from '../core/enrichment-registry';
import {
  getEffectiveEnabledSet,
  setVisitorOverride,
  getVisitorOverride,
} from '../core/enabled-set-state';
import { persistVisitorEnrichments } from '../utils/slider-persistence';
import { injectPlusIcons } from './header-utils';
import { getColumnTypes } from '../core/column-types-cache';
import { analyzeTable } from '../core/table-detection';

const ROOT_ATTR = 'data-gs-toggle-panel-root';
const LABEL_ATTR_PREFIX = 'data-gs-enrichment-toggle';

export interface MountOptions {
  /** Live registry of tables. The panel iterates this on every refresh. */
  tables?: Map<string, HTMLTableElement>;
}

interface PanelState {
  root: HTMLFieldSetElement;
  checkboxes: Map<string, HTMLInputElement>;
  changeListener: (ev: Event) => void;
  tables: Map<string, HTMLTableElement>;
  detached: boolean;
}

let activePanel: PanelState | null = null;
let stylesInjected = false;

export function mountTogglePanel(
  container?: HTMLElement,
  opts: MountOptions = {}
): HTMLFieldSetElement | null {
  if (typeof document === 'undefined') return null;

  // Idempotent — a second mount call returns the existing panel.
  if (activePanel && activePanel.root.isConnected) {
    return activePanel.root;
  }

  ensurePanelStyles();

  const target = resolveContainer(container);
  if (!target) return null;

  const root = document.createElement('fieldset');
  root.setAttribute(ROOT_ATTR, '');
  // Inline positional CSS for the body-fallback case; ignored when the host
  // supplies a container (host CSS owns positioning then).
  if (target === document.body) {
    root.classList.add('gs-toggle-panel--floating');
  }

  const legend = document.createElement('legend');
  legend.textContent = 'Grid-Sight enrichments';
  root.appendChild(legend);

  const enabled = getEffectiveEnabledSet();
  const checkboxes = new Map<string, HTMLInputElement>();

  for (const entry of ENRICHMENT_REGISTRY) {
    const label = document.createElement('label');
    label.setAttribute(`${LABEL_ATTR_PREFIX}`, entry.id);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = enabled.has(entry.id);
    input.value = entry.id;
    checkboxes.set(entry.id, input);

    const hint = document.createElement('span');
    hint.className = 'gs-id-hint';
    hint.textContent = `(${entry.id})`;

    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${entry.label} `));
    label.appendChild(hint);
    root.appendChild(label);
  }

  const tables = opts.tables ?? new Map<string, HTMLTableElement>();

  const state: PanelState = {
    root,
    checkboxes,
    tables,
    detached: false,
    changeListener: (ev: Event) => {
      if (state.detached) return;
      if (!state.root.isConnected) {
        teardownPanel(state);
        console.warn('[gridsight] toggle panel container detached; panel disabled until next init()');
        return;
      }
      const target = ev.target as HTMLInputElement | null;
      if (!target || target.type !== 'checkbox') return;
      onCheckboxChange(state, target.value, target.checked);
    },
  };
  root.addEventListener('change', state.changeListener);

  target.appendChild(root);
  activePanel = state;
  return root;
}

function resolveContainer(container?: HTMLElement): HTMLElement | null {
  if (container) return container;
  const declared = document.querySelector<HTMLElement>('[data-gs-toggle-panel]');
  if (declared) return declared;
  return document.body ?? null;
}

function onCheckboxChange(state: PanelState, id: string, checked: boolean): void {
  // Re-derive visitor override from the current checkbox states (rather than
  // mutating a snapshot) so concurrent ticks settle to the right result.
  const next = new Set<string>();
  for (const [eid, cb] of state.checkboxes) {
    if (cb.checked) next.add(eid);
  }
  // Capture old set BEFORE we update state.
  const before = new Set(getEffectiveEnabledSet());
  setVisitorOverride(next);
  persistVisitorEnrichments(Array.from(next));
  const after = new Set(getEffectiveEnabledSet());

  // tearDown for ids that transitioned ON → OFF (only matters when toggling off).
  if (!checked) {
    void id; // identity captured by diff below
  }
  for (const e of ENRICHMENT_REGISTRY) {
    if (before.has(e.id) && !after.has(e.id) && e.tearDown) {
      for (const table of state.tables.values()) {
        try {
          e.tearDown(table);
        } catch (err) {
          console.warn(`[gridsight] tearDown(${e.id}) threw; continuing`, err);
        }
      }
    }
  }

  // Rebuild lozenges on every registered table using the cached column-types
  // (R-10) where available, falling back to recomputation if cache is empty.
  for (const table of state.tables.values()) {
    let types = getColumnTypes(table);
    if (!types) {
      const rows = Array.from(table.rows).map(row =>
        Array.from(row.cells).map(cell => cell.textContent || '')
      );
      types = analyzeTable(rows).columnTypes;
    }
    // Only rebuild for tables that currently have GS enabled (have lozenges
    // or the master toggle in the active state).
    if (table.classList.contains('grid-sight-enabled')) {
      injectPlusIcons(table, types);
    }
  }
}

function teardownPanel(state: PanelState): void {
  if (state.detached) return;
  state.detached = true;
  state.root.removeEventListener('change', state.changeListener);
  if (activePanel === state) activePanel = null;
}

/** Test/internal hook: refresh checkbox state from current effective set. */
export function refreshTogglePanel(): void {
  if (!activePanel) return;
  if (!activePanel.root.isConnected) {
    teardownPanel(activePanel);
    return;
  }
  const enabled = getEffectiveEnabledSet();
  for (const [id, cb] of activePanel.checkboxes) {
    cb.checked = enabled.has(id);
  }
}

/** Test/internal hook: tear down the active panel (used by test cleanup). */
export function unmountTogglePanel(): void {
  if (!activePanel) return;
  const state = activePanel;
  teardownPanel(state);
  state.root.remove();
}

function ensurePanelStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  if (document.head.querySelector('style[data-gs-toggle-panel-styles]')) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-gs-toggle-panel-styles', '');
  style.textContent = `
    [${ROOT_ATTR}] {
      background: var(--gs-toggle-panel-bg, #fff);
      border: 1px solid var(--gs-toggle-panel-border, #d0d0d0);
      border-radius: 4px;
      padding: 8px 12px;
      font: 13px/1.4 system-ui, sans-serif;
      max-width: 240px;
    }
    [${ROOT_ATTR}] legend { font-weight: 600; padding: 0 4px; }
    [${ROOT_ATTR}] label { display: block; padding: 2px 0; cursor: pointer; }
    [${ROOT_ATTR}] .gs-id-hint { color: #888; font-size: 11px; margin-left: 2px; }
    [${ROOT_ATTR}].gs-toggle-panel--floating {
      position: fixed; top: 12px; right: 12px; z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

// Silence unused-import warning when `EnrichmentRegistryEntry` is only referenced
// in this file's local types.
export type { EnrichmentRegistryEntry };

// Touch — keep getVisitorOverride exported for test convenience (re-export so
// tests can read the persisted state through this module).
export { getVisitorOverride };
