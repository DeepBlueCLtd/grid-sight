# Phase 1 — Data Model: Row Visibility & Order (Sort + Filter)

**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md) · **Research**: [./research.md](./research.md) · **Date**: 2026-05-19

This document fixes the in-memory shapes that the pipeline operates on
and that flow between modules. URL-fragment shapes are specified
separately in [contracts/url-fragment-schema.md](./contracts/url-fragment-schema.md);
the public read API is in [contracts/visible-rows-api.md](./contracts/visible-rows-api.md).

---

## VisibleRowEntry

The atom of the pipeline's output. One per `<tr>` in `tbody`, in render
order.

| Field | Type | Notes |
|-------|------|-------|
| `row` | `HTMLTableRowElement` | Live reference to the actual `<tr>`. Do not clone. |
| `dimmed` | `boolean` | `true` if any active filter predicate returned `false` for this row. |
| `sourceIndex` | `number` | Zero-based index into the Original Order Record. Stable for the lifetime of the table; survives sort. |

**Invariants**:
- `entries.length === tbody.rows.length` at all times.
- `entries.filter(e => !e.dimmed)` is in sort order (or original order
  if no sort is active).
- `entries.filter(e => e.dimmed)` retains relative original order.

---

## VisibleRowSequence

The full output shape, returned by `getVisibleRows(table)` and passed to
every `onChange` listener.

```ts
interface VisibleRowSequence {
  /** All rows in render order. */
  readonly entries: readonly VisibleRowEntry[];
  /** The active sort, or null if idle. */
  readonly sort: SortDirective | null;
  /** All active filter predicates, keyed by column index. AND-composed. */
  readonly filters: ReadonlyMap<number, FilterPredicate>;
  /** Monotonically increasing per-table revision counter. */
  readonly revision: number;
}
```

**Why `revision`**: Downstream consumers (especially the cumulative-
column and copy-as-CSV features) need a cheap "did anything change?"
check that survives equal-reference re-emissions; comparing `revision`
is O(1).

---

## SortDirective

```ts
interface SortDirective {
  /** Zero-based index into the column array. */
  readonly columnIndex: number;
  /** Stable column key (header text slugged via R-4). Used in URL serialisation. */
  readonly columnKey: string;
  readonly direction: 'asc' | 'desc';
}
```

**Lifecycle**:
- `null` → `{ asc }` → `{ desc }` → `null` on successive lozenge clicks
  (`002` US1 contract).
- At most one `SortDirective` per table at any time.

---

## FilterPredicate

The internal shape filter modules produce and the pipeline consumes.

```ts
interface FilterPredicate {
  readonly columnIndex: number;
  readonly columnKey: string;
  /** True if the row PASSES the filter (i.e. NOT dimmed). */
  test(row: HTMLTableRowElement): boolean;
  /** Stable serialisable form for URL persistence. Never `null`. */
  toDirective(): FilterDirective;
}

type FilterDirective =
  | { kind: 'numeric-range'; columnKey: string; min: number | null; max: number | null; hideEmpty: boolean }
  | { kind: 'categorical'; columnKey: string; allowed: readonly string[]; hideEmpty: boolean };
```

Active predicates compose with logical AND. Within a categorical popup,
the `allowed` set expresses per-column OR (as specified in `003`).

---

## OriginalOrderRecord (OOR)

```ts
type OriginalOrderRecord = readonly HTMLTableRowElement[];
```

Held in a module-scoped `WeakMap<HTMLTableElement, OriginalOrderRecord>`.
Captured exactly once per table, at first activation of either the sort
lozenge or any filter lozenge. Cleared on `teardown(table)`.

**Capture rule (FR-VP-005)**:
```ts
if (!oor.has(table)) oor.set(table, Array.from(table.tBodies[0].rows));
```

---

## PipelineState (internal)

Not part of the public API; held in a per-table closure inside
`utils/visible-rows.ts`.

```ts
interface PipelineState {
  table: HTMLTableElement;
  sort: SortDirective | null;
  filters: Map<number, FilterPredicate>;
  oor: OriginalOrderRecord | null;
  revision: number;
  listeners: Set<(seq: VisibleRowSequence) => void>;
}
```

