# Quickstart: Virtual Columns

**Feature**: 012-virtual-columns | **Plan**: [plan.md](./plan.md)

This quickstart shows how to enable each of the three virtual-column variants — cumulative, sparkline, and column-compare — and how to share the resulting view through a URL. Five minutes, two files, no build step required.

---

## Prerequisite: a Grid-Sight-enabled page

```html
<!DOCTYPE html>
<html>
<body>

<table id="sales">
  <thead>
    <tr><th>Region</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Weight</th></tr>
  </thead>
  <tbody>
    <tr><td>North</td><td>120</td><td>145</td><td>180</td><td>210</td><td>3.4</td></tr>
    <tr><td>South</td><td>95</td><td>110</td><td>140</td><td>165</td><td>2.8</td></tr>
    <tr><td>East</td><td>205</td><td>230</td><td>250</td><td>280</td><td>4.1</td></tr>
    <tr><td>West</td><td>180</td><td>175</td><td>195</td><td>240</td><td>3.6</td></tr>
  </tbody>
</table>

<script src="grid-sight.iife.js"></script>
<script>
  window.gridSight.init();
</script>
</body>
</html>
```

When Grid-Sight initialises, you'll see:

- A small **Σ** lozenge appears beside every numeric column header (`Q1`, `Q2`, `Q3`, `Q4`, `Weight`).
- A small **⌇** lozenge appears in the table's top-left corner cluster, alongside the existing **S** (sliders) lozenge.
- A small **Δ** lozenge appears in the same corner cluster.

If a lozenge doesn't appear, the table is disqualified for that variant. The `Δ` and `⌇` lozenges need at least 3 numeric body columns; cumulative needs at least one numeric column.

---

## 1. Cumulative — running sum on `Weight`

Click the **Σ** lozenge on the `Weight` header. A new column appears at the right edge:

| Region | Q1 | Q2 | Q3 | Q4 | Weight | **Σ Weight** |
|--------|----|----|----|----|--------|--------------|
| North  | 120 | 145 | 180 | 210 | 3.4 | **3.4** |
| South  | 95 | 110 | 140 | 165 | 2.8 | **6.2** |
| East   | 205 | 230 | 250 | 280 | 4.1 | **10.3** |
| West   | 180 | 175 | 195 | 240 | 3.6 | **13.9** |

Click the **Σ** lozenge again to cycle to **percent of total**:

| Region | ... | Weight | **Σ Weight (% of total)** |
|--------|-----|--------|---------------------------|
| North  | ... | 3.4 | **24.5%** |
| South  | ... | 2.8 | **44.6%** |
| East   | ... | 4.1 | **74.1%** |
| West   | ... | 3.6 | **100%** |

Click a third time to remove the column.

You can activate Σ on as many numeric columns as you like — each adds a new appended column in activation order.

---

## 2. Sparkline — row trend across the numeric columns

Click the **⌇** lozenge in the corner. A new **Trend** column appears at the rightmost edge, showing a mini-bar-chart per row across the four quarterly columns (numeric columns only — `Weight` is included; non-numeric columns are skipped).

Hovering or keyboard-focusing a sparkline cell shows a tooltip with the row's min, max, and last values, and highlights the numeric column headers that contributed to the chart.

To toggle between **per-row** scaling (each row scaled to its own max — the default) and **shared** scaling (every row scaled to the global max across the visible rows), use the small mode-toggle button next to the `Trend` header.

Click the **⌇** lozenge again to remove the column.

---

## 3. Compare — pairwise column delta

Click the **Δ** lozenge in the corner. A picker overlay highlights every numeric column header. Click `Q1`, then click `Q4`. A new column appears with the heading `Δ Q4 − Q1`:

| Region | Q1 | ... | Q4 | ... | **Δ Q4 − Q1** |
|--------|----|-----|----|-----|---------------|
| North  | 120 | ... | 210 | ... | **▲ 90** |
| South  | 95 | ... | 165 | ... | **▲ 70** |
| East   | 205 | ... | 280 | ... | **▲ 75** |
| West   | 180 | ... | 240 | ... | **▲ 60** |

