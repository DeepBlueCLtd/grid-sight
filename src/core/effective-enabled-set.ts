/**
 * Pure resolver from (visitor override, page config, registry) → enabled set.
 *
 * Precedence (R-3): visitor > page > library defaults.
 *
 *   if visitorOverride is defined: return visitorOverride ∩ knownIds
 *   if pageConfig.enrichments is defined: return pageConfig.enrichments ∩ knownIds
 *   else: return { e.id | e ∈ registry, e.defaultOn }
 *
 * Unknown ids dropped at every tier. Output is always a fresh Set (no aliasing).
 */

import type { EnrichmentRegistryEntry } from './enrichment-registry';

export interface ResolveInput {
  visitorOverride: Set<string> | undefined;
  pageConfig: { enrichments: Set<string> | undefined };
  registry: readonly EnrichmentRegistryEntry[];
}

export function resolveEnabledSet(input: ResolveInput): Set<string> {
  const { visitorOverride, pageConfig, registry } = input;
  const knownIds = new Set(registry.map(e => e.id));

  if (visitorOverride !== undefined) {
    return intersect(visitorOverride, knownIds);
  }
  if (pageConfig.enrichments !== undefined) {
    return intersect(pageConfig.enrichments, knownIds);
  }
  const out = new Set<string>();
  for (const e of registry) {
    if (e.defaultOn) out.add(e.id);
  }
  return out;
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const id of a) {
    if (b.has(id)) out.add(id);
  }
  return out;
}
