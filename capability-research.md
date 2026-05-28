# Grid-Sight Capability Research: Features From Other Grid/Table Tools

**Date**: 2026-05-28
**Author**: Research spike
**Status**: Reference (input to spec `014-navigation-and-analysis`)

This document surveys the feature sets of leading grid/table components and
data-exploration tools, lists the capabilities Grid-Sight does **not** yet
implement, and ranks them by value to the analysts and scientists who have to
navigate and exploit large numbers of tables of data.

> **Framing constraint.** Grid-Sight is a *read-only progressive enhancement of
> static HTML tables*, offline-first, lightweight (per the constitution). It
> does not own the data source, mutate source cells, fetch over the network, or
> rebuild the table. Features that contradict that posture (cell editing, data
> validation, formula engines, server-side/streaming row models, virtual
> scrolling) are explicitly **out of scope** and listed only for completeness.

---

## 1. Tools surveyed

| Tool | Category | Known for |
|------|----------|-----------|
| AG Grid | Enterprise JS grid | Row grouping, pivoting, aggregation, integrated charts, master/detail, pinning |
| TanStack Table | Headless JS table | Faceted filtering, column pinning, grouping, virtualization |
| Handsontable | Spreadsheet grid | 400 formulas, data validation, conditional formatting, frozen rows/cols |
| jQuery DataTables | Classic table plugin | Global/column search + match highlighting, fixed header, column reorder, export |
| Tabulator | JS data grid | Collapsible row grouping, column calculations (top/bottom), data trees |
| FINOS Perspective | Analytics engine | Pivot/aggregate, expression columns, streaming, very large datasets (WASM/Arrow) |
| Datasette | Data exploration | Faceted browse (counts → click-to-filter), SQL, export |
| OpenRefine | Data cleaning (scientists) | Numeric/text/scatterplot facets, clustering of near-duplicate values |
| ydata / pandas-profiling | EDA reporting | Per-column profile: missing %, quantiles, histogram, correlations, duplicates |
| MUI X / Syncfusion / Infragistics | React grids | Column + row pinning, column chooser, column menus |
| Excel / Google Sheets | Spreadsheets | Freeze panes, pivot tables, conditional formatting, data bars / color scales / icon sets, find & replace |

Sources: AG Grid community-vs-enterprise; TanStack Table column-faceting/pinning
docs; Handsontable conditional-formatting & freezing docs; DataTables search
highlighting blog; Tabulator column-calcs & grouping docs; FINOS Perspective
pivoting/aggregation wiki; Datasette facets docs; OpenRefine facets & clustering
workshop; ydata-profiling README; MUI X column/row pinning docs; Microsoft
Support data-bars/color-scales/freeze-panes/find-replace articles.

---

## 2. Full gap list — features Grid-Sight does not yet have

Each item carries a stable ID (category letter + number) used in the value
ranking below.

### A. Navigation & orientation in a large table

- **A1. Sticky / frozen header row** — header stays visible while scrolling a tall table.
- **A2. Frozen / pinned columns** — keep the row-label / key column(s) visible while scrolling horizontally.
- **A3. Pinned rows** — keep a total/summary or reference row visible regardless of scroll/sort/filter.
- **A4. Find-in-table** — quick search box, highlight all matches, jump between hits.
- **A5. Go-to-cell / jump-to-row** — surface the internal table-grid addressing layer as a navigation control.
- **A6. Column resize**, **column reorder (drag)**, **column show/hide chooser**, **column menu**.
- **A7. Minimap / scroll overview** of a long table.

### B. Aggregation & summarization

- **B8. Column summary / footer row** — sum, avg, min, max, count over *visible* rows.
- **B9. Row grouping** — collapse rows sharing a column value into collapsible groups.
- **B10. Group subtotals** — per-group aggregates inside group headers.
- **B11. Pivot table** — rows × columns × aggregate.

### C. Filtering & faceting (we have per-column filter + frequency dialog, not these)

- **C12. Global / quick filter** across all columns at once.
- **C13. Interactive faceted browse** — facet counts that act as click-to-filter.
- **C14. Text-condition filters** — contains / starts-with / regex / blank / not-blank.
- **C15. Top-N / bottom-N filter**.

### D. Conditional formatting & in-cell visualization (we have heatmap + outlier marks)

