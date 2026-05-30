/**
 * Pure resolver from (visitor override, per-table set, page config, registry)
 * → enabled set.
 *
 * Precedence (R-3, spec 015): visitor > per-table > page > library defaults.
 *
 *   if visitorOverride is defined:        return visitorOverride ∩ knownIds
 *   if perTableEnrichments is defined:     return perTableEnrichments ∩ knownIds
 *   if pageConfig.enrichments is defined:  return pageConfig.enrichments ∩ knownIds
 *   else:                                  return { e.id | e ∈ registry, e.defaultOn }
 *
 * The per-table tier is additive and optional: when `perTableEnrichments` is
 * omitted (or undefined) resolution is byte-for-byte the pre-spec-015 behaviour
 * (INV-1, FR-018). Unknown ids dropped at every tier. Output is always a fresh
 * Set (no aliasing).
 */

import type { EnrichmentRegistryEntry } from './enrichment-registry';

export interface ResolveInput {
  visitorOverride: Set<string> | undefined;
  /**
   * The folded per-table enrichment set for the table being resolved, or
   * `undefined` when no per-table entry contributed an enrichment list (then
   * resolution falls through to the page tier). An empty Set means the table
   * was told to "offer none" and is honoured as such.
   */
  perTableEnrichments?: Set<string> | undefined;
  pageConfig: { enrichments: Set<string> | undefined };
  registry: readonly EnrichmentRegistryEntry[];
}

export function resolveEnabledSet(input: ResolveInput): Set<string> {
  const { visitorOverride, perTableEnrichments, pageConfig, registry } = input;
  const knownIds = new Set(registry.map(e => e.id));

  if (visitorOverride !== undefined) {
    return intersect(visitorOverride, knownIds);
  }
  if (perTableEnrichments !== undefined) {
    return intersect(perTableEnrichments, knownIds);
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
