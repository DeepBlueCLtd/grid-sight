# Implementation Plan: Virtual Columns (Sparkline + Cumulative + Compare-Column)

**Branch**: `claude/virtual-columns-feature-KZxaa` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-virtual-columns/spec.md`

## Summary

Introduce a single **virtual-column scaffold** that owns the right-edge `<th>` / `<td>` / `<tfoot>` append operation, column ordering, lifecycle, URL persistence, visible-row pipeline subscription, and copy-as-CSV registration. Three per-feature **renderers** plug into the scaffold:

1. **Cumulative** — Σ lozenge on a numeric header appends `Σ <header>` with running-sum or percent-of-total modes (multi-instance per table).
2. **Sparkline** — ⌇ lozenge in the corner cluster appends a `Trend` column of inline-SVG mini-bar-charts across all numeric body columns (single instance, always last).
3. **Compare-column** — Δ lozenge picks two columns and appends `Δ <colB> − <colA>` (single instance, between cumulative and sparkline).

The scaffold turns three independent column-appending features into one reusable interior. No new runtime dependencies; constitution principles I (≤ 10 KB gzipped) and VI (offline) remain binding. Two upstream specs (`002-003-row-visibility`, `009-copy-as-csv`) provide integration points this feature consumes — both are specified but not yet implemented, so this plan defines thin local interfaces the scaffold can target now and the upstream features can implement against later.

## Technical Context

- **Language/Version**: TypeScript ~5.8 (existing project compiler version; output ES2020+).
- **Primary Dependencies**:
  - Runtime: **none new**. `simple-statistics` (already in `dependencies`) is unrelated and not used; `shepherd.js` is unrelated and not used. Inline SVG is built with `document.createElementNS` — no charting library.
  - Build/test: existing Vite 6, Vitest 3, Playwright 1.53, Storybook 9 (unchanged).
- **Storage**: URL fragment under a single per-page namespace `gs.vc` (one block per table, listing every active virtual-column directive). No `localStorage` dependency (SC-004). The existing `gs.s` slider namespace is untouched.
- **Testing**:
  - Vitest unit tests (`src/enrichments/__tests__/`, `src/utils/__tests__/`) for scaffold ordering, persistence encode/decode, per-renderer math (cumulative sum/percent, sparkline scaling, delta computation).
  - Storybook interaction tests (`@storybook/addon-vitest`) for lozenge → DOM → tooltip flows on canned fixture tables.
  - Playwright e2e (`tests/e2e/`) for the cross-feature stories US6 (ordering), US7 (URL share), US8 (visible-row pipeline cooperation).
- **Target Platform**: Evergreen browsers ≤ 2 years old (Chrome, Firefox, Safari, Edge, Chromium derivatives). Must function from `file://` (offline).
- **Project Type**: Browser library, single project. IIFE bundle (`dist/grid-sight.iife.js`) + npm/ESM via `src/index.ts` entry.
- **Performance Goals** (from spec SC-002):
  - Sparkline initial render: < 200 ms on a 1 000 row × 10 numeric column table on a mid-range laptop.
  - Cumulative / compare initial render and any mode-flip / re-compute: < 100 ms on the same fixture.
  - URL restoration: visible within one animation frame after first paint (SC-003).
  - Scaffold notification fan-out on a visible-row pipeline event MUST complete within one animation frame across all registered renderers.
- **Constraints**:
  - Bundle ceiling: published IIFE stays **≤ 10 KB gzipped** (constitution §I). The combined feature MUST fit; the scaffold is the headline efficiency win. Estimated cost analysed in `research.md` §R-7.
  - No runtime network access (constitution §VI). Inline SVG, no external fonts/icons.
  - Keyboard + AT operability mandatory (constitution §III). Every appended cell carries an `aria-label`; sparkline cells are focusable with arrow-key navigation; tooltip exposed via `aria-describedby` (SC-006).
  - Append-only DOM. Detach MUST leave the host table byte-identical (FR-VC-006, SC-005).
  - Visible-row pipeline is the only authority on row order / dim state (FR-VC-011). Renderers MUST NOT read raw `tbody.rows`.
- **Scale/Scope**: Up to 10 tables per page, each up to 1 000 rows × 10 numeric body columns. Up to ~10 cumulative columns + 1 sparkline + 1 compare per table. URL fragment size capped at ~2 kB per page across all tables.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ⚠ Conditional pass | No new runtime deps. Bundle delta estimated in `research.md` §R-7; the scaffold-plus-three-renderers must fit inside the residual headroom after sliders/heatmap. Plan budgets ≤ 2.0 KB gzipped delta total. If a renderer breaches its sub-budget, simplify (e.g. drop sparkline tooltip animation) rather than amend the ceiling. |
| II. Test Discipline | ✅ Pass | Vitest unit suites per module; Storybook interaction tests for each lozenge; Playwright e2e for US6/US7/US8. Detach byte-equality verified by snapshot diff. |
| III. Accessibility by Default | ✅ Pass | Every appended cell has a non-empty `aria-label` (SC-006). Sparkline cells are `tabindex="0"`, expose `role="img"` with descriptive label + `aria-describedby` for the tooltip. Lozenges keyboard-activatable. No reliance on colour alone (compare uses colour + glyph per FR-014). |
| IV. Progressive Enhancement | ✅ Pass | Scaffold off by default; activated only via lozenge or URL directive. Disqualified tables (e.g. `data-gs-ignore`, `rowspan`/`colspan` on body cells, < 3 numeric columns for sparkline) silently refuse. Detach leaves byte-identical DOM. |
| V. Cross-Browser Compatibility | ✅ Pass | Inline SVG, `URLSearchParams`, `requestAnimationFrame`, `MutationObserver`, `IntersectionObserver` — all available in evergreen ≤ 2 years. No newly-shipped APIs used. |
| VI. Offline-First / Air-Gapped | ✅ Pass | No fetches. SVG built from `document.createElementNS`. Glyphs (`Σ`, `⌇`, `Δ`) are Unicode characters — no icon font. URL fragment persistence is local. |
| Development-Phase Posture | N/A | Pre-production; backwards-compat freeze does not apply. Public API additions are flexible. |

