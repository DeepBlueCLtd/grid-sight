# Quickstart — Copy as CSV (wire & verify in < 5 min)

Audience: a developer implementing or reviewing spec 009. Assumes the modules in
`contracts/copy-as-csv-api.md` exist.

## 1. What the feature does

A **Copy** lozenge (⎘) appears in every qualifying table's corner cluster when
Grid-Sight is on. Clicking it opens a small dialog: choose CSV / TSV / Markdown,
toggle *include headers / row headers / GS virtual columns*, press **Copy** →
the current visible view (post sort + filter) lands on the clipboard and a toast
confirms `Copied 12 rows × 5 columns as CSV`. If the clipboard is unavailable,
the dialog swaps to a pre-selected textarea for manual copy.

## 2. The five wiring points

```ts
// 1. Catalog: flip shipped + add teardown  (src/core/enrichment-registry.ts)
{ id: 'copy-as-csv', label: 'Copy as CSV', defaultOn: true, shipped: true,
  tearDown: removeCopyUi },

// 2. Descriptor registration              (src/ui/copy-csv-lozenge.ts)
registerEnrichment({
  id: 'copy-as-csv',
  appliesTo: (ctx) =>
    ctx.headerType === 'table' && !ctx.table.hasAttribute('data-gs-no-export'),
  mount: (ctx) => /* <button.gs-lozenge> → openCopyPopup({ table: ctx.table, anchor }) */,
});

// 3. Side-effect import                    (src/index.ts)
import './ui/copy-csv-lozenge';
```

The toggle-panel on/off pipeline, per-table enabled set (spec 015), and lozenge
rebuild then drive it automatically — no extra plumbing.

## 3. Build the export model (the only non-trivial logic)

```ts
const opts = resolveInitialCopyConfig();          // URL > storage > defaults
const model = buildExportModel(table, opts);      // reads visibleBodyRows + table-grid + registry
const text  = serialiseModel(model, opts);        // toCsv / toTsv / toMarkdown
await navigator.clipboard?.writeText(text);        // guarded; textarea fallback on failure
showCopyToast(`Copied ${model.rowCount} rows × ${model.colCount} columns as ${labelFor(opts.format)}`);
```

`buildExportModel` rules to remember:
- Rows = `visibleBodyRows(table)` minus `data-gs-no-export` rows.
- Columns = `[row-header?] + source (visible order) + virtual (if opts.virtualCols)`.
- Text via `cellValue()` (source) / `exporter.getCellText(rowEl)` (virtual).
- Span-covered / short positions → `''` (rectangular matrix).

## 4. Verify by hand

1. Open `demo/copy-as-csv/` (or any demo with a sortable/filterable table).
2. Toggle Grid-Sight on; filter to hide some rows; sort a column.
3. Click ⎘ → accept defaults → **Copy**. Paste into a text editor: only visible
   rows, in sorted order, comma-separated, header first.
4. Turn off "include GS virtual columns" with a cumulative/sparkline column
   active → re-copy → confirm the appended column is gone.
5. Add `data-gs-no-export` to one visible `<tr>` → re-copy → that row is absent.
6. Switch to Markdown → copy → paste into a GFM renderer → valid table.
7. Reload the page → reopen the popup → your last format/options are preselected.

## 5. Verify automatically

```bash
yarn test          # unit: csv-serialize vectors, builder, persistence round-trip
yarn test:e2e      # playwright: copy → clipboard read-back, fallback, teardown
yarn build         # tsc + bundle size (stay under the enforced 25 KB cap)
```

Expected new test files:
- `src/enrichments/__tests__/csv-serialize.test.ts`
- `src/enrichments/__tests__/copy-as-csv.builder.test.ts`
- `src/utils/__tests__/copy-persistence.test.ts`
- `tests/e2e/copy-as-csv.spec.ts`
- `src/stories/copy-as-csv.stories.ts`

## 6. Accessibility checklist (constitution §III)

- Lozenge is a `<button>` (Enter/Space).
- Popup is `role="dialog"` with a labelled title, focus trapped (`installPopupChrome`),
  Esc closes, focus returns to the lozenge.
- Toast is `role="status"` `aria-live="polite"`, never focused.
