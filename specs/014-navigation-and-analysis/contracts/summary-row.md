# Contract: `summary-row` enrichment

**Id**: `summary-row` · **Label**: "Summary row" · **Scope**: table-level,
auto-rendered (no lozenge) · **Persisted**: yes (per-column aggregate choice).

## Module: `src/enrichments/summary-row.ts`

```typescript
export type Aggregate = 'sum' | 'avg' | 'min' | 'max' | 'count';

/** Inject the summary <tfoot> row, restore persisted choices, subscribe to
 *  visible-rows changes. Idempotent. */
export function applySummaryRow(table: HTMLTableElement): void;

/** Unsubscribe + remove the injected footer. Byte-identical teardown. */
export function removeSummaryRow(table: HTMLTableElement): void;

/** Pure: compute one aggregate over a numeric value list (blanks already
 *  excluded by the caller). `count` is handled by the caller (counts non-blank). */
export function aggregate(values: number[], kind: Aggregate): number;
```

- Footer is one `<tfoot>` row; every cell is `data-gs-injected` and aligned to
  logical columns via the addressing layer.
- Default aggregate: `sum` for numeric columns, `count` for non-numeric.
- Numeric aggregates exclude blank/non-numeric cells; `count` counts non-blank.
- Subscribes via `onVisibleRowsChange(table, …)`; recomputes all cells on change.

## Module: `src/ui/summary-row-control.ts`

```typescript
/** Per-cell aggregate chooser (keyboard-operable <button>/<select>); calls
 *  onChange with the new Aggregate. */
export function mountAggregateControl(
  cell: HTMLTableCellElement,
  current: Aggregate,
  numeric: boolean,
  onChange: (next: Aggregate) => void,
): void;
```

## Persistence (reuse `src/utils/slider-persistence.ts`)

```text
key:   gs:<url-stem>:summary:<table-key>      (via storageKeyFor)
value: { version: 1, choices: { [logicalColIndex]: Aggregate } }
```

try/catch; malformed ⇒ ignored; one `console.warn` if storage unavailable; no
network.

## Registry + index wiring

```typescript
// enrichment-registry.ts
{ id: 'summary-row', label: 'Summary row', defaultOn: true, shipped: true,
  apply: applySummaryRow, tearDown: removeSummaryRow }
// index.ts (processTable)
if (isEnrichmentEnabled('summary-row')) { try { applySummaryRow(table); } catch (e) { void e; } }
```

## Behaviour contract

| Given | When | Then |
|-------|------|------|
| numeric column | rendered | footer shows sum over visible rows (hand-checked) |
| sum showing | choose "average" | cell = mean of visible; choice persists on reload |
| filter changes visible set | apply/clear | every cell recomputes, no reload |
| non-numeric/blank cells | sum/avg/min/max | excluded; `count` counts non-blank |
| disabled via toggle | tearDown | footer removed, byte-identical; re-enable restores footer + choices w/o reload |
