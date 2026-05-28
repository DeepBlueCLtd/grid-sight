/**
 * Canonical registry of every enrichment Grid-Sight ships.
 *
 * Adding a new enrichment:
 *   1. Append one entry below. `id` MUST be lower-case hyphen-separated and
 *      unique. `label` is the human-readable string shown in the runtime
 *      toggle panel.
 *   2. When the enrichment first ships (real implementation lands), flip
 *      `shipped` from `false` to `true` AND add its `tearDown(table)` hook.
 *      The runtime toggle panel only renders rows for `shipped: true`
 *      entries, so a spec-only registration is forward-compatible (page
 *      configs can name it today) without surfacing a checkbox a visitor
 *      cannot use yet.
 *   3. `defaultOn` controls whether the enrichment is in the default
 *      enabled set when no pageConfig or visitor override is present.
 *
 * NOTE FOR FUTURE MAINTAINERS: every new enrichment MUST come with its
 * own registry entry in the same PR that ships the implementation. The
 * toggle panel keys off `shipped`; missing or stale flags here cause the
 * panel to either hide a working enrichment or surface a non-functional
 * one.
 */

import { removeHeatmap } from '../enrichments/heatmap';
import { removeAllSliders, getSliders } from '../enrichments/slider';
import { setSort, clearFilters } from '../utils/visible-rows';
import { unmountFilterChip } from '../enrichments/filter-chip';
import { removeDirectivesByKind } from '../enrichments/virtual-column';

export type EnrichmentId = string;

