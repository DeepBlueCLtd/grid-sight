
# GridSight Roadmap

This roadmap outlines the phased development strategy for GridSight, enabling parallel threads of work by multiple developers.

---

## 🗂️ Phase 0: Project Setup
- Establish modular folder structure
- Set up development tooling and GitHub actions
- Write contributor documentation
- Software skeleton, with framework for Storybook
- CI pipeline that publishes Storybook to gh-pages
- 

---

## 🧪 Phase 1: Core Plugin Framework
| Thread | Task |
|--------|------|
| 1A | Auto-detect tables and inject GridSight toggle |
| 1B | Parse HTML tables into structured numeric matrix |
| 1C | Inject UI scaffold (toggle, + icons, context menus) |
| 1D | Config load/save using `localStorage` with URL stem support |

---

## 🌡️ Phase 2: Enrichment Features
| Thread | Task |
|--------|------|
| 2A | Cell heatmap shading |
| 2B | Axis highlight overlays |
| 2C | Z-score and outlier detection |
| 2D | Search and cell match engine |
| 2E | Line/column charts using uPlot |

---

## 🎛️ Phase 3: Configuration & UX
| Thread | Task |
|--------|------|
| 3A | Theme system with CSS variables |
| 3B | Config menu to manage per-table settings |
| 3C | Export enriched table or summary CSV |
| 3D | Mock SMH playground site for demo and feedback |

---

## 🔬 Future & R&D Tracks
- Spline interpolation module
- Correlation matrix & contour overlays
- CLI/Web bundler for generating standalone builds

---

## 📅 Mermaid Gantt Overview

```mermaid
gantt
  title GridSight Roadmap
  dateFormat  YYYY-MM-DD
  section Phase 0: Setup
  Project structure       :done,   a1, 2024-06-01, 3d
  Tooling & CI            :done,   a2, 2024-06-04, 2d
  Contributor guide       :active, a3, 2024-06-06, 3d

  section Phase 1: Core
  Table detection         :active, b1, 2024-06-07, 4d
  Table parser            :planned, b2, after b1, 3d
  UI injection            :planned, b3, after b1, 3d
  Config storage          :planned, b4, after b1, 3d

  section Phase 2: Features
  Heatmaps                :planned, c1, 2024-06-15, 3d
  Axis highlights         :planned, c2, 2024-06-15, 3d
  Z-score detection       :planned, c3, 2024-06-18, 2d
  Search tool             :planned, c4, 2024-06-20, 3d
  Chart overlays          :planned, c5, 2024-06-22, 3d

  section Phase 3: UX & Playground
  Theme system            :planned, d1, 2024-06-25, 2d
  Config menu             :planned, d2, after d1, 3d
  Export features         :planned, d3, after d2, 2d
  Mock SMH playground     :planned, d4, 2024-07-01, 5d
```

---

## 📌 Notes

- Tasks are grouped to reduce conflicts (UI, core, enrichment logic can be developed independently)
- Developers should work in isolated modules under `src/enrichments`, `src/ui`, or `src/core`
- PRs should be linked to roadmap thread IDs (e.g., `feature/c1-heatmaps`)

