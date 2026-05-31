/**
 * Module-scoped holder for the effective enabled set, plus the resolver call
 * that updates it. Read by `header-utils` (the injection pass) and slider
 * URL-state loaders; mutated only by `init()` and the runtime toggle panel.
 *
 * The initial set is computed lazily on first access to avoid a circular
 * import at module-load time (`enrichment-registry.ts` references tearDown
 * functions in `enrichments/*`, some of which transitively import this
 * module via `isEnrichmentEnabled`).
 *
 * Per-table awareness (spec 015): `getEffectiveEnabledSet` and
 * `isEnrichmentEnabled` take an optional `table`. With no table (or a table
 * matched by no per-table entry) they return the page-global set exactly as
 * before (INV-1). With a matched table they return that table's resolved set.
 * Resolved per-table configs are cached in a `WeakMap`, rebuilt whenever the
 * page config or visitor override changes.
 */

import { ENRICHMENT_REGISTRY } from './enrichment-registry';
import { resolveEnabledSet } from './effective-enabled-set';
import {
  resolveTableConfig as resolveTableConfigPure,
  type ResolvedTableConfig,
} from './per-table-options';
import type { ParsedPageConfig } from './page-config';

let currentSet: Set<string> | null = null;
let currentPageConfig: ParsedPageConfig = { enrichments: undefined, showToggleUi: false, tables: [] };
let currentVisitorOverride: Set<string> | undefined = undefined;
// Per-table resolved configs, rebuilt on every setPageConfig/setVisitorOverride.
let tableCache = new WeakMap<HTMLTableElement, ResolvedTableConfig>();

function ensureSet(): Set<string> {
  if (currentSet === null) recompute();
  return currentSet as Set<string>;
}

export function getEffectiveEnabledSet(table?: HTMLTableElement): ReadonlySet<string> {
  if (table) return resolveTableConfig(table).enrichments;
  return ensureSet();
}

export function isEnrichmentEnabled(id: string, table?: HTMLTableElement): boolean {
  return getEffectiveEnabledSet(table).has(id);
}

/**
 * Resolve (and cache) the full per-table config for `table`. Used by the
 * table-aware gate above and by `index.ts` for the GS-toggle start-state.
 * For a table matched by no per-table entry, `enrichments` equals the
 * page-global set (INV-1) and `matched` is false.
 */
export function resolveTableConfig(table: HTMLTableElement): ResolvedTableConfig {
  const cached = tableCache.get(table);
  if (cached) return cached;
  const cfg = resolveTableConfigPure(table, {
    entries: currentPageConfig.tables,
    visitorOverride: currentVisitorOverride,
    pageConfig: { enrichments: currentPageConfig.enrichments },
    registry: ENRICHMENT_REGISTRY,
  });
  tableCache.set(table, cfg);
  return cfg;
}

export function setPageConfig(cfg: ParsedPageConfig): void {
  currentPageConfig = cfg;
  tableCache = new WeakMap();
  recompute();
}

export function getPageConfig(): ParsedPageConfig {
  return currentPageConfig;
}

export function setVisitorOverride(override: Set<string> | undefined): void {
  currentVisitorOverride = override === undefined ? undefined : new Set(override);
  tableCache = new WeakMap();
  recompute();
}

export function getVisitorOverride(): Set<string> | undefined {
  return currentVisitorOverride;
}

function recompute(): void {
  currentSet = resolveEnabledSet({
    visitorOverride: currentVisitorOverride,
    pageConfig: { enrichments: currentPageConfig.enrichments },
    registry: ENRICHMENT_REGISTRY,
  });
}