export interface EnrichmentRegistryEntry {
  readonly id: EnrichmentId;
  readonly label: string;
  readonly defaultOn: boolean;
  /**
   * Whether this enrichment has a real implementation in the current
   * build. Spec-only entries (registered for forward-compat) MUST be
   * `false` until the implementation PR flips this to `true`.
   */
  readonly shipped: boolean;
  readonly tearDown?: (table: HTMLTableElement) => void;
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function removeAllHeatmaps(table: HTMLTableElement): void {
  removeHeatmap(table);
}

function removeAllAxisSliders(table: HTMLTableElement): void {
  removeAllSliders(table);
}

function removeThresholdSliders(table: HTMLTableElement): void {
  for (const s of getSliders(table)) {
    if (s.kind === 'threshold') s.destroy();
  }
}

function dismissStatisticsPopup(_table: HTMLTableElement): void {
  const w = window as Window & { _gsStatisticsPopup?: { hide?: () => void } };
  w._gsStatisticsPopup?.hide?.();
}

function dismissFrequencyDialog(_table: HTMLTableElement): void {
  const w = window as Window & { _gsFrequencyDialog?: { hide?: () => void } };
  w._gsFrequencyDialog?.hide?.();
}

function dismissFrequencyChartDialog(_table: HTMLTableElement): void {
  const w = window as Window & { _gsFrequencyChartDialog?: { hide?: () => void } };
  w._gsFrequencyChartDialog?.hide?.();
}

function clearTableSort(table: HTMLTableElement): void {
  setSort(table, null);
}

function clearTableFilters(table: HTMLTableElement): void {
  clearFilters(table);
  unmountFilterChip(table);
}

function removeCumulativeColumns(table: HTMLTableElement): void {
  removeDirectivesByKind(table, 'cumulative');
}

function removeSparklineColumns(table: HTMLTableElement): void {
  removeDirectivesByKind(table, 'sparkline');
}

function removeCompareColumns(table: HTMLTableElement): void {
  removeDirectivesByKind(table, 'compare');
}

const ENTRIES: EnrichmentRegistryEntry[] = [
  // ── Shipped enrichments (real implementation in this build) ──────────
  { id: 'heatmap',          label: 'Heatmap',           defaultOn: true, shipped: true,  tearDown: removeAllHeatmaps },
  { id: 'sliders',          label: 'Sliders',           defaultOn: true, shipped: true,  tearDown: removeAllAxisSliders },
  { id: 'slider-threshold', label: 'Threshold slider',  defaultOn: true, shipped: true,  tearDown: removeThresholdSliders },
  { id: 'statistics',       label: 'Statistics popup',  defaultOn: true, shipped: true,  tearDown: dismissStatisticsPopup },
  { id: 'frequency',        label: 'Frequency table',   defaultOn: true, shipped: true,  tearDown: dismissFrequencyDialog },
  { id: 'frequency-chart',  label: 'Frequency chart',   defaultOn: true, shipped: true,  tearDown: dismissFrequencyChartDialog },
  // ── Spec-only registrations (flip `shipped` when the impl PR lands) ──
  // When you ship one of these, also add its tearDown function above and
  // wire it into the entry on the same line.
  { id: 'annotations',      label: 'Cell annotations',  defaultOn: true, shipped: false },  // spec 006
  { id: 'copy-as-csv',      label: 'Copy as CSV',       defaultOn: true, shipped: false },  // spec 009
  { id: 'cumulative',       label: 'Cumulative col.',   defaultOn: true, shipped: true,  tearDown: removeCumulativeColumns },  // spec 008 (landed via 012-virtual-columns)
  { id: 'diff-compare',     label: 'Diff / compare',    defaultOn: true, shipped: true,  tearDown: removeCompareColumns },  // spec 010 column-mode (landed via 012-virtual-columns)
  { id: 'filter',           label: 'Column filter',     defaultOn: true, shipped: true,  tearDown: clearTableFilters },  // spec 003 (landed via 002-003-row-visibility)
  { id: 'outlier',          label: 'Outlier marker',    defaultOn: true, shipped: false },  // spec 004
  { id: 'sort',             label: 'Column sort',       defaultOn: true, shipped: true,  tearDown: clearTableSort },  // spec 002 (landed via 002-003-row-visibility)
  { id: 'sparkline',        label: 'Row sparkline',     defaultOn: true, shipped: true,  tearDown: removeSparklineColumns },  // spec 005 (landed via 012-virtual-columns)
  { id: 'units-toggle',     label: 'Units toggle',      defaultOn: true, shipped: false },  // spec 007
];

// Boot-time validation.
{
  const seen = new Set<string>();
  for (const e of ENTRIES) {
    if (!ID_PATTERN.test(e.id)) {
      throw new Error(`[gridsight] enrichment-registry: invalid id "${e.id}" (must match ${ID_PATTERN})`);
    }
    if (seen.has(e.id)) {
      throw new Error(`[gridsight] enrichment-registry: duplicate id "${e.id}"`);
    }
    if (!e.label || typeof e.label !== 'string') {
      throw new Error(`[gridsight] enrichment-registry: id "${e.id}" has empty label`);
    }
    // A shipped enrichment with a tearDown invariant is enforceable for the
    // current set (every shipped entry above has a tearDown), but spec-only
    // entries MUST NOT carry a tearDown — would point at code that does not
    // exist yet.
    if (!e.shipped && e.tearDown) {
      throw new Error(`[gridsight] enrichment-registry: id "${e.id}" is spec-only but declares tearDown`);
    }
    seen.add(e.id);
  }
}

export const ENRICHMENT_REGISTRY: readonly EnrichmentRegistryEntry[] = Object.freeze(
  ENTRIES.map(e => Object.freeze({ ...e })) as EnrichmentRegistryEntry[]
);

export const ENRICHMENT_IDS: readonly EnrichmentId[] = Object.freeze(
  ENRICHMENT_REGISTRY.map(e => e.id)
);

/** Subset of the registry that has a real implementation in the current
 *  build. Used by the runtime toggle panel so visitors only see
 *  enrichments they can actually use. */
export const SHIPPED_ENRICHMENTS: readonly EnrichmentRegistryEntry[] = Object.freeze(
  ENRICHMENT_REGISTRY.filter(e => e.shipped)
);

/* ──────────────────────────────────────────────────────────────────────────
 * Descriptor model (docs/architecture/enrichments.md)
 *
 * The static catalog above declares identity + capability for every
 * enrichment (including forward-compat spec-only stubs that have no module
 * to self-register from). Behavior — how an enrichment mounts its affordance,
 * whether it applies to a given header, its active-state probe — is attached
 * per id by the enrichment's own module via `registerEnrichment`. The merged
 * view is a `EnrichmentDescriptor`, the single object the injection pass,
 * toggle panel, and menu all consume.
 * ────────────────────────────────────────────────────────────────────────── */

export type AffordanceHeaderType = 'row' | 'column' | 'table';

export interface AffordanceContext {
  table: HTMLTableElement;
  header: HTMLTableCellElement;
  headerType: AffordanceHeaderType;
  colIndex: number;
  columnType: 'numeric' | 'categorical';
}

/** Behavior an enrichment's module contributes for its catalog id. */
export interface EnrichmentBehavior {
  readonly id: EnrichmentId;
  /** Is this affordance relevant for the given header context? */
  appliesTo(ctx: AffordanceContext): boolean;
  /** Build and return the affordance element (lozenge button), or null. */
  mount(ctx: AffordanceContext): HTMLElement | null;
  /** Toggle/menu active-state probe. Omit for one-shot commands. */
  isActive?(ctx: AffordanceContext): boolean;
}

/** Merged identity + capability + behavior. */
export interface EnrichmentDescriptor extends EnrichmentRegistryEntry {
  readonly behavior?: EnrichmentBehavior;
}

const catalogById = new Map<EnrichmentId, EnrichmentRegistryEntry>(
  ENRICHMENT_REGISTRY.map(e => [e.id, e]),
);
const behaviorById = new Map<EnrichmentId, EnrichmentBehavior>();

/** Register an enrichment's affordance behavior against its catalog id.
 *  Called at module load from each shipped enrichment. Idempotent (last
 *  registration wins, which keeps test re-imports stable). */
export function registerEnrichment(behavior: EnrichmentBehavior): void {
  if (!catalogById.has(behavior.id)) {
    throw new Error(
      `[gridsight] registerEnrichment: "${behavior.id}" is not in the catalog. ` +
        `Add a static entry (id/label/defaultOn/shipped) first.`,
    );
  }
  behaviorById.set(behavior.id, behavior);
}

/** Merged descriptor for one id, or undefined if the id is unknown. */
export function getEnrichmentDescriptor(id: EnrichmentId): EnrichmentDescriptor | undefined {
  const entry = catalogById.get(id);
  if (!entry) return undefined;
  return { ...entry, behavior: behaviorById.get(id) };
}

/** Every descriptor in catalog order. */
export function listEnrichmentDescriptors(): EnrichmentDescriptor[] {
  return ENRICHMENT_REGISTRY.map(e => ({ ...e, behavior: behaviorById.get(e.id) }));
}
