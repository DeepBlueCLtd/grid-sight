# Contract — Per-Table Options

Module surface and behavioural contract for the per-table configuration
capability. Consumers: host pages (config), `header-utils` + `index.ts`
(gating), `toggle-injector` (start-state).

## 1. Author config contract

Declared on the existing config object — **no change to `window.gridSight.init`'s
signature**:

```js
window.gridSight.pageConfig = {
  enrichments: ['heatmap', 'sort', 'sliders', /* … */], // existing page-level (optional)
  tables: [
    { selector: '#heatmap-demo', enrichments: ['heatmap'], startActive: true },
    { selector: '#sort-demo',    enrichments: ['sort', 'filter'], startActive: true },
    { selector: '.lookup',       enrichments: ['sliders', 'statistics'] },        // startActive defaults false
    { selector: '#raw-first',    enrichments: ['heatmap'], startActive: false },  // demonstrates default-off
  ],
};
```

Equivalent ESM path: `gridSight.init({ tables: [ … ] })`.

### Field rules

| Field | Required | Default | Normalisation |
|-------|----------|---------|---------------|
| `selector` | yes | — | used as-authored; matched via `Element.matches` against `<table>`s |
| `enrichments` | no | (fall through to page-level) | trim + lowercase + dedup; non-strings dropped (one warning) |
| `startActive` | no | `false` | `Boolean()`-coerced if non-boolean (one warning) |

### Malformed input (never throws into host page)

- `tables` not an array → warn once, ignored.
- entry without a non-empty string `selector` → dropped, warn once.
- unknown enrichment ids → dropped at resolution (no warning required; mirrors page-level).

## 2. Resolution contract

For a given table `T` not marked `data-gs-ignore`:

```text
entries(T)     = pageConfig.tables in declaration order where T matches entry.selector
folded(T)      = fold entries(T) with LAST-MATCH-WINS per field (enrichments, startActive)

enabledSet(T)  =
   visitorOverride ≠ ∅  → intersect(visitorOverride, knownIds)      // visitor wins
   else folded.enrichments defined → intersect(folded.enrichments, knownIds)
   else pageConfig.enrichments defined → intersect(pageConfig.enrichments, knownIds)
   else { e.id | e ∈ registry, e.defaultOn }

startActive(T) = folded.startActive ?? false
```

Precedence (FR-016): **visitor > per-table > page > defaults**. Unknown ids
dropped at every tier (FR-017). A table matched by no entry → `enabledSet(T)`
equals the current page-global resolution (INV-1, FR-018).

## 3. Gate surface (table-aware, backward compatible)

```ts
// src/core/enabled-set-state.ts
getEffectiveEnabledSet(table?: HTMLTableElement): ReadonlySet<string>
isEnrichmentEnabled(id: string, table?: HTMLTableElement): boolean
```

- Omitting `table` (or passing an unmatched table) → page-global set (unchanged).
- Passing a matched table → that table's resolved set.
- Results cached per table in a `WeakMap`; cache rebuilt on `setPageConfig` /
  `setVisitorOverride` / global re-enable.

Callers updated to pass the table where the decision is table-scoped:
`header-utils.addLozengesToHeader` (has `table`), and `index.ts` gates for
`outlier` / `freeze-panes` / `summary-row`.

## 4. Start-state surface

```ts
// src/ui/toggle-injector.ts (extracted from the existing inline click handler)
activateToggle(table: HTMLTableElement): void    // reveal enrichments: add active class, aria-expanded=true, inject plus-icons, wire listener
deactivateToggle(table: HTMLTableElement): void  // hide: remove active class, aria-expanded=false, remove plus-icons + listener
```

- The GS toggle's `click` handler calls these (same code path as a manual click).
- `index.ts`, after `injectToggle(table)`, calls `activateToggle(table)` iff
  `resolveTableConfig(table).startActive`.
- Contract: `deactivateToggle` after any `activateToggle` restores
  byte-identical original markup (INV-4 / FR-024).

## 5. Acceptance mapping

| Spec | Covered by |
|------|-----------|
| FR-014 (id/selector) | §1 selector, §2 entries(T) |
| FR-015 (per-table enrichments) | §2 enabledSet(T) per-table branch |
| FR-016 (precedence) | §2 ordering |
| FR-017 (unknown ids dropped) | §2 `intersect(..., knownIds)` every tier |
| FR-018 (no regression) | §2 no-match branch = page-global; INV-1 |
| FR-019 (`data-gs-ignore` wins) | §2 precondition; R-8 |
| FR-020/021 (start-state, default off) | §4; folded.startActive ?? false |
| FR-022 (default unchanged) | §3 omit-table path; INV-3 |
| FR-023 (deterministic multi-match) | §2 last-match-wins; R-7 |
| FR-024 (teardown identity) | §4 shared path; INV-4 |
