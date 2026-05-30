/**
 * Module-scoped holder for the effective enabled set, plus the resolver call
 * that updates it. Read by `header-utils` (the injection pass) and slider
 * URL-state loaders; mutated only by `init()` and the runtime toggle panel.
 *
 * The initial set is computed lazily on first access to avoid a circular
 * import at module-load time (`enrichment-registry.ts` references tearDown
 * functions in `enrichments/*`, some of which transitively import this
 * module via `isEnrichmentEnabled`).
 */

import { ENRICHMENT_REGISTRY } from './enrichment-registry';
import { resolveEnabledSet } from './effective-enabled-set';
import type { ParsedPageConfig } from './page-config';

let currentSet: Set<string> | null = null;
let currentPageConfig: ParsedPageConfig = { enrichments: undefined, showToggleUi: false, tables: [] };
let currentVisitorOverride: Set<string> | undefined = undefined;

function ensureSet(): Set<string> {
  if (currentSet === null) recompute();
  return currentSet as Set<string>;
}

export function getEffectiveEnabledSet(): ReadonlySet<string> {
  return ensureSet();
}

export function isEnrichmentEnabled(id: string): boolean {
  return ensureSet().has(id);
}

export function setPageConfig(cfg: ParsedPageConfig): void {
  currentPageConfig = cfg;
  recompute();
}

export function getPageConfig(): ParsedPageConfig {
  return currentPageConfig;
}

export function setVisitorOverride(override: Set<string> | undefined): void {
  currentVisitorOverride = override === undefined ? undefined : new Set(override);
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
