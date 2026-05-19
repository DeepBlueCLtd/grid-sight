# Phase 1 Data Model: Virtual Columns

**Feature**: 012-virtual-columns | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This document defines every entity introduced by the virtual-column scaffold and the three renderers, their fields, their relationships, and the state transitions where applicable. All entities are **in-memory** unless explicitly tagged as persisted. The single persisted artefact is the URL fragment described in §R-5.

---

## Entity: `VirtualColumnKind`

Enumeration of renderer kinds.

```ts
type VirtualColumnKind = 'cumulative' | 'compare' | 'sparkline';
```

| Kind         | Cardinality per table | Persistence token (§R-5) |
|--------------|-----------------------|--------------------------|
| `cumulative` | 0..N                  | `c.<colKey>.<mode>`      |
| `compare`    | 0..1                  | `d.<colKeyA>.<colKeyB>.<mode>` |
| `sparkline`  | 0..1                  | `t.<scale>`              |

The cardinality constraints are enforced by the scaffold at activation time; URL parser silently ignores extras (Assumptions).

---

## Entity: `VirtualColumnDirective`

A single user-level instruction to enrich a specific table with one appended column. The directive is the unit of persistence and the unit of activation. Discriminated union by `kind`.

### `CumulativeDirective`

| Field          | Type                              | Notes                                                                 |
|----------------|-----------------------------------|-----------------------------------------------------------------------|
| `id`           | `string`                          | Stable per directive; generated as `cum-<colKey>` at activation.       |
| `kind`         | `'cumulative'`                    | Discriminator.                                                         |
| `tableEl`      | `HTMLTableElement`                | Owning table.                                                          |
| `sourceColKey` | `string`                          | Identifier of the source numeric column (from `core/type-detection`).  |
| `mode`         | `'sum'` \| `'percent'`            | Cycles `sum → percent → off` per spec US1.                             |
| `activationIndex` | `number`                       | Monotonic counter; used to preserve activation order within `cumulative` (FR-VC-003).  |

### `CompareDirective`

| Field         | Type                                       | Notes                                                                                  |
|---------------|--------------------------------------------|----------------------------------------------------------------------------------------|
| `id`          | `string`                                   | `cmp-<colKeyA>-<colKeyB>`.                                                              |
| `kind`        | `'compare'`                                | Discriminator.                                                                          |
| `tableEl`     | `HTMLTableElement`                         | Owning table.                                                                           |
| `colKeyA`     | `string`                                   | First-picked numeric column.                                                            |
| `colKeyB`     | `string`                                   | Second-picked numeric column.                                                           |
| `mode`        | `'abs'` \| `'rel'` \| `'percent'`          | Display mode (FR-013 of `010-diff-compare`).                                            |

### `SparklineDirective`

| Field         | Type                                       | Notes                                                                                  |
|---------------|--------------------------------------------|----------------------------------------------------------------------------------------|
| `id`          | `string`                                   | Always `spark` (cardinality-1).                                                         |
| `kind`        | `'sparkline'`                              | Discriminator.                                                                          |
| `tableEl`     | `HTMLTableElement`                         | Owning table.                                                                           |
| `scale`       | `'per-row'` \| `'shared'`                  | Default `per-row`; toggleable per US5.                                                  |
| `style`       | `'bar'`                                    | v1 supports `bar` only; reserved in the persisted state for forward compatibility.       |

### Validation rules

- A `CumulativeDirective` is invalid (silently dropped on URL restore) if `sourceColKey` is not present in `tableEl` or the column is not numeric per `core/type-detection`.
- A `CompareDirective` is invalid if either column is missing or non-numeric.
- A `SparklineDirective` is invalid if the table has fewer than 3 predominantly-numeric body columns (FR-002 of `005-sparkline`).
- Any directive on a table carrying `data-gs-ignore` is dropped (FR-VC-013).
- A `CumulativeDirective` is dropped if the table carries `data-gs-no-cumulative` (analogous for compare / sparkline).

### State transitions (US1 lifecycle, per directive kind)

```text
cumulative:  ∅  --Σ click-->  sum  --Σ click-->  percent  --Σ click-->  ∅
sparkline:   ∅  --⌇ click--> per-row  --mode toggle--> shared  --mode toggle--> per-row
                                ⌇ click on the lozenge again --> ∅
compare:     ∅  --Δ click--> picking-A  --click colA--> picking-B  --click colB--> active
                                                                    --Δ click again--> ∅
```

State transitions are owned by the relevant lozenge handler in `ui/virtual-column-lozenges.ts`. The scaffold sees only the resulting Directive create / mutate / remove calls.

