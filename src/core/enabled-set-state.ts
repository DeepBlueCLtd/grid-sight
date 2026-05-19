/**
 * Module-scoped holder for the effective enabled set, plus the resolver call
 * that updates it. Read by `header-utils`, `enrichment-menu`, and slider
 * URL-state loaders; mutated only by `init()` and the runtime toggle panel.
 */

import { ENRICHMENT_REGISTRY } from './enrichment-registry';
import { resolveEnabledSet } from './effective-enabled-set';
import type { ParsedPageConfig } from './page-config';

let currentSet: Set<string> = new Set(
  ENRICHMENT_REGISTRY.filter(e => e.defaultOn).map(e => e.id)
);

let currentPageConfig: ParsedPageConfig = { enrichments: undefined, showToggleUi: false };
let currentVisitorOverride: Set<string> | undefined = undefined;

export function getEffectiveEnabledSet(): ReadonlySet<string> {
  return currentSet;
}

export function isEnrichmentEnabled(id: string): boolean {
  return currentSet.has(id);
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
