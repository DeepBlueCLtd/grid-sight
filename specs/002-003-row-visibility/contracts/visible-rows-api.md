# Contract: `utils/visible-rows.ts` public surface

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Data model**: [../data-model.md](../data-model.md) · **Date**: 2026-05-19

This is the **only** sanctioned read-channel for row order and row
visibility (FR-VP-002). Every downstream feature (`005-sparkline`,
`008-cumulative-column`, `009-copy-as-csv`, `010-diff-compare`) consumes
this contract; nothing else reads `tbody.rows` directly.

Stable for spec v1 under the Development-Phase Posture — MAY change
before production, but only by a PR that updates this file and every
downstream consumer in the same commit.

---

## Exports

```ts
// From src/utils/visible-rows.ts

export interface VisibleRowEntry {
  readonly row: HTMLTableRowElement;
  readonly dimmed: boolean;
  readonly sourceIndex: number;
}

export interface SortDirective {
  readonly columnIndex: number;
  readonly columnKey: string;
  readonly direction: 'asc' | 'desc';
}

export interface FilterPredicate {
  readonly columnIndex: number;
  readonly columnKey: string;
  test(row: HTMLTableRowElement): boolean;
  toDirective(): FilterDirective;
}

export type FilterDirective =
  | { readonly kind: 'numeric-range'; readonly columnKey: string; readonly min: number | null; readonly max: number | null; readonly hideEmpty: boolean }
  | { readonly kind: 'categorical'; readonly columnKey: string; readonly allowed: readonly string[]; readonly hideEmpty: boolean };

export interface VisibleRowSequence {
  readonly entries: readonly VisibleRowEntry[];
  readonly sort: SortDirective | null;
  readonly filters: ReadonlyMap<number, FilterPredicate>;
  readonly revision: number;
}

/** Read the current Visible Row Sequence for a table. Idempotent / cheap. */
export function getVisibleRows(table: HTMLTableElement): VisibleRowSequence;

/** Subscribe to pipeline changes. Listener fires synchronously after every re-evaluation. */
export function onVisibleRowsChange(
  table: HTMLTableElement,
  listener: (seq: VisibleRowSequence) => void
): () => void;

/** Apply a sort directive. Pass `null` to clear sort. */
export function setSort(table: HTMLTableElement, directive: SortDirective | null): void;

/** Apply, update, or remove a filter predicate. */
export function setFilter(table: HTMLTableElement, columnIndex: number, predicate: FilterPredicate | null): void;

/** Clear every active filter on a table. Sort is untouched. */
export function clearFilters(table: HTMLTableElement): void;

/** Restore byte-identical DOM and forget per-table state (idempotent). */
export function teardown(table: HTMLTableElement): void;
```

---

## Behaviour guarantees

1. **`getVisibleRows` is synchronous and cheap**. It returns the cached
   `VisibleRowSequence` from the most recent re-evaluation — no
   recomputation, no DOM walk.

2. **`onVisibleRowsChange` fires synchronously** after every successful
   `setSort` / `setFilter` / `clearFilters` / URL-restore call, before
   control returns to the caller. The listener receives the same
   `VisibleRowSequence` instance that the next `getVisibleRows` call
   will return.

3. **`setSort(table, null)` is a no-op if sort is already idle**. Same
   for `setFilter` removing an absent filter. No spurious events.

4. **`teardown` is idempotent**. Calling it on a table that was never
   touched is a no-op (no `tbody` mutation).

5. **`revision` strictly increases** with every emission, even when
   `entries` is reference-equal to the prior emission.

6. **All public functions accept the live `HTMLTableElement`** — no
   string-id lookup at this layer (the top-level `window.gridSight`
   wrappers in `src/index.ts` do that translation, mirroring how
   sliders work in spec 001).

7. **No public function throws** for benign cases (missing column,
   missing table state). They return / no-op silently, matching the
   "directive for missing column → silently dropped" rule in the spec.
   Programmer errors (passing `null` for `table`, non-numeric
   `columnIndex`) MAY throw `TypeError`.

---

## Wiring expectations

- `sort.ts` and `filter.ts` are the **only writers**. They call
  `setSort` / `setFilter` from lozenge / popup event handlers and from
  the URL-restore path.
- `index.ts` adds NO new top-level `window.gridSight.*` for v1 — the
  feature is wholly DOM-driven (lozenges + URL). The visible-rows API
  is module-internal until a downstream feature ships that needs to
  expose it programmatically. (This is a deliberate conservative move
  per Development-Phase Posture: the surface is reserved internally,
  promoted to `window.gridSight` only on first programmatic consumer.)
- Downstream specs (`005`, `008`, `009`, `010`) MUST `import` the API
  from `utils/visible-rows.ts` rather than read `tbody.rows`.

---

## Non-goals (out of contract)

- **Async re-evaluation**: pipeline is sync. Consumers that need to
  defer their own work to a frame MUST use their own `requestAnimationFrame`.
- **Per-event diff**: listeners get the whole sequence; comparing
  `revision` is the cheap "changed?" probe.
- **Custom sort comparators**: not in v1 (spec Assumptions). The
  comparator is internal.
- **Row removal**: filter dims; it does not remove. There is no API to
  "hide" a row.
