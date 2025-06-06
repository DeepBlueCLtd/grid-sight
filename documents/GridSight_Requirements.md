
# Grid-Sight Software Requirements (Detailed)

This document outlines all software and structural requirements for developing, deploying, and embedding Grid-Sight — a lightweight JavaScript plugin that enriches static HTML data tables with interactive insights.

---

## ✅ Runtime Environment Requirements

### 🔍 Browser Compatibility
Grid-Sight runs entirely in the browser with no server-side code.

- ✅ Supported Browsers:
  - Google Chrome (v90+)
  - Firefox (v90+)
  - Microsoft Edge (v90+)
  - Safari (v14+)
- ❌ Not Supported:
  - Internet Explorer (any version)
  - Browsers without ES6+ JavaScript support

### 📄 HTML Table Format
To be enriched, HTML tables must follow these basic structural rules:

- `<table>` tag with visible `<thead>` and `<tbody>`
- Headers in `<th>` elements (first row, and optionally first column)
- Data in `<td>` elements, preferably numeric
- Recommended: one data table per grid; multi-table support available with page-level enrichment toggle

---

## 🧠 Plugin Functional Requirements

### 📦 Base Features
- Add enrichment toggle via GS icon and checkbox
- Inject plus icons at:
  - Whole-table level (top-left)
  - Column headers
  - Row headers
- Show context menu with available enrichments
- Apply enrichments interactively without altering original HTML
- Persist user choices via `localStorage`

### 📊 Enrichment Capabilities
- Heatmap coloring
- Axis coordinate highlighting
- Global and scoped search/match
- Basic statistics (mean, z-score, outliers)
- Interpolation tools (planned)
- Chart overlays (e.g. row/column plot using uPlot)

---

## 💾 Storage Requirements

### 🔐 Local Config Persistence
- All user-enrichments and settings are stored in `window.localStorage`
- Configs are associated with a **URL stem**, allowing table behavior to persist across sessions

#### Config levels:
- `global` (library-wide default)
- `page` (per HTML document)
- `table` (individual override)

---

## 🛠️ Developer Environment Requirements

### 📚 Core Technologies
| Layer           | Technology           | Purpose                            |
|----------------|----------------------|------------------------------------|
| Language        | JavaScript (ES6+)    | Plugin logic and enrichment tools  |
| Build System    | esbuild / Vite       | Bundling and minification          |
| Charts          | uPlot (planned)      | High-performance visualisation     |
| Statistics      | simple-statistics    | Z-score, regression, etc.          |
| Styles          | Vanilla CSS          | Inline styles and theme control    |
| Storage         | localStorage         | Persist config and enrichments     |

### 📂 Recommended Folder Layout
```
/src/
  ├── core/
  ├── ui/
  ├── enrichments/
  └── config/

/demo/
  ├── examples/
  └── playground/

/dist/
  ├── minified/
  └── releases/
```

---

## ⚙️ Build & Deployment

- ✅ Plugin builds to a **single JavaScript file**
  - e.g., `grid-sight.min.js`
- ✅ No external dependencies at runtime
- ✅ Can be hosted on:
  - Local file system
  - Static file server
  - GitHub Pages

---

## 🔁 CI/CD Recommendations

- GitHub Actions or similar runner
- Pre-push:
  - Linting with ESLint
  - Formatting with Prettier
  - Bundle test with esbuild/Vite
- Optional:
  - PR label routing (via `labels.json`)
  - Markdown spellcheck or link validator

---

## 🧪 Testing Guidelines

- Manual browser tests for enrichment injection
- Snapshot HTML comparisons for demo tables
- Headless browser tests (optional) with Puppeteer or Playwright

---

## 🌐 Accessibility Notes

- All interactive controls (toggles, plus buttons, menus) must:
  - Be keyboard-navigable
  - Have `aria-label` attributes
  - Use color in a contrast-accessible manner
  - Not interfere with existing table screen reader flow

---

Grid-Sight enhances legacy content non-destructively, offering insight where static HTML once limited exploration.
