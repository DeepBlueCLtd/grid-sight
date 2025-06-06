
# Grid-Sight Technical Architecture & Project Structure

This document provides a detailed technical overview of the Grid-Sight JavaScript plugin based on its software requirements.

---

## 🧱 Overview

**Grid-Sight** is a modular, lightweight JavaScript plugin that enriches HTML `<table>` elements with heatmaps, axis highlights, statistics, and interactive overlays. It is entirely client-side and operates in modern browsers without server dependencies.

---

## 📁 Project Structure

```plaintext
grid-sight/
├── public/                     # Optional: Dev server entry point
│   └── index.html
├── src/                        # Source files
│   ├── core/                   # Bootstrap, table scan, injection hooks
│   │   ├── bootstrap.js
│   │   ├── tableScanner.js
│   │   └── observer.js         # MutationObserver for dynamic pages
│   ├── ui/                     # UI primitives and interaction
│   │   ├── Toggle.js
│   │   ├── PlusButton.js
│   │   ├── ContextMenu.js
│   │   └── Panel.css
│   ├── enrichments/            # Individual enrichment strategies
│   │   ├── heatmap.js
│   │   ├── highlightAxis.js
│   │   ├── zScoreOutliers.js
│   │   └── charts.js           # uses uPlot
│   ├── config/                 # State and persistence layer
│   │   ├── configManager.js    # Handles localStorage
│   │   ├── settingsModel.js
│   │   └── urlStemUtils.js
│   ├── utils/                  # Shared utilities
│   │   ├── domUtils.js
│   │   ├── tableMatrix.js      # Converts DOM to numeric matrix
│   │   └── stats.js            # simple-statistics wrapper
│   └── main.js                 # Entry point
├── demo/                       # Playground and sample data
│   ├── playground.html
│   └── submarine-db-tables/
├── dist/                       # Build artifacts
│   └── grid-sight.min.js
├── .windsurfrules              # IDE consistency
├── .eslintrc.cjs               # Linting config
├── .prettierrc                 # Formatting config
├── vite.config.js              # Build tool setup
└── README.md
```

---

## ⚙️ Build & Tooling

### 🔨 Bundler
- **Vite** or **esbuild** recommended
- Produces single `grid-sight.min.js` output
- Supports:
  - Tree-shaking
  - Minification
  - Optional ESM + UMD builds

### ✅ Linting & Formatting
- **ESLint**: Enforces JS code standards
- **Prettier**: Consistent formatting
- **Windsurf IDE**: `.windsurfrules` for cross-developer consistency

---

## 🔁 CI/CD (Recommended)
| Step | Description |
|------|-------------|
| Lint | Run ESLint on `src/` |
| Format | Check code style with Prettier |
| Build | Compile to `/dist/grid-sight.min.js` |
| Optional | Playwright or Puppeteer tests on demo tables |
| Deploy | Copy to GitHub Pages or release ZIP |

---

## 🧠 Modularity Benefits

| Layer         | Functionality                       |
|--------------|-------------------------------------|
| `core/`       | DOM scanning, injection, bootstrap |
| `ui/`         | Controls, toggles, menus           |
| `enrichments/`| Independent feature modules        |
| `config/`     | Persistence and config logic       |
| `utils/`      | DOM and statistical helpers        |

This separation enables **parallel development**, allowing multiple contributors to work on UI, enrichment, or analytics without stepping on each other.

---

## 📚 External Libraries

| Library             | Purpose                         |
|---------------------|---------------------------------|
| `simple-statistics` | Basic stat functions (mean, z) |
| `uPlot`             | High-performance charts (planned) |
| `localStorage`      | User config persistence        |

---

## ✅ Output

- Single JavaScript file: `grid-sight.min.js`
- Runtime injected via `<script>` tag
- No external dependencies at runtime

---

Grid-Sight delivers modular, embeddable data insight — unlocking value from static tables without rebuilding content.