**No constitution violations.** Complexity Tracking section below is intentionally empty.

The conditional pass on Principle I is a budget concern, not a violation. Mitigation strategy is documented in `research.md` §R-7 and the per-renderer task list will carry size targets.

**Post-design re-check (2026-05-19)**: After producing `research.md`, `data-model.md`, `contracts/public-api.md`, `contracts/registry-api.md`, and `quickstart.md`, the Constitution Check was re-evaluated. Estimated bundle delta is ~1.8 KB gzipped (scaffold ~0.7 KB; cumulative ~0.3 KB; sparkline ~0.5 KB; compare ~0.3 KB). Total bundle projected at ~7.4 KB against the 10 KB ceiling. No new runtime dependencies introduced. All behaviour stays client-side. Verdict: still passing on every principle; Principle I downgraded from conditional to clean pass for the design as drafted.

## Project Structure

### Documentation (this feature)

```text
specs/012-virtual-columns/
├── plan.md                 # This file
├── spec.md                 # Feature specification (input)
├── research.md             # Phase 0 — scaffold contract, perf strategy, integration plan
├── data-model.md           # Phase 1 — Directive, Registry, AppendedColumnRecord, PersistedState
├── quickstart.md           # Phase 1 — how to enable each variant and share via URL
├── contracts/
│   ├── public-api.md       # Phase 1 — additions to window.gridSight for virtual columns
│   └── registry-api.md     # Phase 1 — registerVirtualColumn + visible-row + copy-as-CSV interfaces
├── checklists/
│   └── requirements.md     # Spec validation (already passing)
└── tasks.md                # Phase 2 — created by /speckit-tasks (not by /speckit-plan)
```

### Source Code (repository root)

Existing single-project layout. This feature adds files under existing top-level groupings; no new top-level directories.

```text
src/
├── core/                              # existing: detection, processor (unchanged)
├── enrichments/
│   ├── virtual-column.ts              # NEW — scaffold (FR-VC-001..FR-VC-013)
│   ├── virtual-column-registry.ts     # NEW — per-table registry + canonical ordering
│   ├── virtual-column-persistence.ts  # NEW — URL fragment encode/decode (gs.vc namespace)
│   ├── cumulative-column.ts           # NEW — Σ lozenge + cumulative renderer (US1)
│   ├── sparkline-column.ts            # NEW — ⌇ lozenge + sparkline renderer (US2/4/5)
│   ├── sparkline-svg.ts               # NEW — inline-SVG mini-bar-chart builder
│   ├── compare-column.ts              # NEW — Δ column-mode renderer (US3)
│   ├── heatmap.ts                     # existing — unchanged
│   ├── slider.ts                      # existing — unchanged
│   └── __tests__/                     # existing — new test files alongside
├── ui/
│   ├── virtual-column-lozenges.ts     # NEW — Σ / ⌇ / Δ lozenge DOM + keyboard handlers
│   ├── compare-picker.ts              # NEW — col-A → col-B picker overlay (US3)
│   ├── toggle-injector.ts             # existing — unchanged
│   └── header-utils.ts                # existing — unchanged
├── utils/
│   ├── visible-rows.ts                # NEW (thin local stub) — Visible Row Sequence interface;
│   │                                  #   real implementation lands with 002-003-row-visibility
│   ├── copy-as-csv-registry.ts        # NEW (thin local stub) — registration shim;
│   │                                  #   real implementation lands with 009-copy-as-csv
│   └── ...
├── types/
│   └── virtual-column.ts              # NEW — exported types (Directive, Kind, Renderer)
└── index.ts                           # existing — extended to export the new public API

tests/
└── e2e/
    ├── virtual-column-ordering.spec.ts     # NEW — US6
    ├── virtual-column-url-share.spec.ts    # NEW — US7
    └── virtual-column-pipeline.spec.ts     # NEW — US8 (with mock VRS)
```

**Structure Decision**: Reuse the existing single-project layout. The scaffold and three renderers all live under `src/enrichments/` alongside the existing `heatmap.ts` and `slider.ts`; lozenge UI bits live under `src/ui/`; integration interfaces live under `src/utils/` so that the eventual implementations of `002-003-row-visibility` and `009-copy-as-csv` can replace the stubs in-place without touching `enrichments/`. Tests live alongside their source modules in `__tests__/` (unit) and under `tests/e2e/` (Playwright), matching the convention from `001-dynamic-sliders`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations.* The bundle-budget risk on Principle I is mitigated by the shared scaffold itself and is tracked as a per-renderer size target in tasks rather than as a constitution variance.
