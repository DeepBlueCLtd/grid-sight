# Quickstart: Read from the Visible Row pipeline

**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md) · **Contract**: [./contracts/visible-rows-api.md](./contracts/visible-rows-api.md) · **Date**: 2026-05-19

This is the cheat-sheet for the engineer landing one of the downstream
specs (`005-sparkline`, `008-cumulative-column`, `009-copy-as-csv`,
`010-diff-compare`) and wiring it to the Row Visibility pipeline.

Time to working code: **< 5 minutes**.

---

## TL;DR

```ts
import { getVisibleRows, onVisibleRowsChange } from '../utils/visible-rows';

function attachMyEnrichment(table: HTMLTableElement) {
  // Initial render uses the current projection.
  render(table, getVisibleRows(table));

  // Re-render on every change. Listener fires synchronously, so this is
  // in the same frame as the user click that triggered the change.
  const unsubscribe = onVisibleRowsChange(table, (seq) => render(table, seq));

  // Call unsubscribe() in your teardown path.
  return unsubscribe;
}

function render(_table: HTMLTableElement, seq: VisibleRowSequence) {
  for (const { row, dimmed, sourceIndex } of seq.entries) {
    if (dimmed) continue;          // skip dimmed rows for aggregations
    // …your per-row work, in render order…
  }
}
```

That is the whole API for read-only consumers.

---

## Do

- **Read row order through `seq.entries`**, not `tbody.rows`. The two
  differ whenever sort or filter is active.
- **Skip dimmed rows for aggregations** (running totals, sparkline
  shared scale, copy-as-CSV, statistics). Dimmed rows are still in the
  DOM but the user does not want them counted in derived values.
- **Use `sourceIndex` as a stable per-row identity** across re-renders.
  It survives sort and filter changes.
- **Compare `seq.revision`** when you want a cheap "did anything
  change?" guard.
- **Unsubscribe in your teardown path** to avoid leaking listeners when
  Grid-Sight is disabled on the table.

## Don't

- **Don't read `tbody.rows` directly** — you will miss sort, and you
  will count dimmed rows.
- **Don't mutate `seq.entries`** — it is `readonly`. Make a local copy
  if you need to.
- **Don't queue your work with `setTimeout` or `queueMicrotask`** when
  the user's intent is "see the result of this click immediately".
  Re-render synchronously inside the listener.
- **Don't call `setSort` / `setFilter` from a downstream enrichment**.
  Those are reserved for `sort.ts` and `filter.ts`. If your feature
  needs to drive the projection, file a spec amendment.

---

## Common patterns

### Running total over the visible block

```ts
onVisibleRowsChange(table, (seq) => {
  let running = 0;
  for (const e of seq.entries) {
    if (e.dimmed) {
      cell(e.row, totalsColIdx).textContent = '';   // blank for dimmed
      continue;
    }
    running += readNumeric(cell(e.row, sourceColIdx));
    cell(e.row, totalsColIdx).textContent = format(running);
  }
});
```

### Copy-as-CSV "current view"

```ts
const seq = getVisibleRows(table);
const lines = seq.entries
  .filter(e => !e.dimmed)
  .map(e => Array.from(e.row.cells).map(csvEscape).join(','));
return lines.join('\n');
```

### Sparkline shared scale across rows of the visible block

```ts
const seq = getVisibleRows(table);
const visibleValues = seq.entries
  .filter(e => !e.dimmed)
  .map(e => readNumeric(cell(e.row, valueColIdx)));
const scale = { min: Math.min(...visibleValues), max: Math.max(...visibleValues) };
```

### Diff-compare "are these two tables showing the same rows in the same order?"

```ts
const a = getVisibleRows(tableA);
const b = getVisibleRows(tableB);
if (a.revision !== prevA || b.revision !== prevB) {
  recomputeDiff(a, b);
  prevA = a.revision; prevB = b.revision;
}
```

---

## Manual smoke test (no test runner needed)

1. Open any demo page that loads `dist/grid-sight.iife.js`.
2. Click the **↕** (sort) lozenge on a numeric column → rows reorder asc, then desc, then back to original on three clicks.
3. Click the **▽** (filter) lozenge on the same column → enter `100`–`500` → rows outside the range dim. Sort still applies to the un-dimmed block (US5).
4. Copy `location.href`, open in a new private window → identical view, same sort, same dim set, no flash (SC-003 + SC-004).
5. Toggle Grid-Sight off via the page-level toggle → `tbody.innerHTML` byte-identical to before init (SC-005).

If any of those fail, the feature is not done. The four steps map 1:1 to the Playwright golden flows in `tests/e2e/*.spec.ts`.

---

## Where to look in the source tree

| You want to… | File |
|--------------|------|
| Read the projection | `src/utils/visible-rows.ts` |
| Drive sort | `src/enrichments/sort.ts` |
| Drive filter | `src/enrichments/filter.ts` |
| See the lozenge wiring | `src/ui/header-utils.ts` |
| See URL persistence | `src/utils/view-state-url.ts` |
| See teardown | `src/utils/visible-rows.ts` → `teardown(table)` |