- **D16. User-defined conditional formatting rules** — highlight cells matching a value/range/text rule.
- **D17. Data bars** — in-cell proportional bars (distinct from background heatmap).
- **D18. Color-scale presets + icon sets** (arrows / traffic-lights) beyond the single heatmap gradient.
- **D19. Duplicate-value highlighting**.

### E. Exploratory data analysis (high scientist value)

- **E20. Per-column profile panel** — count, missing %, distinct count, min/Q1/median/Q3/max, and a mini-histogram.
- **E21. Missing / blank-cell highlighting & completeness indicator** per column.
- **E22. Correlation view** between two numeric columns (scatterplot facet).
- **E23. Value clustering** — surface near-duplicate categorical values for inspection (read-only).

### F. Cross-table — directly serves "large numbers of tables"

- **F24. Table navigator / index** — a floating table-of-contents listing every enriched table on the page with jump links.
- **F25. Cross-table search** — find a value across all tables on the page at once.
- **F26. Cross-table column comparison** — extend the existing cross-table slider sync to align/compare columns.

### G. Selection & richer export (we copy whole table as CSV/TSV/Markdown)

- **G27. Cell / range selection** + copy selected range.
- **G28. Row selection** (checkboxes) and copy/export of selection only.
- **G29. Keyboard cell navigation** (arrow keys move an active cell).
- **G30. Export to Excel (.xlsx) / JSON** and a **print-friendly view**.

### Out of philosophy (noted, not recommended)

Cell editing, data validation, formula/expression engines, server-side/streaming
row models, virtual scrolling — they either mutate the source or pull in
weight/network, conflicting with the offline, read-only, progressive-enhancement
constitution.

---

## 3. Value ranking for analysts & scientists navigating many large tables

Weighing **value** against **fit** (lightweight, offline, in-place, reuses the
existing visible-rows pipeline, table-grid addressing layer, type detection, and
statistics/frequency code).

### Tier 1 — highest value, strong fit (recommended next increment)

- **Frozen header row + frozen key column (A1, A2).** The single biggest
  orientation win on large tables and the cheapest — largely `position: sticky`
  plus the addressing layer to identify the key column. Best payoff per KB.
- **Per-column EDA profile panel (E20, E21).** Scientists live here: missing %,
  distinct count, quartiles, and a mini-histogram on demand. Best delivered by
  **extending the existing `statistics` enrichment in place** (which already
  shows count/sum/min/max/mean/median/σ/variance) rather than adding a parallel
  enrichment — the delta is just missing %, distinct, Q1/Q3, histogram, and
  visible-rows awareness. Categorical distribution stays with `frequency`.
- **Column summary / footer row (B8).** Sum/avg/min/max/count over *visible*
  rows. An analyst staple that slots straight into the visible-rows pipeline so
  it stays correct under filter/sort.
- **Find-in-table with highlight + jump (A4).** Fast orientation in a wide/tall
  table; the addressing layer already maps a match to a logical cell to scroll to.

### Tier 2 — high value, moderate lift

- **Interactive faceted filtering (C13)** — turn the frequency counts we already
  compute into click-to-filter (Datasette-style).
- **User-defined conditional formatting + data bars (D16, D17)** — let analysts
  mark their own thresholds/anomalies; data bars complement the heatmap.
- **Table navigator / index + cross-table search (F24, F25)** — the clearest
  answer to "large *number* of tables", and a differentiator versus single-grid
  competitors.

### Tier 3 — highest analytical ceiling, heaviest / least aligned

- **Row grouping with subtotals (B9, B10)** and **pivot tables (B11)** — maximum
  analytical power, but the largest builds, push hardest against the bundle
  budget, and sit awkwardly with "enrich the author's table in place" rather
  than rebuilding it. Each deserves a dedicated spec + constitution check.

---

## 4. Recommendation

Pursue the **Tier 1 four** as the next increment — they are cheap, reuse
existing infrastructure, and squarely hit the navigate/exploit-large-tables
goal. Treat faceted filtering and the cross-table navigator as the follow-on
that distinguishes Grid-Sight from single-grid competitors. Defer pivot/grouping
to their own specs with an explicit constitution-check discussion.

The Tier 1 four are specified in [`specs/014-navigation-and-analysis/spec.md`](specs/014-navigation-and-analysis/spec.md).
