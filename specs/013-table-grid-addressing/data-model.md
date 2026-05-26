# Phase 1 Data Model: Canonical Table-Grid Addressing Layer

This feature introduces **no persisted data** and **no new DOM**. The "model"
is a set of conceptual entities the addressing layer projects over the live
table, plus the invariants that define correctness. All entities are computed
on demand from the DOM + existing markers.

## Entities

### Logical Grid

The stable coordinate space shared by all enrichments: the author's data as it
existed before any enrichment, **plus** virtual columns appended at the right.

- Composed of: one **header row** + ordered **body rows**.
- Columns: `sourceColumnCount` source columns `[0 … s-1]` followed by
  `virtualColumnCount` virtual columns `[s … s+v-1]`.
- Derivation: live DOM filtered by markers (see Classification Rules).
- Lifetime: not stored; recomputed per query.

### Logical Coordinate

A `(row, col)` pair in the logical space.

- `col ∈ [0, sourceColumnCount + virtualColumnCount)`.
- `row` identity: position in the **Original Order Record** when present, else
  current body order (see Logical Row Identity).
- Independent of current physical DOM position (survives sort reorder, slider
  injection, virtual-column append).

### Source Column

A column supplied by the author. Excludes virtual columns and scaffolding.
Used by: slider axis-binding, column-type detection, "author data only" reads.

### Virtual Column

A Grid-Sight-computed column (`cumulative` | `sparkline` | `compare`), marked
`data-gs-virtual-column` (+ `data-gs-virtual-column-id`). **Addressable** as a
logical column; ordered after all source columns. Not author source data.

### Scaffolding Node

An injected row or cell marked `data-gs-injected` that exists only to host
slider chrome (corner readout, column-slider slot, row-slider slot, row-slider
header cell). **Never** part of the logical grid; excluded from every
enumeration and count.

### Original Order Record (OOR) — *existing, reused*

`src/utils/original-order.ts`: a `WeakMap<HTMLTableElement, readonly HTMLTableRowElement[]>`
capturing the author row sequence once at first sort/filter activation. The
addressing layer **reads** it (`getRecord`) for row identity; it neither
captures nor clears it (the visible-rows pipeline owns its lifecycle).

## Classification Rules

Given a live table:

1. **Scaffold row**: a `<tr>` with `data-gs-injected`. Excluded from header and
   body row sets.
2. **Header row**: the first non-scaffold row, per `original-order.ts::getDataRows`
   header heuristic (first row of the implicit/`tbody` block containing a `<th>`,
   or row 0 of `<thead>`).
3. **Body rows**: non-scaffold rows after the header row, excluding `<tfoot>`
   rows. Dimmed (filtered) rows remain in the set.
4. **Scaffold cell**: a cell with `data-gs-injected`. Excluded from every cell
   view, per row.
5. **Source cell**: a non-scaffold cell that is **not** `data-gs-virtual-column`.
6. **Virtual cell**: a non-scaffold cell with `data-gs-virtual-column`.
7. **Grid cell**: source cell ∪ virtual cell (non-scaffold), in DOM order →
   source columns first, virtual columns last (by the append convention).

## Invariants (the correctness contract)

- **INV-1 (identity)**: With no `data-gs-injected` and no `data-gs-virtual-column`
  present, every query equals naive physical indexing.
- **INV-2 (rowspan safety)**: For any source column `K` and any two body rows
  `r1, r2`, `columnCells(K)` yields the author cell that is the K-th source cell
  of `r1` and of `r2` respectively — even when `r1` carries an injected
  `rowspan` scaffold cell and `r2` does not.
- **INV-3 (order independence)**: Every query result depends only on the current
  DOM + markers, never on activation order. (Guaranteed structurally:
  statelessness — no memoised indices.)
- **INV-4 (source ⊆ grid)**: `sourceCells(row)` is a prefix of `gridCells(row)`;
  `sourceColumnCount ≤ gridColumnCount`.
- **INV-5 (row identity stability)**: After a sort reorders the DOM,
  `logicalRowIndexOf(row)` is unchanged for every row (equals its OOR index).
- **INV-6 (no DOM footprint)**: No query mutates the DOM or adds any node, class,
  or attribute. Teardown remains byte-identical.
- **INV-7 (explicit OOB)**: A coordinate outside the grid yields `null` / empty,
  never a wrong-but-plausible cell.
- **INV-8 (value purity)**: `cellValue(cell)` excludes Grid-Sight-injected UI;
  for a cell containing only author text it equals `textContent.trim()`.

## State transitions

None. The layer is stateless. The *table* transitions through enrichment
activation/teardown, but those transitions are owned by the enrichments; the
layer merely observes the current state.

## Validation rules (from requirements)

| Rule | Source |
|------|--------|
| Scaffold excluded from all enumerations | FR-003 |
| Virtual columns addressable, ordered last | FR-004 |
| Header + body row access excludes scaffold & footer | FR-005 |
| Two cell views (grid / source) | FR-006 |
| Rowspan-safe per-row column access | FR-007, INV-2 |
| Bidirectional translation present | FR-008 |
| Row identity from OOR after sort | FR-009, INV-5 |
| `cellValue` ignores injected UI | FR-010, INV-8 |
| No new DOM/markers | FR-011, INV-6 |
| Identity when un-enriched | FR-012, INV-1 |
| OOB → explicit not-found | FR-015, INV-7 |
