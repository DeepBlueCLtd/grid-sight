/**
 * Per-table options resolution (spec 015).
 *
 * Matches a `<table>` against the author-declared `pageConfig.tables` entries
 * (by id or CSS selector), folds the matches into a single effective set of
 * options, and resolves the table's enrichment set through the shared
 * precedence resolver (visitor > per-table > page > defaults).
 *
 * Pure module: it takes the entries + resolution context as input so it stays
 * unit-testable. The stateful wrapper (reading the live page config, caching
 * per table) lives in `enabled-set-state.ts`.
 */

import { resolveEnabledSet } from './effective-enabled-set';
import type { EnrichmentRegistryEntry } from './enrichment-registry';
import type { ParsedTableOptionEntry } from './page-config';

/** Result of folding the per-table entries that match one table. */
export interface FoldedTableOptions {
  /**
   * The folded per-table enrichment list, or `undefined` when no matching
   * entry set an `enrichments` field (then resolution falls through to the
   * page tier). An empty Set means a matching entry said "offer none".
   */
  enrichments: Set<string> | undefined;
  /** Folded GS-toggle start-state; defaults to false. */
  startActive: boolean;
  /** Folded set of ids to auto-apply on load, or `undefined` when unset. */
  activate: Set<string> | undefined;
  /** Whether any per-table entry matched this table. */
  matched: boolean;
}

/** The fully-resolved per-table configuration, cached per table. */
export interface ResolvedTableConfig {
  /** Effective enabled set for this table, unknown ids dropped (INV-2). */
  enrichments: Set<string>;
  /** Whether this table's GS toggle begins active. */
  startActive: boolean;
  /**
   * Ids to auto-apply on load, narrowed to those this table actually offers
   * (an enrichment that is not offered cannot be auto-applied). The apply step
   * supports only the parameterless toggles; other ids are no-ops there.
   */
  activate: Set<string>;
  /** Whether any per-table entry matched (drives global-vs-per-table). */
  matched: boolean;
}

export interface ResolveTableInput {
  entries: readonly ParsedTableOptionEntry[];
  visitorOverride: Set<string> | undefined;
  pageConfig: { enrichments: Set<string> | undefined };
  registry: readonly EnrichmentRegistryEntry[];
}

/**
 * Collect the entries whose selector matches `table`, in declaration order,
 * and fold them with **last-match-wins per field** (R-7):
 *   - `enrichments`: a later entry that sets the field overrides; an entry that
 *     omits it leaves the prior value (absence preserved as `undefined`).
 *   - `startActive`: the last matching entry's value wins (every parsed entry
 *     carries a concrete boolean, defaulted to false).
 *
 * `data-gs-ignore` is absolute (R-8): an ignored table never matches, even if a
 * selector would otherwise apply. Invalid selectors are skipped, never thrown.
 */
export function matchTableEntries(
  table: HTMLTableElement,
  entries: readonly ParsedTableOptionEntry[],
): FoldedTableOptions {
  if (table.hasAttribute('data-gs-ignore')) {
    return { enrichments: undefined, startActive: false, activate: undefined, matched: false };
  }

  let matched = false;
  let enrichments: Set<string> | undefined;
  let startActive = false;
  let activate: Set<string> | undefined;

  for (const entry of entries) {
    let isMatch = false;
    try {
      isMatch = table.matches(entry.selector);
    } catch {
      // Malformed selector — degrade, never throw into the host page.
      isMatch = false;
    }
    if (!isMatch) continue;

    matched = true;
    if (entry.enrichments !== undefined) enrichments = new Set(entry.enrichments);
    startActive = entry.startActive;
    if (entry.activate !== undefined) activate = new Set(entry.activate);
  }

  return { enrichments, startActive, activate, matched };
}

/**
 * Resolve the full per-table configuration: match + fold, then run the folded
 * enrichment set through the precedence resolver. When no entry matched (or a
 * matching entry omitted `enrichments`), the per-table tier is `undefined` and
 * resolution is byte-for-byte the page-global behaviour (INV-1).
 */
export function resolveTableConfig(
  table: HTMLTableElement,
  input: ResolveTableInput,
): ResolvedTableConfig {
  const folded = matchTableEntries(table, input.entries);
  const enrichments = resolveEnabledSet({
    visitorOverride: input.visitorOverride,
    perTableEnrichments: folded.enrichments,
    pageConfig: input.pageConfig,
    registry: input.registry,
  });
  // Auto-apply only what this table actually offers — you cannot activate an
  // enrichment that is not in the resolved set.
  const activate = new Set<string>();
  if (folded.activate) {
    for (const id of folded.activate) {
      if (enrichments.has(id)) activate.add(id);
    }
  }
  return { enrichments, startActive: folded.startActive, activate, matched: folded.matched };
}
