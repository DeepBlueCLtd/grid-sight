# Contract: E2E Matrix Test Helpers

Test helper API under `tests/e2e/helpers/`, consumed by the matrix and permutation
specs. Signatures are the contract; implementations may change freely
(Development-Phase Posture). Types reuse `EnrichmentId` from
`src/core/enrichment-registry.ts`. A single typed accessor avoids scattering
`(window as any).gridSight`.

```ts
// helpers/gridsight-window.ts — one typed surface, no `any` scatter
import type { EnrichmentId } from '../../../src/core/enrichment-registry';
export interface GridSightWindow {
  gridSight: {
    enrichmentIds: readonly EnrichmentId[];
    isEnrichmentEnabled(id: string): boolean;
    pageConfig?: { enrichments?: EnrichmentId[]; showToggleUi?: boolean };
  };
}
```

## helpers/demo-discovery.ts

```ts
export interface DemoPage { relPath: string; url(baseUrl: string): string; }

/** Glob public/demo; keep gridSight pages with a <table>; exclude fixtures + perf. */
export function discoverDemoPages(): DemoPage[];                 // sync, Node fs

/** Pure filter (unit-tested, D9): decides inclusion from path + file contents. */
export function includeDemo(relPath: string, contents: string): boolean;

export async function readPageProfile(page: Page): Promise<{
  offered: EnrichmentId[];       // pageConfig.enrichments || enrichmentIds
  tableIds: string[];
  hasToggleUi: boolean;
}>;
```

## helpers/toggle-panel.ts

```ts
export const raf: (page: Page) => Promise<void>;
export async function setEnrichment(page: Page, id: EnrichmentId, on: boolean): Promise<void>;

/** Placement-aware (3A): table-level corner vs per-column, by headerType. */
export async function hasActiveLozenge(page: Page, tableId: string, id: EnrichmentId): Promise<boolean>;
export async function hasDisabledLozenge(page: Page, tableId: string, id: EnrichmentId): Promise<boolean>;
```

- Selectors (from `src/ui/toggle-panel.ts` / `header-utils.ts`):
  `[data-gs-toggle-panel-root] input[type=checkbox][value="<id>"]`;
  lozenge `[data-gs-lozenge-id="<id>"]`; disabled adds `.gs-lozenge--disabled` +
  `aria-disabled="true"`.

## helpers/teardown.ts  *(6A/7A)*

```ts
export async function snapshotTable(page: Page, tableId: string): Promise<string>;

/** Relative round-trip: compare current normalized outerHTML to a prior snapshot. */
export async function expectRoundTrip(page: Page, tableId: string, before: string): Promise<void>;

/** Assert no residual gs-* artifacts for an enrichment while it is disabled. */
export async function expectNoArtifacts(page: Page, tableId: string, id: EnrichmentId): Promise<void>;

/** Pure (unit-tested): normalizes benign diffs; MUST NOT strip gs-* attrs/classes/nodes. */
export function normalizeForCompare(html: string): string;
```

## helpers/applicability.ts  *(2C weak oracle + pairwise)*

```ts
/** Weak layer: derive expected state from the running library's rendered lozenge. */
export async function observedState(page: Page, tableId: string, id: EnrichmentId):
  Promise<'active' | 'inapplicable' | 'absent'>;

/** Pure (unit-tested, D9): every unordered pair, no self/dup, stable order. */
export function pairwise<T>(items: T[]): [T, T][];
```

## helpers/isolation.ts  *(FR-014 parallel safety)*

```ts
/** Namespace/clear localStorage + URL state so concurrent specs don't collide. */
export async function isolateState(page: Page): Promise<void>;
/** Fail the test on any non-local request (Principle VI). */
export async function installOfflineGuard(page: Page): Promise<void>;
```

## Consumed runtime surfaces (already shipped — not added here)

- `window.gridSight.pageConfig.enrichments` (preserved, `src/index.ts:667`)
- `window.gridSight.enrichmentIds`, `window.gridSight.isEnrichmentEnabled(id)`
- DOM: `[data-gs-toggle-panel-root]`, `[data-gs-lozenge-id]`,
  `.gs-lozenge--disabled`, `aria-disabled`, `[data-gs-enrichment-toggle]`.

**Removed vs the pre-review draft**: `ENRICHMENT_CLASSES`,
`assertEveryIdClassified`, and `preview-server.ts` — superseded by 2C (runtime
weak oracle) and the global `webServer` (see `e2e-runner.md`).
