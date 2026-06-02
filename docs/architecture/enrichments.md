# Enrichment architecture

How Grid-Sight discovers tables, decides which enrichments are allowed, and
mounts each enrichment's affordance — and the single contract you implement to
add a new one.

> Status: current architecture. Every enrichment — classic lozenges (heatmap,
> sliders, statistics, frequency, frequency-chart, sort, filter) and the three
> virtual columns — registers a descriptor and is mounted by the single
> injection pass. The legacy scattered-metadata / dual-injection model
> ([Appendix A](#appendix-a--legacy-model-removed)) has been removed. New
> enrichments MUST use the descriptor model.

---

## 1. Vocabulary

- **Enrichment** — a feature that augments a table: heatmap, sliders,
  statistics popup, frequency table/chart, column sort, column filter, and the
  three *virtual columns* (cumulative, sparkline, compare).
- **Capability** — whether an enrichment is *allowed* on the current page for
  the current visitor. Owned by the capability-filtering system (spec
  012-capability-filtering): page config + visitor override + library
  defaults resolve to an **effective enabled set**.
- **Affordance** — the on-table control that activates an enrichment: a lozenge
  button (Σ, ⌇, Δ, ↕, ▽, H, S, #, …) in a header's lozenge cluster, or a
  corner-cluster control.
- **Descriptor** — the single object that declares everything about one
  enrichment (see §3). One descriptor per enrichment is the whole contract.

---

## 2. Runtime flow (one pass)

```text
gridSight.init(options)
  ├─ resolve capability:  pageConfig ⊕ visitorOverride ⊕ defaults
  │                       → effective enabled set           (core/enabled-set-state)
  ├─ for each detected table:
  │     processTable → mark GS-enabled, attach the per-table GS toggle
  │     mountEnrichments(table)            ← THE single injection pass
  │         for each descriptor in the catalog:
  │             skip unless  shipped ∧ enabled ∧ descriptor.appliesTo(ctx)
  │             descriptor.mount(ctx) → places the affordance
  └─ restoreFromUrl()  (sort/filter/virtual-column directives)

Visitor ticks/unticks a box in the toggle panel
  → recompute effective enabled set
  → for newly-disabled ids: descriptor.tearDown(table)
  → mountEnrichments(table)   (re-mounts the now-allowed set; removes the rest)
```

Key invariant: **there is exactly one injection pass** (`mountEnrichments`).
Every enrichment — classic lozenge or virtual column — is mounted by it, gated
by the same capability check, and torn down by the same path. There is no
second, ungated injection route.

---

## 3. The descriptor contract

A descriptor is declared in the **catalog** (`core/enrichment-registry.ts`).
Capability-only fields are always present; behavior fields are present once the
enrichment ships.

```ts
interface EnrichmentDescriptor {
  /* ── Identity & capability (always present) ─────────────────────── */
  id: string;            // lower-kebab, unique, matches /^[a-z][a-z0-9-]*$/
  label: string;         // shown in the toggle panel
  defaultOn: boolean;    // in the default enabled set when no config/override
  shipped: boolean;      // has a real implementation in this build

  /* ── Behavior (present iff shipped) ─────────────────────────────── */
  appliesTo?(ctx: AffordanceContext): boolean;  // is this affordance relevant here?
  mount?(ctx: AffordanceContext): HTMLElement | null; // build + return the lozenge
  isActive?(ctx: AffordanceContext): boolean;   // toggle/menu checked state
  tearDown?(table: HTMLTableElement): void;      // remove all of this enrichment's output

  /* ── Optional integrations ──────────────────────────────────────── */
  persist?: UrlFragmentCodec;        // share-via-URL hook (sort/filter/virtual-columns)
  exportColumn?: CsvColumnExporter;  // copy-as-CSV hook (virtual columns)
}

interface AffordanceContext {
  table: HTMLTableElement;
  header: HTMLTableCellElement;          // the host header cell
  headerType: 'row' | 'column' | 'table';
  colIndex: number;
  columnType: 'numeric' | 'categorical';
}
```

### Spec-only descriptors (forward-compat)

An enrichment that is *specced but not yet built* is a descriptor with
`shipped: false` and **no behavior fields**. It stays in the catalog so a page
config naming it (`enrichments: ['outlier']`) is forward-compatible, but the
toggle panel renders no checkbox and `mountEnrichments` skips it. When the
implementation lands, the same PR flips `shipped: true` and fills in the
behavior fields — see the checklist in §6.

This is why the catalog is a **static declaration** rather than a registry
populated purely by self-registration: a spec-only id like `units-toggle` has
no module to self-register from yet.

The `copy-as-csv` enrichment (spec 009) shipped this way: a table-level corner
lozenge (`⎘`, `src/ui/copy-csv-lozenge.ts`) opens a popup that serialises the
*current visible view* (`visibleBodyRows` + the `table-grid` reader + the
`copy-as-csv-registry` virtual-column exporters) to CSV / TSV / Markdown
(`src/enrichments/csv-serialize.ts`), writes it to the clipboard (textarea
fallback when unavailable), and persists the chosen format + options per page
in the URL (`gs.cp`, `src/utils/copy-persistence.ts`).

---

## 4. Capability filtering (unchanged by this model)

Resolution precedence (spec 012-capability-filtering, R-3; extended by spec
015-welcome-per-table-options):

```text
visitor override  >  per-table options  >  page config  >  library defaults (defaultOn)
```

- `core/effective-enabled-set.ts` — the pure resolver. The optional
  `perTableEnrichments` tier sits between visitor and page; when omitted,
  resolution is byte-for-byte the pre-015 behaviour.
- `core/per-table-options.ts` — matches a table against `pageConfig.tables`
  (by id/CSS selector), folds matches last-match-wins per field, and resolves
  the per-table enrichment set. `data-gs-ignore` tables never match.
- `core/enabled-set-state.ts` — module-scoped holder; **table-aware**
  `isEnrichmentEnabled(id, table?)` / `getEffectiveEnabledSet(table?)`. With no
  table (or a table matched by no entry) it returns the page-global set; with a
  matched table it returns that table's resolved set (cached per table in a
  `WeakMap`, rebuilt on `setPageConfig`/`setVisitorOverride`). Lazy first-access
  compute avoids load-order cycles.
- `ui/toggle-panel.ts` — the runtime opt-in panel. Renders one checkbox per
  **shipped** descriptor; on change, runs `tearDown` for newly-disabled ids and
  re-runs `mountEnrichments`.

`mountEnrichments` and the toggle panel both read the **same** descriptors, so a
capability can never be enforced in one place and leak in another.

---

## 5. Virtual columns are a *category*, not a special case

The three virtual columns (cumulative, sparkline, compare) share a single
**scaffold** (`enrichments/virtual-column.ts`) that owns right-edge
`<th>`/`<td>`/`<tfoot>` append + detach, canonical ordering, URL persistence,
copy-as-CSV registration, and the visible-row-pipeline fan-out. See
[`specs/012-virtual-columns/`](../../specs/012-virtual-columns/).

In the descriptor model each of the three registers its own descriptor whose
`mount` delegates into the scaffold (activate a directive) and whose `tearDown`
calls `removeDirectivesByKind(table, kind)`. They are gated, listed, and torn
down by the same machinery as every other enrichment. The scaffold remains the
shared engine; it is **not** a parallel registration path.

Mapping (registry id ↔ scaffold kind):

| Registry id    | Scaffold kind | Lozenge | Source spec |
|----------------|---------------|---------|-------------|
| `cumulative`   | `cumulative`  | Σ       | 008         |
| `sparkline`    | `sparkline`   | ⌇       | 005         |
| `diff-compare` | `compare`     | Δ       | 010 (column-mode) |

---

## 6. Adding a new enrichment (the whole checklist)

1. **Catalog entry** — add (or flip the existing spec-only stub in)
   `core/enrichment-registry.ts`: `{ id, label, defaultOn, shipped: true }`.
2. **Behavior** — register the descriptor's behavior from the enrichment's own
   module: `appliesTo`, `mount`, `isActive` (if it's a toggle), `tearDown`, and
   any `persist` / `exportColumn` hooks.
3. **Self-register at import** — the enrichment module calls
   `registerEnrichment(descriptor)` at load; ensure it is imported (directly or
   transitively) from `src/index.ts` so it registers before `init()`.
4. **Tests** — unit-test the enrichment's logic; add a Storybook interaction
   test for the affordance; add an e2e if it has a cross-feature flow. The
   capability-filtering tests pick up the new id automatically from the catalog.
5. **Docs** — if it introduces a new *category* (like virtual columns), note it
   in §5; otherwise no doc change is needed.

You do **not** touch the injection pass, the toggle panel, the menu, or the
capability resolver — they are all descriptor-driven.

---

## 7. File map

| Concern | File |
|---|---|
| Catalog + descriptor registry | `src/core/enrichment-registry.ts` |
| Capability resolver (pure) | `src/core/effective-enabled-set.ts` |
| Effective-set holder + `isEnrichmentEnabled` | `src/core/enabled-set-state.ts` |
| Single injection pass (`mountEnrichments`) + classic descriptors | `src/ui/header-utils.ts` |
| Runtime opt-in panel | `src/ui/toggle-panel.ts` |
| Per-table GS toggle | `src/ui/toggle-injector.ts` |
| Virtual-column scaffold (shared engine) | `src/enrichments/virtual-column.ts` |
| Virtual-column descriptors | `src/ui/virtual-column-lozenges.ts` |

---

## Appendix A — legacy model (removed)

Before the descriptor model, enrichment metadata was duplicated across five
sites that had to be hand-synced, with two separate injection paths:

1. `core/enrichment-registry.ts` — id/label/defaultOn/shipped + tearDown.
2. `ui/header-utils.ts` — an inline `LozengeSpec[]` literal hardcoding which
   lozenges to build per column type (its own `id` union). **Removed** —
   classic lozenges now register descriptors; `LozengeSpec` survives only as a
   private helper shape for `buildLozenge`.
3. `ui/enrichment-menu.ts` — `ENRICHMENT_ITEMS`, a third metadata list with
   `availableFor` / `predicate` / `isActive`. **Removed** — the dropdown menu
   it backed was already dead (replaced by inline lozenges); the file is
   deleted.
4. `enrichments/virtual-column.ts` — a renderer registry (`registerRenderer`)
   keyed by virtual-column kind. **Retained by design**: this is the
   virtual-column *rendering engine* (append/detach/ordering/persistence), not
   an affordance-registration path. The affordance now registers a descriptor
   like everything else (§5).
5. `ui/virtual-column-lozenges.ts` — hardcoded Σ/⌇/Δ injection that bypassed
   capability filtering and mounted at `init()` rather than on GS-enable.
   **Replaced** by descriptor `mount(ctx)` builders gated by the single pass.

Symptoms this caused: the three `id` unions drifted; virtual-column lozenges
appeared even when their capability was off; and they mounted on a different
lifecycle than every classic lozenge. Collapsing 1–5 into one declaration and
one injection pass removed all three.
