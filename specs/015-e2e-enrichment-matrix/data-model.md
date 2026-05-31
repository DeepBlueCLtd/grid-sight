# Phase 1 Data Model: End-to-End Enrichment Coverage Matrix

Test-domain entities (TypeScript types in `tests/e2e/helpers/`). No `src/` model
changes. Reuses the real `EnrichmentId` type from
`src/core/enrichment-registry.ts` rather than re-declaring `string`.

## DemoPage

| Field | Type | Notes |
|-------|------|-------|
| `relPath` | `string` | Relative to `public/`, e.g. `demo/summary-row/index.html`. |
| `url` | `(baseUrl: string) => string` | Built from the shared `webServer` baseURL. |
| `offered` | `EnrichmentId[]` | Runtime: `pageConfig.enrichments` if non-empty, else all `enrichmentIds`. |
| `tableIds` | `string[]` | Enriched `<table>` ids (DOM-read). |
| `hasToggleUi` | `boolean` | `[data-gs-toggle-panel-root]` present. |

**Discovery rule** (D2/D13): glob `public/demo/**/*.html`; keep files with
`window.gridSight` + a `<table>`; exclude `*fixture*.html` and large/perf fixtures
(row count over threshold, or a denylist incl. `perf-1000.html`).

## EnrichmentId

Imported from `src/core/enrichment-registry.ts`. Authoritative runtime list =
`window.gridSight.enrichmentIds`.

## ColumnOracle *(curated fixture only — authored, strong layer)*

| Field | Type | Notes |
|-------|------|-------|
| `header` | `string` | Column header text, e.g. `Sample ID`. Must resolve in `#matrix-table` (D11 guard). |
| `kind` | `'numeric' \| 'categorical' \| 'identifier'` | `identifier` ⇒ MUST stay text (e.g. `S-001`); never summed. |
| `annotated` | `boolean` | Cells carry an annotation marker yet MUST keep sort/filter affordances. |

## MatrixCase *(conceptual — realized as a `test.step`, not a top-level test; D1)*

| Field | Type | Notes |
|-------|------|-------|
| `page` | `DemoPage` | One Playwright `test()` per page. |
| `enrichment` | `EnrichmentId` | One `test.step` per offered enrichment. |
| `layer` | `'weak' \| 'strong'` | Weak = runtime-derived (D4); strong = curated fixture oracle. |
| `expected` | `'active' \| 'inapplicable'` | Weak: derived from rendered lozenge state. Strong: from `ColumnOracle`. |

**Per-step state machine** (D7): `snapshot(before) → enable → assert(expected) →
disable → assert(no gs-* artifacts) → enable → assert(round-trip == before)`.

## CombinationCase *(opt-in playground; D12)*

| Field | Type | Notes |
|-------|------|-------|
| `members` | `EnrichmentId[]` | A pairwise pair, or the curated rich combo. |
| `interactionAsserts` | fn[] | Concrete cross-behaviour (D10): filter→summary recompute; sort→aggregate stable; find highlights survive filter. |
| `teardownInvariant` | `'byte-identical'` | Disabling all members restores the table (relative round-trip). |

## PrecedenceCase *(migrated from capability-filtering; D6/11A)*

| Field | Type | Notes |
|-------|------|-------|
| `page` | `DemoPage` | |
| `expectedEnabled` | `Set<EnrichmentId>` | Asserted by **Set-equality** vs `enrichmentIds.filter(isEnrichmentEnabled)` — exactly these, no extras. |

## Harness pure functions *(Vitest-unit-tested; D9)*

| Function | Signature | Tested for |
|----------|-----------|-----------|
| `pairwise` | `(ids: T[]) => [T,T][]` | completeness, no dup/self-pair, order stability |
| `discoverDemoPages` filter | `(files, contents) => DemoPage[]` | excludes fixtures/perf/table-less |
| `normalizeForCompare` | `(html: string) => string` | normalizes benign diffs; **never strips `gs-*`** |

## Relationships

```text
DemoPage 1───* MatrixCase(step) *───1 EnrichmentId(=src type)
DemoPage(matrix fixture) 1───* ColumnOracle        (authored, strong)
DemoPage 0..1───1 PrecedenceCase                   (migrated)
opt-in-playground 1───* CombinationCase *───* EnrichmentId
```
