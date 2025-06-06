
# GridSight Software Requirements

This document outlines the software requirements for using and developing GridSight — a lightweight JavaScript plugin that enriches static HTML data tables.

---

## ✅ Runtime Requirements

### 📦 Browser Environment
- Modern browsers only:
  - ✅ Chrome, Firefox, Edge, Safari
  - ❌ Internet Explorer not supported
- ES6+ JavaScript support required
- No plugins or server-side processing needed

### 🧾 HTML Table Format
- Standard HTML `<table>` structure
- `<th>` elements required for row and column headers
- Numerical data expected in `<td>` elements for enrichment

### 🧠 Optional Client Capabilities
- `localStorage` (used for saving enrichment configuration)
- Minimal CSS support for styling toggle controls and highlights

---

## 🛠️ Development Requirements

### 🧰 Development Stack
- **Node.js** (v18+ recommended)
- **Package Manager**: npm or pnpm
- **Bundler**: 
  - `esbuild` (preferred) or `Vite` for producing single-file JS bundles

### 📚 Core Libraries
- `simple-statistics`: for means, z-scores, regression, etc.
- `uPlot`: planned for rendering lightweight charts
- Vanilla JavaScript and CSS only (no React or frameworks)

---

## 📦 Build & Deployment
- Delivered as a single `.js` file
- Embed with `<script>` tag into any HTML page
- Can be served from local file system or static web hosting
- No dependencies or runtime APIs required

---

## 🌐 Repository

GitHub: [https://github.com/DeepBlueCLtd/grid-sight](https://github.com/DeepBlueCLtd/grid-sight)

---

_GridSight empowers existing HTML tables with data science tools — no rework, no backend._
