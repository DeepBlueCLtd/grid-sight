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
 */

export interface ParsedPageConfig {
  /**
   * Normalised, deduped set of ids. `undefined` when the field was absent —
   * the resolver falls back to library defaults. An empty Set is honoured as
   * "no enrichments" (different from undefined).
   */
  enrichments: Set<string> | undefined;
  showToggleUi: boolean;
}

const WARN_PREFIX = '[gridsight]';

export function parsePageConfig(raw: unknown): ParsedPageConfig {
  const result: ParsedPageConfig = { enrichments: undefined, showToggleUi: false };

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
      const set = new Set<string>();
      let droppedNonString = false;
      for (const entry of arr) {
        if (typeof entry !== 'string') {
          if (!droppedNonString) {
            console.warn(`${WARN_PREFIX} pageConfig.enrichments contains non-string entries; dropping.`);
            droppedNonString = true;
          }
          continue;
        }
        const normalised = entry.trim().toLowerCase();
        if (normalised) set.add(normalised);
      }
      result.enrichments = set;
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

  return result;
}
