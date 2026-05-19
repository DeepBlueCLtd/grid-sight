# Public API Contract: Virtual Columns

**Feature**: 012-virtual-columns | **Plan**: [../plan.md](../plan.md) | **Data model**: [../data-model.md](../data-model.md)

This document defines the public surface this feature adds to `window.gridSight` and the additions to `src/index.ts` ESM exports.

Per the constitution's Development-Phase Posture, the surface below is **not yet under the SemVer freeze** and may evolve in MINOR releases until the production cut. From the production cut forward, `window.gridSight.init` (already frozen) gains the new options described in §1 with that same freeze.

---

## 1. `window.gridSight.init` — new options

The existing `init` call (frozen public contract per constitution §"Performance & Distribution Constraints") gains three optional fields under a new `virtualColumns` namespace. Existing callers continue to work unchanged; passing `virtualColumns: undefined` (the default) yields the current behaviour.

```ts
interface GridSightInitOptions {
  // ...existing fields unchanged
  virtualColumns?: {
    /** Disable the entire virtual-column subsystem. Equivalent to setting
     *  data-gs-ignore on every host table for VC purposes. Default: enabled. */
    enabled?: boolean;
    /** Persist via URL fragment. Always true — SC-004 forbids localStorage
     *  for this feature. Reserved for future opt-out by host pages that
     *  manage their own URL state. Default: true. */
    persistInUrl?: boolean;
    /** Override the URL-fragment parameter name. Default: 'gs.vc'. */
    urlParam?: string;
  };
}
```

**Semantics**:

- `enabled: false` removes lozenges from every table and refuses URL restoration; URL state is preserved (so re-enabling restores the view).
- `persistInUrl: false` is documented but not user-toggleable in v1; it's reserved so a future host integration can route persistence elsewhere without an API break.
- `urlParam` is provided for hosts whose URL fragment namespace conflicts with `gs.vc`.

**Backwards compatibility**: All three fields default to the constitution-compliant behaviour. No existing call site needs to change.

---

## 2. `window.gridSight.virtualColumns` — new namespace

A small set of imperative entry points for host pages that want to drive virtual columns programmatically (analogous to the existing `window.gridSight.sliders` namespace from `001-dynamic-sliders`).

```ts
interface GridSightVirtualColumns {
  /** Activate a cumulative column. Returns the directive id, or null if the
   *  table or column is disqualified (non-numeric, opt-out attribute, etc.). */
  addCumulative(table: HTMLTableElement, colKey: string, mode?: 'sum' | 'percent'): string | null;

  /** Activate the sparkline column. Returns 'spark' on success, or null if
   *  fewer than 3 numeric columns are present or the sparkline is already
   *  active on the table. */
  addSparkline(table: HTMLTableElement, scale?: 'per-row' | 'shared'): string | null;

  /** Activate the column-compare column. Returns the directive id, or null
   *  if either column is non-numeric or a compare column is already active. */
  addCompare(table: HTMLTableElement, colKeyA: string, colKeyB: string, mode?: 'abs' | 'rel' | 'percent'): string | null;

  /** Remove a directive by id. No-op if the id is unknown. */
  remove(table: HTMLTableElement, directiveId: string): void;

  /** Remove every virtual column from the table. Leaves URL state intact;
   *  re-activation via URL or API restores them. */
  removeAll(table: HTMLTableElement): void;

  /** Enumerate the active directives on a table, in canonical order. */
  list(table: HTMLTableElement): ReadonlyArray<{ id: string; kind: VirtualColumnKind; mode?: string }>;
}

interface GridSight {
  // ...existing fields unchanged
  virtualColumns: GridSightVirtualColumns;
}
```

**Semantics**:

- Every `addX` method respects the cardinality constraints (multiple `cumulative`, single `compare`, single `sparkline`) and the qualifier rules (numeric column / ≥ 3 numeric body columns / no `data-gs-no-*` opt-out). Disqualified calls return `null` and emit no error.
- Mutating via the API immediately updates the URL fragment, just as if the user had clicked a lozenge.
- `list()` returns a frozen view; callers MUST NOT mutate it.

---

## 3. ESM exports added to `src/index.ts`

```ts
// from src/index.ts
export {
  registerVirtualColumn,        // for in-tree renderer registration (rarely needed by hosts)
} from './enrichments/virtual-column';

export type {
  VirtualColumnKind,
  VirtualColumnDirective,
  CumulativeDirective,
  CompareDirective,
  SparklineDirective,
} from './types/virtual-column';
```

These are additive; no existing exports change. The `registerVirtualColumn` function is exported primarily so third-party builds (which may tree-shake the renderers and re-add a custom one) can plug a fourth renderer in cleanly. It's not part of the IIFE surface in `window.gridSight`.

---

## 4. DOM contract

Host pages may opt out via attributes already specified by the source features. This contract is restated here for the combined feature:

| Attribute on the `<table>`    | Effect                                                                                  |
|-------------------------------|------------------------------------------------------------------------------------------|
| `data-gs-ignore`              | Suppresses the entire Grid-Sight subsystem on this table, including virtual columns.    |
| `data-gs-no-cumulative`       | Suppresses the Σ lozenge on this table. Other appended columns are unaffected.          |
| `data-gs-no-sparkline`        | Suppresses the ⌇ lozenge on this table. Other appended columns are unaffected.          |
| `data-gs-no-compare`          | Suppresses the Δ lozenge on this table. Other appended columns are unaffected.          |

Appended cells carry `data-gs-virtual-column="<kind>"` and `data-gs-virtual-column-id="<id>"` so host pages can target them in custom CSS or ignore them in serialisation.

---

## 5. URL fragment contract

See [`../data-model.md` §"Entity: PersistedVirtualColumnState"](../data-model.md#entity-persistedvirtualcolumnstate) and [`../research.md` §R-5](../research.md#r-5-url-fragment-shape) for the full grammar and decoding rules.

Two stability commitments while this feature is in MINOR-release flux:

- The fragment parameter name (default `gs.vc`) and the directive-kind prefixes (`c.`, `d.`, `t.`) are stable for the life of the feature. Any change requires a MINOR-bump with an explicit migration note.
- A URL produced by version N MUST be readable by version N+1; unknown additional fields are ignored, not errored (forward compatibility per the decoder spec in `data-model.md`).