The arrow glyph (`▲` / `▼` / `=`) reinforces the colour so the column reads correctly for users with colour-vision deficiencies.

Click the **Δ** lozenge again to remove the overlay.

---

## 4. Three variants at once

You can have all three active on the same table. The appended-column order is fixed:

1. Every cumulative column, in activation order.
2. The compare column (at most one).
3. The Trend column (always rightmost).

Example: with `Σ Weight`, `Σ Cost` (in that order), `Δ Q4 − Q1`, and `Trend` all active, the table's right edge reads:

```
| ...source columns... | Σ Weight | Σ Cost | Δ Q4 − Q1 | Trend |
```

Removing `Σ Weight` leaves:

```
| ...source columns... | Σ Cost | Δ Q4 − Q1 | Trend |
```

The other columns don't reflow horizontally — they each slide left by exactly one position.

---

## 5. Share the view via URL

Every activation updates the URL fragment under the `gs.vc` parameter. Bookmark the page or copy the URL to share the exact set of virtual columns with a colleague.

Example URL after the four activations above:

```
https://example.com/dashboard#gs.vc=sales:c.weight.s,c.cost.s,d.q1.q4.a,t.r
```

Opening that URL on another machine restores every column within one animation frame after first paint. No `localStorage` is involved, so the share works across browsers and incognito sessions.

If the linked page lacks one of the referenced source columns (e.g. the source data dropped `Cost`), that single directive is silently skipped; the surviving directives still apply.

---

## 6. Programmatic activation

For host pages that want to drive virtual columns from code rather than from user clicks (e.g. a dashboard that wants to start with `Σ Weight` already active):

```js
const table = document.getElementById('sales');

// Activate cumulative on the 'weight' column in 'sum' mode.
window.gridSight.virtualColumns.addCumulative(table, 'weight', 'sum');

// Activate sparkline with shared scaling.
window.gridSight.virtualColumns.addSparkline(table, 'shared');

// Activate a compare overlay between Q1 and Q4 in absolute-delta mode.
window.gridSight.virtualColumns.addCompare(table, 'q1', 'q4', 'abs');

// Inspect what's active.
console.log(window.gridSight.virtualColumns.list(table));
// → [{ id: 'cum-weight', kind: 'cumulative', mode: 'sum' },
//    { id: 'cmp-q1-q4', kind: 'compare', mode: 'abs' },
//    { id: 'spark', kind: 'sparkline', mode: 'shared' }]

// Remove everything.
window.gridSight.virtualColumns.removeAll(table);
```

Column keys (`'weight'`, `'q1'`, `'q4'`) are slugified header texts. `list()` returns directives in canonical left-to-right order.

---

## 7. Opting a table out

| Goal                                  | Attribute on the `<table>` |
|---------------------------------------|----------------------------|
| Hide every virtual-column lozenge     | `data-gs-ignore`           |
| Hide only the Σ lozenge               | `data-gs-no-cumulative`    |
| Hide only the ⌇ lozenge               | `data-gs-no-sparkline`     |
| Hide only the Δ lozenge               | `data-gs-no-compare`       |

The `data-gs-no-*` opt-outs are per-lozenge; an already-appended column from another variant is not removed by adding them at runtime.

---

## 8. Disabling Grid-Sight on the page

Toggling Grid-Sight off via the existing global toggle removes every appended column. The host table's DOM returns to byte-identical to its pre-Grid-Sight state — no orphan `<th>`, no orphan `<td>`, no inline style residue.

URL state is preserved. Toggling Grid-Sight back on restores every active virtual column within one animation frame.

---

## 9. What you're seeing under the hood

- The append operation is owned by a single in-tree scaffold (`src/enrichments/virtual-column.ts`); each variant ships a small renderer that the scaffold drives.
- Visible-row order and dim state come from the project's shared visible-row pipeline (`src/utils/visible-rows.ts`); once sort/filter (`002-003-row-visibility`) lands, the virtual columns will move and recompute with every sort or filter — no further work needed on this side.
- The "include GS virtual columns" toggle in copy-as-CSV (`009-copy-as-csv`, when it lands) reads from a registry the scaffold already populates as each column activates. Sharing a view by URL and exporting it as CSV are then the same operation.
