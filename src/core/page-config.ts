/**
 * Parse and normalise the page-level enrichment config.
 *
 * Source: `window.gridSight.pageConfig` (IIFE path) or the `enrichments` /
 * `showToggleUi` fields on `gridSight.init(options)` (ESM path). Both paths
 * funnel through `parsePageConfig` so the validation policy is in one place.
 *
 * Validation policy (FR-022):
 *   - non-object raw → warn + reject whole config (returns {enrichments: undefined, showToggleUi: false})
 *   - enrichments non-array → warn + ignore field
 *   - non-string entries → drop with one warning
 *   - lowercase + trim normalisation; case-insensitive dedup
 *   - showToggleUi non-boolean → coerce via Boolean() with warn
 * Each distinct warning emitted at most once per call.
 *
 * Per-table options (spec 015, R-9): `pageConfig.tables` is an array of
 * `{ selector, enrichments?, startActive? }` entries addressing individual
 * tables by id/CSS selector. Same degrade-never-throw policy:
 *   - tables non-array → warn once + ignore the field (→ [])
 *   - entry not an object or `selector` not a non-empty string → drop, warn once
 *   - `enrichments` normalised exactly like the page-level list; absent field
 *     stays `undefined` (distinct from an empty set = "offer none")
 *   - `startActive` non-boolean → Boolean()-coerce, warn once; default false
 */

/**
 * One normalised per-table option entry (spec 015 data-model). Produced by
 * `parsePageConfig`; consumed by `per-table-options.ts`.
 */
export interface ParsedTableOptionEntry {
  /** CSS selector, as authored (case-sensitive; not lowercased). */
  selector: string;
  /**
   * Normalised ids this table offers, or `undefined` when the field was absent
   * (fall through to the page-level set). An empty Set means "offer none".
   */
  enrichments: Set<string> | undefined;
  /** Whether the table's GS toggle begins active. Defaults to false. */
  startActive: boolean;
  /**
   * Ids to auto-apply on load once the table's toggle is active (spec 015
   * extension). Only the parameterless toggles are supported at apply time
   * (heatmap, sliders, sparkline); other ids are ignored. `undefined` when the
   * field was absent. A non-empty set implies the toggle starts active.
   */
  activate: Set<string> | undefined;
}

export interface ParsedPageConfig {
  /**
   * Normalised, deduped set of ids. `undefined` when the field was absent —
   * the resolver falls back to library defaults. An empty Set is honoured as
   * "no enrichments" (different from undefined).
   */
  enrichments: Set<string> | undefined;
  showToggleUi: boolean;
  /**
   * Per-table option entries (spec 015). Empty array when `tables` was absent
   * or malformed.
   */
  tables: ParsedTableOptionEntry[];
}

const WARN_PREFIX = '[gridsight]';

export function parsePageConfig(raw: unknown): ParsedPageConfig {
  const result: ParsedPageConfig = { enrichments: undefined, showToggleUi: false, tables: [] };

  if (raw === undefined || raw === null) return result;

  if (typeof raw !== 'object') {
    console.warn(`${WARN_PREFIX} pageConfig must be an object; ignoring.`);
    return result;
  }

  const obj = raw as Record<string, unknown>;

  if ('enrichments' in obj) {
    const arr = obj.enrichments;
    if (!Array.isArray(arr)) {
      console.warn(`${WARN_PREFIX} pageConfig.enrichments must be an array; ignoring.`);
    } else {
      result.enrichments = normaliseEnrichmentList(
        arr,
        'pageConfig.enrichments contains non-string entries; dropping.'
      );
    }
  }

  if ('showToggleUi' in obj) {
    const v = obj.showToggleUi;
    if (typeof v !== 'boolean') {
      console.warn(`${WARN_PREFIX} pageConfig.showToggleUi must be a boolean; coercing.`);
      result.showToggleUi = Boolean(v);
    } else {
      result.showToggleUi = v;
    }
  }

  if ('tables' in obj) {
    result.tables = parseTableEntries(obj.tables);
  }

  return result;
}

/**
 * Normalise an enrichment id list: trim + lowercase + dedup, dropping
 * non-string members with a single warning. Shared by the page-level
 * `enrichments` and per-table `enrichments` fields so the policy lives once.
 */
function normaliseEnrichmentList(arr: unknown[], nonStringWarning: string): Set<string> {
  const set = new Set<string>();
  let droppedNonString = false;
  for (const entry of arr) {
    if (typeof entry !== 'string') {
      if (!droppedNonString) {
        console.warn(`${WARN_PREFIX} ${nonStringWarning}`);
        droppedNonString = true;
      }
      continue;
    }
    const normalised = entry.trim().toLowerCase();
    if (normalised) set.add(normalised);
  }
  return set;
}

/**
 * Parse + normalise `pageConfig.tables` (spec 015, R-9). Degrade-never-throw:
 * a non-array yields `[]` with one warning; malformed entries are dropped with
 * one warning each (distinct warning emitted at most once per call).
 */
function parseTableEntries(raw: unknown): ParsedTableOptionEntry[] {
  if (!Array.isArray(raw)) {
    console.warn(`${WARN_PREFIX} pageConfig.tables must be an array; ignoring.`);
    return [];
  }

  const out: ParsedTableOptionEntry[] = [];
  let warnedBadEntry = false;
  let warnedStartActive = false;

  for (const rawEntry of raw) {
    if (typeof rawEntry !== 'object' || rawEntry === null) {
      if (!warnedBadEntry) {
        console.warn(`${WARN_PREFIX} pageConfig.tables entries must be objects with a string selector; dropping invalid entries.`);
        warnedBadEntry = true;
      }
      continue;
    }
    const entry = rawEntry as Record<string, unknown>;
    const selector = entry.selector;
    if (typeof selector !== 'string' || selector.trim() === '') {
      if (!warnedBadEntry) {
        console.warn(`${WARN_PREFIX} pageConfig.tables entries must be objects with a string selector; dropping invalid entries.`);
        warnedBadEntry = true;
      }
      continue;
    }

    // `enrichments` absent → undefined (fall through to page-level). Present
    // (incl. []) → normalised set replacing the offered set for matched tables.
    let enrichments: Set<string> | undefined;
    if ('enrichments' in entry) {
      const arr = entry.enrichments;
      if (!Array.isArray(arr)) {
        console.warn(`${WARN_PREFIX} pageConfig.tables[].enrichments must be an array; ignoring that field.`);
      } else {
        enrichments = normaliseEnrichmentList(
          arr,
          'pageConfig.tables[].enrichments contains non-string entries; dropping.'
        );
      }
    }

    // `startActive` absent → false. Non-boolean → Boolean()-coerce, warn once.
    let startActive = false;
    if ('startActive' in entry) {
      const v = entry.startActive;
      if (typeof v !== 'boolean') {
        if (!warnedStartActive) {
          console.warn(`${WARN_PREFIX} pageConfig.tables[].startActive must be a boolean; coercing.`);
          warnedStartActive = true;
        }
        startActive = Boolean(v);
      } else {
        startActive = v;
      }
    }

    // `activate` absent → undefined. Normalised like the enrichment lists.
    let activate: Set<string> | undefined;
    if ('activate' in entry) {
      const arr = entry.activate;
      if (!Array.isArray(arr)) {
        console.warn(`${WARN_PREFIX} pageConfig.tables[].activate must be an array; ignoring that field.`);
      } else {
        activate = normaliseEnrichmentList(
          arr,
          'pageConfig.tables[].activate contains non-string entries; dropping.'
        );
      }
    }

    out.push({ selector: selector.trim(), enrichments, startActive, activate });
  }

  return out;
}
