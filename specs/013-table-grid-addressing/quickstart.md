# Quickstart: migrate an enrichment off physical indexing

Goal: in under 5 minutes, move one consumer from brittle physical DOM indexing
onto the canonical addressing layer so it composes correctly with sliders,
virtual columns, and sort.

## The rule of thumb

> Never touch `cell.cellIndex`, `row.cells[i]`, `table.rows[i]`, or
> `tbody tr:nth-child(i)` directly. Ask `table-grid` for the logical thing you
> mean, and read values with `cellValue`.

## Before / after

**Before** — reads the wrong cell the moment a row slider is active:

```ts
function columnValues(table: HTMLTableElement, columnIndex: number): string[] {
  const out: string[] = [];
  for (const row of Array.from(table.tBodies[0].rows)) {
    const cell = row.cells[columnIndex];        // ⚠ physical: shifts under injection
    out.push((cell?.textContent ?? '').trim()); // ⚠ may include lozenge text
  }
  return out;
}
```

**After** — correct under any composition / activation order:

```ts
import { columnCells, cellValue } from '../core/table-grid';

function columnValues(table: HTMLTableElement, columnIndex: number): string[] {
  return columnCells(table, columnIndex).map(cellValue);
}
```

## Picking the right view

- Addressing a column the **user** acts on (sort, filter, statistics, heatmap,
  lozenge placement) → **grid** view (`gridCells`, `columnCells`,
  `gridColumnCount`). Virtual columns are included.
- Reading **author source data only** (slider axis-binding, column-type
  detection) → **source** view (`sourceCells`, `sourceColumnCount`).
- Need a column index *from* a clicked header/cell → `logicalColIndexOf(cell)`
  (not `cell.cellIndex`).
- Need "which author row is this" after a sort → `logicalRowIndexOf(table, row)`.

## What you must NOT do

- Do **not** add new marker attributes or DOM. The layer is read-only so
  byte-identical teardown holds.
- Do **not** cache a column/row index across activation events — call the layer
  at use time. (Statelessness is what makes activation order irrelevant.)
- Do **not** special-case "is a slider active?" in your consumer — the layer
  already filters scaffolding; your code should look identical with or without
  sliders.

## Verifying your migration

1. Add your consumer to the composition matrix assertion in
   `src/core/__tests__/table-grid.composition.test.ts` (or rely on the generic
   per-column invariant if your consumer is column-oriented).
2. Run `yarn test` — the matrix exercises `{none,row,col,both} × {none,+cumulative,
   +sparkline} × {unsorted,sorted}` in **both** activation orders.
3. Grep your file for `cellIndex`, `.cells[`, `.rows[`, `:nth-child(` — there
   should be no live-DOM physical access left (SC-006).