---

## Entity: `AppendedColumnRecord`

Represents the injected DOM for one active directive — the materialisation of the directive in the host table.

| Field          | Type                              | Notes                                                                                       |
|----------------|-----------------------------------|---------------------------------------------------------------------------------------------|
| `directiveId`  | `string`                          | Foreign key to `VirtualColumnDirective.id`.                                                  |
| `headerCells`  | `HTMLTableCellElement[]`          | Every appended `<th>` (one per header row).                                                  |
| `bodyCells`    | `Map<HTMLTableRowElement, HTMLTableCellElement>` | Per-row appended `<td>`. Keyed by row to survive sort/filter reflows.                        |
| `footerCells`  | `HTMLTableCellElement[]`          | Empty appended `<td>` per `<tfoot>` row, for column alignment.                               |
| `position`     | `number`                          | 0-based offset from the table's rightmost original column at the time of last render.        |

Records are owned exclusively by the scaffold. Renderers receive the record as an argument to `render(record, sequence)` and write into the per-cell nodes; they MUST NOT mutate `position` or the `headerCells` / `bodyCells` / `footerCells` collections directly.

---

## Entity: `VirtualColumnRegistry`

Per-table state held by the scaffold.

| Field             | Type                                       | Notes                                                                  |
|-------------------|--------------------------------------------|------------------------------------------------------------------------|
| `tableEl`         | `HTMLTableElement`                         | The owning table.                                                       |
| `tableKey`        | `string`                                   | Stable identity (DOM `id` if present; else hash from `sync-key.ts`).    |
| `directives`      | `VirtualColumnDirective[]`                 | Active directives, in canonical left-to-right order (R-2).              |
| `records`         | `Map<string, AppendedColumnRecord>`        | Keyed by `directive.id`.                                                |
| `numericColumns`  | `Set<string>`                              | Cached numeric-column key set from `core/type-detection` (R-6).         |
| `rowSubscription` | `() => void`                               | Unsubscribe handle from `getVisibleRows(table).subscribe(...)` (R-3).   |

Lookup: `tableContexts: WeakMap<HTMLTableElement, VirtualColumnRegistry>` (R-11).

### Canonical-order invariant

`registry.directives` MUST always satisfy: every `cumulative` (sorted by `activationIndex` ascending) → optional `compare` → optional `sparkline`. The scaffold enforces this on every mutation (create, remove, URL restore) by sorting in-place.

---

## Entity: `Renderer<Directive>`

The contract every per-feature renderer implements. See `contracts/registry-api.md` for the exact TypeScript signatures.

```ts
interface Renderer<D extends VirtualColumnDirective> {
  readonly kind: D['kind'];
  /** Header text shown in the appended <th>. Pure; called once per render. */
  headerText(directive: D): string;
  /** Called once per cell after the scaffold creates the per-row <td>. May
   *  build child nodes (e.g. <svg>) and write text. Pure where possible. */
  renderCell(directive: D, td: HTMLTableCellElement, rowEl: HTMLTableRowElement, sequence: VisibleRowEntry[], rowIndex: number): void;
  /** Called when the visible-row pipeline emits a change. Renderer may
   *  recompute and patch <td> children in place. */
  onPipelineChange(directive: D, record: AppendedColumnRecord, sequence: VisibleRowEntry[]): void;
  /** Called once at detach for any renderer-local cleanup. */
  onDetach?(directive: D, record: AppendedColumnRecord): void;
  /** CSV/TSV exporter for the copy-as-CSV registry (R-4). */
  exporter(directive: D): VirtualColumnExport;
}
```

Renderers are registered with the scaffold at module load via `registerRenderer(renderer)`. The registration is idempotent and global (one renderer per kind across all tables).

---

## Entity: `PersistedVirtualColumnState`

The single URL-fragment artefact. Schema (R-5):

```text
gs.vc = <table-block>(";" <table-block>)*
<table-block> = <table-key> ":" <directive-token>("," <directive-token>)*
<directive-token> = <cumulative-token> | <compare-token> | <sparkline-token>
<cumulative-token> = "c." <colKey> "." ("s"|"p")
<compare-token>    = "d." <colKeyA> "." <colKeyB> "." ("a"|"r"|"p")
<sparkline-token>  = "t." ("r"|"s")
```

Encoding rules:

