# Phase 1 Data Model: End-to-End Enrichment Coverage Matrix

These are **test-domain** entities (TypeScript types in `tests/e2e/helpers/`),
not runtime library types. No `src/` model changes.

## DemoPage

A discovered demo HTML page under test.

| Field | Type | Notes |
|-------|------|-------|
| `relPath` | `string` | Path relative to `public/`, e.g. `demo/summary-row/index.html`. |
| `url` | `string` | Full preview URL, `http://localhost:<port>/<base>/<relPath>`. |
| `offered` | `EnrichmentId[]` | Read at runtime: `pageConfig.enrichments` if non-empty, else all `enrichmentIds`. |
| `tableIds` | `string[]` | Ids of enriched `<table>` elements on the page (DOM-read). |
| `hasToggleUi` | `boolean` | Whether `[data-gs-toggle-panel-root]` is present (drives weak vs. full driving). |

**Discovery rule**: glob `public/demo/**/*.html`, keep files containing
`window.gridSight` and at least one `<table>`, exclude `*fixture*.html`.

## EnrichmentId

The stable string id of a registered enrichment (e.g. `summary-row`, `heatmap`,
`find-in-table`). Authoritative list = `window.gridSight.enrichmentIds`.

## EnrichmentClass (test metadata)

Declared once in `helpers/applicability.ts`; guarded by a meta-check so every
shipped id is classified (FR-009).

| Field | Type | Notes |
|-------|------|-------|
| `id` | `EnrichmentId` | |
| `scope` | `'numeric' \| 'categorical' \| 'any' \| 'table'` | Column applicability / table-level (e.g. `find-in-table`). |
| `headerType` | `'row' \| 'column' \| 'table'` | Where its affordance mounts. |
| `stateful` | `boolean` | If true, also assert toggle-off→on round-trip restore (FR-006). |

## ColumnOracle (curated fixture ground truth)

Authored expectation for `public/demo/matrix/index.html` columns — the
independent oracle that catches mis-typing (SC-002).

| Field | Type | Notes |
|-------|------|-------|
| `header` | `string` | Column header text, e.g. `Sample ID`. |
| `kind` | `'numeric' \| 'categorical' \| 'identifier'` | `identifier` ⇒ MUST be treated as text (e.g. `S-001`), never summed. |
| `annotated` | `boolean` | If true, cells carry an annotation marker yet MUST keep sort/filter affordances. |

## MatrixCase

One (demo × offered-enrichment) assertion, generated, not hand-written.

| Field | Type | Notes |
|-------|------|-------|
| `page` | `DemoPage` | |
| `enrichment` | `EnrichmentId` | |
| `expected` | `'active' \| 'inapplicable'` | Derived per table column from `EnrichmentClass` + (for the curated fixture) `ColumnOracle`. |
| `assertion` | weak \| strong | Weak for general demos; strong (value-level) for the curated fixture. |

**State transition per case**: `resting → enabled → (assert) → disabled → assert
byte-identical`; for `stateful` enrichments, additionally `disabled → enabled →
assert restored`.

## CombinationCase

One multi-enrichment interaction assertion on the opt-in playground.

| Field | Type | Notes |
|-------|------|-------|
| `members` | `EnrichmentId[]` | A pairwise pair, or the curated "rich" combo. |
| `perMemberAssert` | per-id check | Each member behaves while the others are active. |
| `teardownInvariant` | `'byte-identical'` | Disabling all members restores the table exactly (FR-006). |

## ApplicabilityExpectation (resolution)

Function, not stored data: `expectationFor(page, enrichment, column?) →
'active' | 'inapplicable' | GAP`. Returns `GAP` (⇒ explicit test failure, FR-009)
when a curated-fixture pairing has no `ColumnOracle`/`EnrichmentClass` entry.

## Relationships

```text
DemoPage 1───* MatrixCase *───1 EnrichmentId
EnrichmentId 1───1 EnrichmentClass
DemoPage(matrix fixture) 1───* ColumnOracle
opt-in-playground 1───* CombinationCase *───* EnrichmentId
```
