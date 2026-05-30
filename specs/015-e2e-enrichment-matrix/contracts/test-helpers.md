# Contract: E2E Matrix Test Helpers

The interfaces this feature exposes are the **test helper API** under
`tests/e2e/helpers/`. These are consumed by `enrichment-matrix.spec.ts` and
`enrichment-permutations.spec.ts`. Signatures are the contract; implementations
may change freely (Development-Phase Posture).

## `helpers/preview-server.ts`

```ts
/** Start one vite preview for the spec; returns the base URL and a close fn. */
export async function startPreview(opts?: { port?: number }): Promise<{
  baseUrl: string;            // e.g. http://localhost:3160/grid-sight
  close: () => Promise<void>;
}>;
```

- Default port 3160 (unique among existing specs). Serves the built `dist/`.
- `afterAll` MUST call `close()`.

## `helpers/demo-discovery.ts`

```ts
export interface DemoPage {
  relPath: string;            // demo/summary-row/index.html
  url: (baseUrl: string) => string;
}

/** Glob public/demo for pages that init gridSight and contain a <table>. */
export function discoverDemoPages(): DemoPage[];        // sync, filesystem (Node)

/** Read the offered enrichment set + table ids from a loaded page. */
export async function readPageProfile(page: Page): Promise<{
  offered: string[];          // pageConfig.enrichments || enrichmentIds
  tableIds: string[];
  hasToggleUi: boolean;
}>;
```

- `discoverDemoPages()` excludes `*fixture*.html` and pages with no `<table>`.
- `offered` resolves empty `pageConfig.enrichments` to the full `enrichmentIds`.

## `helpers/toggle-panel.ts`

```ts
export const raf: (page: Page) => Promise<void>;        // one requestAnimationFrame flush

/** Check/uncheck the enrichment's panel toggle by id, then flush a frame. */
export async function setEnrichment(page: Page, id: string, on: boolean): Promise<void>;

/** True if the table renders this enrichment's active lozenge. */
export async function hasActiveLozenge(page: Page, tableId: string, id: string): Promise<boolean>;

/** True if the table renders this enrichment's disabled/inapplicable lozenge. */
export async function hasDisabledLozenge(page: Page, tableId: string, id: string): Promise<boolean>;
```

- Selectors (fixed by `src/ui/toggle-panel.ts`):
  `[data-gs-toggle-panel-root] input[type=checkbox][value="<id>"]`;
  active lozenge `table#<tid> [data-gs-lozenge-id="<id>"]`;
  disabled lozenge additionally carries `.gs-lozenge--disabled`.

## `helpers/teardown-snapshot.ts`

```ts
/** Capture a table's outerHTML for later byte-identical comparison. */
export async function snapshotTable(page: Page, tableId: string): Promise<string>;

/** Assert the table's current outerHTML equals a prior snapshot. */
export async function expectByteIdentical(page: Page, tableId: string, before: string): Promise<void>;
```

- Comparison is taken after `raf(page)`; the data table only (not the injected
  toggle panel).

## `helpers/applicability.ts`

```ts
export type EnrichmentScope = 'numeric' | 'categorical' | 'any' | 'table';

export interface EnrichmentClass {
  id: string; scope: EnrichmentScope;
  headerType: 'row' | 'column' | 'table'; stateful: boolean;
}

/** Declared classification for every shipped enrichment id. */
export const ENRICHMENT_CLASSES: ReadonlyArray<EnrichmentClass>;

/** Meta-check: every window.gridSight enrichmentId has exactly one class, else fail. */
export function assertEveryIdClassified(allIds: string[]): void;          // FR-009

/** Expected outcome for a (column kind, enrichment) pairing. */
export function expectedOutcome(
  columnKind: 'numeric' | 'categorical' | 'identifier',
  cls: EnrichmentClass,
): 'active' | 'inapplicable';
```

## `helpers/offline-guard.ts`

```ts
/** Fail the test if any request targets a non-local origin (Principle VI). */
export async function installOfflineGuard(page: Page): Promise<void>;
```

## Consumed runtime surfaces (already shipped — not added by this feature)

- `window.gridSight.pageConfig.enrichments: string[]` (preserved, `src/index.ts:667`)
- `window.gridSight.enrichmentIds: readonly string[]`
- `window.gridSight.isEnrichmentEnabled(id: string): boolean`
- DOM: `[data-gs-toggle-panel-root]`, `[data-gs-lozenge-id]`,
  `.gs-lozenge--disabled`, `[data-gs-enrichment-toggle]`.