`revision` increments before any listener fires.

---

## Computed re-evaluation flow

```text
applyChange(state, patch)
  1. mutate state.sort or state.filters per patch
  2. if state.oor is null:
       capture OOR (R-3)
  3. compute pass list:
       pass[i] = every active filter.test(oor[i]) === true
  4. compute order:
       if state.sort is null:
         renderOrder = oor.map(i)
       else:
         visible   = oor.filter((_, i) => pass[i])
         dimmed    = oor.filter((_, i) => !pass[i])  // keeps original order
         visible.sort(comparator(state.sort))
         renderOrder = mergeByOriginalIndex(visible, dimmed)
                        // re-interleave dimmed rows at their original
                        // sourceIndex positions; visible rows fill the gaps
                        // in sort order.
  5. reorder tbody DOM to match renderOrder
  6. set/clear data-gs-dimmed on each row
  7. update aria-sort on the sorted column header (if any)
  8. state.revision += 1
  9. fire listeners synchronously (R-8)
```

**`mergeByOriginalIndex` semantics** (FR-VP-004): the un-dimmed rows are
placed in sort order; the dimmed rows occupy their original positions
relative to one another. Concretely:
- Walk `oor` in original order. Each slot either belongs to a dimmed
  row (in which case the dimmed row stays there) or to a visible row
  (in which case the next visible row from the sorted list fills the
  slot).
- This means the dimmed rows act as anchors and the visible rows
  "slot in" between them in sort order. Settles US5 AS-1 precisely:
  filtering dims rows `[1, 3]`, sorting puts `[2, 4, 5]` in desc order
  through the un-dimmed slots → final order is `[2-or-4-or-5, 1, 2-or-4-or-5, 3, …]`
  with the visible slots filled descending.

---

## State transitions

| Event | Sort | Filters | OOR captured? |
|-------|------|---------|---------------|
| First sort click | `null → asc` | unchanged | Yes (if not already) |
| Second sort click | `asc → desc` | unchanged | unchanged |
| Third sort click | `desc → null` | unchanged | unchanged |
| Add filter on column N | unchanged | `filters.set(N, predicate)` | Yes (if not already) |
| Update filter on column N | unchanged | `filters.set(N, newPredicate)` | unchanged |
| Remove filter on column N | unchanged | `filters.delete(N)` | unchanged |
| Clear all filters | unchanged | `filters.clear()` | unchanged |
| URL restore on first load | applied from directive | applied from directives (before sort) | Yes (synchronously, before paint) |
| `teardown(table)` | `null` | empty | OOR restored to DOM, then cleared |

---

## Persisted View State (URL shape, summary)

Full grammar lives in
[contracts/url-fragment-schema.md](./contracts/url-fragment-schema.md).
Summary:

```text
gs.v=<table-id>(s:<colKey>:<asc|desc>)(f:<colKey>:<predicateBody>)(...)
```

Per FR-VP-007 filters are listed before sort in the directive; the
codec also reapplies them in that order on load (filters first, then
sort) so the restored view is identical to the live view.

---

## Edge-case clarifications

- **Empty tables**: pipeline emits `{ entries: [], sort: null, filters: empty, revision: ≥ 1 }`. Lozenges are not injected on empty tables (existing `header-utils` guard).
- **`rowspan`/`colspan` body cells**: per `002` and `003` edge cases, both lozenges are suppressed for columns whose body cells span rows. The pipeline still operates, but the sort comparator and filter `.test()` short-circuit on the suppressed column.
- **Zero-match filter**: `entries.every(e => e.dimmed)` is the trigger for the empty-state message (`003` US3 / new combination case). The pipeline does not own the message — `filter-chip.ts` reads `entries` and renders.
- **Multi-section tables**: only `tbody[0]` rows participate. `thead` and `tfoot` are untouched.
- **`data-gs-ignore` / `data-gs-no-sort` / `data-gs-no-filter`**: read by the lozenge injectors before they offer the affordance. Pipeline is never asked to operate on suppressed columns.