- Tokens within a `<table-block>` are emitted in canonical order (cumulative-by-activation, compare, sparkline).
- `<colKey>` is URL-safe; it is derived from the column's header text by `slugify` (lowercase, non-alphanumeric → `-`, deduplicated). Collision within a table is impossible because the heatmap/statistics detector already requires unique numeric-column keys.
- The whole fragment value is `encodeURIComponent`-d before assembly to keep `=` / `&` / `#` safe.

Decoding rules:

- Unknown directive prefixes (e.g. a future `e.` for an enrichment we haven't designed) are ignored, not errored.
- Per-token invalidity (e.g. missing `colKey`, unknown mode letter) drops the token, not the whole fragment.
- Duplicate cumulative tokens for the same `colKey` keep the **last** one (per the "URL parser ignores extras silently" Assumption).
- Multiple compare or sparkline tokens for the same table keep the **first** one.
- Re-canonicalisation runs after parse (R-2, FR-VC-010).

Worst-case size: a page with 10 tables, each carrying 10 cumulative + 1 compare + 1 sparkline directive with average 10-char column keys produces ~1.6 kB of URL fragment text — well inside browser fragment limits.

---

## Entity: `VirtualColumnExport`

The interface every renderer hands to the copy-as-CSV registry (R-4).

| Field         | Type                                                | Notes                                                                  |
|---------------|-----------------------------------------------------|------------------------------------------------------------------------|
| `headerText`  | `string`                                            | The same string the renderer wrote into the appended `<th>`.            |
| `getCellText` | `(rowEl: HTMLTableRowElement) => string`            | Returns the cell's CSV/TSV text for the given source row. May return `''` for non-numeric / placeholder cells. |

For the sparkline renderer, `getCellText` returns the row's min/max/last triple as `"min:<n>;max:<n>;last:<n>"` (or `''` if the row was incomplete). This is the same payload the tooltip already exposes; users opting into "include GS virtual columns" get a parseable, lossless text form.

---

## Entity relationships

```text
HTMLTableElement
  └── (1:1) VirtualColumnRegistry          [WeakMap key]
        ├── (1:N) VirtualColumnDirective   [discriminated union by kind]
        │     └── (1:1) AppendedColumnRecord
        │           ├── headerCells: <th>[]
        │           ├── bodyCells:   <td>[] (keyed by row)
        │           └── footerCells: <td>[]
        └── (1:1) VisibleRowSubscription   [from utils/visible-rows.ts]

global
  ├── (1:1 per kind) Renderer<Directive>
  └── (1:1) PersistedVirtualColumnState    [URL fragment, all tables]
```

---

## Edge-case mappings

This data model directly supports every edge case enumerated in spec §"Edge Cases":

| Edge case (from spec)                                                | Model element                                                                         |
|----------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| Sparkline qualifier `≥ 3 numeric body columns`                       | `SparklineDirective` validation rule; checked against `registry.numericColumns`.       |
| Sparkline incomplete row → em-dash                                   | `Renderer.renderCell` returns an em-dash placeholder when the row's numeric set < 1.   |
| Sparkline zero-range row → flat baseline                             | `sparkline-svg.ts` builds `<rect>` with `y = baseline, height = 1px`.                  |
| Cumulative non-numeric cells skipped, virtual cell blank             | `Renderer.renderCell` writes `''`; `getCellText` likewise returns `''`.                |
| Cumulative + sparkline ordering                                      | `VirtualColumnRegistry` canonical-order invariant.                                     |
| Compare non-numeric operand → "—" placeholder                        | `Renderer.renderCell` writes `'—'`.                                                    |
| Compare zero divisor for percent                                     | `Renderer.renderCell` writes `'—'` when divisor is 0.                                  |
| `data-gs-ignore` opt-out                                             | Scaffold refuses to install on tables with the attribute.                              |
| `data-gs-no-{sparkline,cumulative,compare}` opt-out                  | Lozenge installer for the matching kind skips the table.                               |
| Toggle Grid-Sight off → byte-identical DOM                           | Reverse-insertion-order detach in scaffold (R-12).                                     |
| `colgroup` / `col` do not apply to appended columns                  | Appended cells are not enumerated by `<colgroup>`; scaffold does not synthesise them.  |
| `rowspan` / `colspan` on body cells suppress offering                | Scaffold validation rejects the table for cumulative; sparkline qualifier handles its case.  |
| URL order conflict → re-canonicalise                                 | Re-sort post-parse per canonical-order invariant.                                       |
| Visible-row pipeline events fire once per frame                      | Scaffold's `requestAnimationFrame` fan-out (R-9).                                       |
| Copy-as-CSV registry registration / deregistration                   | `VirtualColumnExport` + `register…ForCopy` / `unregister…ForCopy` in scaffold detach.   |
