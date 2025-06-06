
# GridSight Technology Stack

GridSight is a lightweight, client-side JavaScript plugin that enhances static HTML data tables with interactive features such as heatmaps, interpolation, search, and statistical insights.

## Core Technologies

| Layer         | Technology          | Purpose                                                  |
|---------------|----------------------|-----------------------------------------------------------|
| **Language**  | JavaScript (ES6+)    | Core plugin logic                                         |
| **Bundling**  | esbuild (or Vite)    | To produce a single, dependency-free minified JS file     |
| **Charting**  | [uPlot](https://github.com/leeoniya/uPlot) (planned) | High-performance line charts for row/column visualization |
| **Stats**     | [simple-statistics](https://simplestatistics.org/) | Lightweight library for statistical summaries and regression |
| **Storage**   | `localStorage`       | To persist enrichment config across sessions              |
| **UI Styling**| Vanilla CSS          | Minimalist, themeable UI components                       |

## Optional / Future Extensions

| Feature Area          | Option                              |
|-----------------------|--------------------------------------|
| Table Framework Support | jQuery Tables / DataTables (optional adapters) |
| Spline Interpolation  | Natural/cubic spline in JS (custom or via `mljs`) |
| Theming               | CSS variables or utility classes     |
| Feedback Integration  | GitHub Issues, Viva Engage, or embedded form |

## Deployment Model

- Delivered as a **single-file plugin** (`gridsight.min.js`)
- Designed for inclusion via `<script>` tag in static HTML
- No server-side components required

## Repository

**GitHub**: [https://github.com/DeepBlueCLtd/grid-sight](https://github.com/DeepBlueCLtd/grid-sight)

---

_GridSight brings modern data insight to legacy tables, with zero backend and minimal footprint._
