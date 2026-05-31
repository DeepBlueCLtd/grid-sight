import type { EnrichmentId } from '../../../src/core/enrichment-registry';

/**
 * The single typed view of the `window.gridSight` surface the e2e harness
 * relies on, so specs and helpers can avoid scattering `(window as any)`.
 *
 * Only the already-shipped runtime surfaces are described here (see
 * specs/015-e2e-enrichment-matrix/contracts/test-helpers.md). This adds no
 * production code — it is a test-side type assertion over what `src/index.ts`
 * already exposes.
 */
export interface GridSightWindow {
  gridSight: {
    enrichmentIds: readonly EnrichmentId[];
    isEnrichmentEnabled(id: string): boolean;
    pageConfig?: { enrichments?: EnrichmentId[]; showToggleUi?: boolean };
  };
}

export type { EnrichmentId };
