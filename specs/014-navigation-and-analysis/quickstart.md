# Quickstart: ship a toggleable enrichment from this feature (< 10 min)

This walks the **integration spine** every piece of spec 014 shares, using
`summary-row` (an auto-rendered enrichment) as the worked example. The full
checklist is `docs/adding-an-enrichment.md` — this is the fast path.

## 1. Logic module (`src/enrichments/summary-row.ts`)

```typescript
import { gridRows, columnCells, cellValue, sourceColumnCount } from '../core/table-grid';
import { getVisibleRows, onVisibleRowsChange } from '../utils/visible-rows';
// apply/tearDown + pure aggregate() — see contracts/summary-row.md
```

Read **visible** rows (`getVisibleRows(table).current()`), address columns via
the table-grid layer, mark injected nodes `data-gs-injected`.

## 2. Registry entry (`src/core/enrichment-registry.ts`)

```typescript
import { applySummaryRow, removeSummaryRow } from '../enrichments/summary-row';
{ id: 'summary-row', label: 'Summary row', defaultOn: true, shipped: true,
  apply: applySummaryRow, tearDown: removeSummaryRow },
```

`apply` is mandatory for auto-rendered enrichments — it is what makes the
**off → on toggle restore without a reload** (checklist §3).

## 3. Apply wiring (`src/index.ts`, inside `processTable`)

```typescript
if (isEnrichmentEnabled('summary-row')) {
  try { applySummaryRow(table); } catch (e) { void e; }
}
```

Gating here (not at page init) is what keeps it dark when Grid-Sight is globally
off (checklist §2, FR-015).

## 4. Recompute on sort/filter

```typescript
const unsub = onVisibleRowsChange(table, () => recomputeFooter(table));
// call unsub() in removeSummaryRow
```

## 5. Persist (if you store anything)

```typescript
import { storageKeyFor } from '../utils/slider-persistence';
const key = storageKeyFor('summary:' + tableKey);   // gs:<stem>:summary:<key>
// versioned envelope, try/catch, one warn on failure, no network
```

## 6. Reconcile capability surfaces (checklist §4 — no id drift)

- Registry entry (done above).
- Every demo `pageConfig.enrichments` that should offer it (grep
  `enrichments: \[`), **including `public/index.html`**.
- The shipped-enrichment count/id test (`enrichment-registry.test.ts`,
  `capability-filtering-toggle.spec.ts`).

## 7. Demo (checklist §9)

`public/demo/summary-row/index.html` — a realistic, filterable table; nav bar
consistent with siblings; `pageConfig.enrichments` includes `summary-row`; add a
card to `public/index.html`. Smoke-test in a real browser.

## 8. Tests (checklist §8)

- Vitest: `aggregate()` math, persistence codec round-trip + malformed +
  unavailable, **teardown leaves byte-identical DOM**.
- jsdom: footer renders, control keyboard-operable, recompute on filter.
- Storybook story `src/stories/summary-row.stories.ts` with a `play`.
- Playwright: golden path + persistence-survives-reload +
  **disable→enable round-trip restores without reload**.

## 9. Verify budget

```bash
node scripts/bundle-size.js --soft   # stay within the ≤4 KB combined budget, under the 42 KB ceiling
```

---

**Per-piece pointers**:

- `freeze-panes` — same spine minus persistence; CSS in an injected `<style>`
  string (pre-minified). See `contracts/freeze-panes.md`.
- `find-in-table` — table-level **lozenge** via `registerEnrichment`
  (`headerType==='table'`) + `installPopupChrome` for the box; tearDown only (no
  `apply`). See `contracts/find-in-table.md`.
- `statistics` extension — **no new id**; extend `StatisticsResult` + popup +
  switch extraction to visible rows. See `contracts/statistics-extension.md`.
