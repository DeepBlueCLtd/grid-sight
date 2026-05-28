# Implementation Plan: Outlier Marker Enrichment

**Branch**: `claude/gracious-curie-D8uPj` (feature `004-outlier`) | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-outlier/spec.md`

## Summary

Add a fifth header lozenge (`!`) to qualifying numeric columns that flags cells
beyond a click-cycled `Nσ` threshold (`idle → 2σ → 1σ → 3σ → idle`). Each marked
cell gets a two-channel marker (coloured ring **and** a distinct border style)
plus a hover/focus tooltip stating value, mean, and signed σ distance. A
secondary affordance on the active lozenge opens a focus-trapped "outliers list"
dialog sorted by descending |σ|. The active threshold per `(table, column)` is
encoded in the URL fragment under a new `gs.o` parameter, reusing the per-URL-stem
helpers in `slider-persistence.ts` and the per-table directive encoding style of
`view-state-url.ts` (`gs.v`), so a view is shareable with no `localStorage`
dependency.

The enrichment slots into the existing descriptor model: the `outlier` catalog
entry already exists in `src/core/enrichment-registry.ts` as `shipped: false`;
this feature flips it to `shipped: true`, adds its `tearDown`/`apply` hooks, and
self-registers an `EnrichmentBehavior` (the lozenge) via `registerEnrichment`,
mirroring how `sort` and `filter` are wired in `src/ui/header-utils.ts`.

The single cross-cutting design decision is statistics consistency: the existing
`statistics.ts` enrichment computes **sample** σ (`÷ n−1`, via `simple-statistics`),
but the outlier spec requires **population** σ (`÷ n`) *and* that the two views
never disagree (FR-024 / SC-006). The plan resolves this by introducing one shared
`column-statistics` module that both enrichments consume, computing over an
identical numeric-cell set (filter-aware). See `research.md` R-1.

## Technical Context

**Language/Version**: TypeScript ~5.8 (project compiler; emits ES2020+). Strict
mode; `tsc` runs as part of `yarn build`.

**Primary Dependencies**: **No new runtime dependency.** Mean and population σ are
computed in plain TypeScript over a numeric array (spec Assumption "No new runtime
dependency"). `simple-statistics` is already present and used by `statistics.ts`;
the shared `column-statistics` module will expose mean + population σ without
adding any import beyond what is already bundled. DOM-only otherwise.

**Storage**: URL fragment (`location.hash`) is the source of truth for shared
state (`gs.o` parameter); `localStorage` is a same-machine convenience mirror
under the existing `gs:${stem}:outliers` key scheme. The per-cell marks and column
statistics are recomputed from the live DOM, never persisted.

**Testing**: Vitest unit suite (`src/enrichments/__tests__/outlier*.test.ts`,
`src/ui/__tests__/outlier-lozenge.test.ts`, `src/utils/__tests__/outlier-persistence.test.ts`,
`src/enrichments/__tests__/column-statistics.test.ts`); Storybook interaction
tests for the lozenge cycle and list popup; Playwright e2e
(`tests/e2e/outlier*.spec.ts`) for the one-click flow, threshold cycle,
filter-recompute, URL share round-trip, and Grid-Sight off teardown.

**Target Platform**: Evergreen browsers ≤ 2 years (constitution §V). Must work
from `file://` and fully offline (constitution §VI). Unit tests run in jsdom.

**Project Type**: Browser library, single project. IIFE bundle
(`dist/grid-sight.iife.js`) + npm/ESM via `src/index.ts`. This feature adds
`enrichments/` + `ui/` + `utils/` modules and one shared `core`-level stats helper;
it is **not** added to the frozen `window.gridSight.init` public surface.

**Performance Goals**: Per constitution runtime budget and SC-002 — activating or
cycling the threshold on a column of up to 1 000 numeric cells must mark/update in
**under 100 ms** on a mid-range laptop. Per SC-003, URL-restored marks must appear
within one animation frame of first paint. Marking is a single O(n) pass over the
column's numeric cells (compute stats once, then a comparison per cell).

**Constraints**:

- **Two-channel marker** (FR-006, constitution §III): colour ring **and**
  border-style change; colour alone insufficient.
- **Byte-identical teardown** (FR-021, SC-005): toggling Grid-Sight off (or the
  enrichment off) removes every marker, tooltip, and popup, restoring DOM
  byte-identical to pre-flagging state (excluding GS-injected nodes). The encoded
  `gs.o` threshold state stays in the URL so re-enabling restores it.
- **Statistics agreement** (FR-024, SC-006): outlier tooltip mean/σ must match the
  statistics popup to floating-point round-off — enforced by a single shared
  computation path, not two parallel ones.
- **Filter-aware** (FR-008, spec Assumption): when any `gs.v` filter is active, σ
  and mean are computed over currently un-dimmed rows, and marks recompute on every
  `onVisibleRowsChange` emission.
- **No new runtime deps; bundle within budget** (constitution §I): target a net
  IIFE delta of **≤ 1.5 KB gzipped**; measured by `scripts/bundle-size.js`.
- **No network** (constitution §VI): pure in-memory DOM + math.

**Scale/Scope**: Up to ~10 tables/page, each up to ~1 000 rows × ~50 columns, with
sort + per-column filters + sliders + virtual columns potentially active at once.
Outlier marks must stay correct under sort reorder and filter dimming, and recompute
within budget when the un-dimmed row set changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ✅ Pass | No new runtime dependency — mean/σ in plain TS; no statistics library added (spec Assumption). Net IIFE delta budgeted ≤ 1.5 KB gzipped; the shared `column-statistics` module *removes* a duplicated computation path. Measured by `scripts/bundle-size.js`. |
| II. Test Discipline | ✅ Pass | New Vitest unit suites (stats, persistence, lozenge cycle, marking), Storybook interaction tests, and Playwright e2e covering all four user stories. Full unit + e2e green before merge (SC-005). |
| III. Accessibility by Default | ✅ Pass | Lozenge keyboard-operable (Enter/Space cycle), `aria-pressed` + live accessible name (FR-004/FR-018); marker uses two non-colour-dependent channels (FR-006); per-cell tooltip reachable by keyboard focus, not hover only (FR-007/FR-019); list popup is a focus-trapping `role="dialog"` with Escape→return focus (FR-020), reusing `installPopupChrome`. |
| IV. Progressive Enhancement | ✅ Pass | Lozenge only offered on qualifying columns (≥ 3 numeric cells, not rowspan); columns with σ = 0 render an inert, explanatory lozenge (FR-009); < 3 numeric cells render no lozenge (FR-010). No throw into the host page when data is missing. Works as IIFE include and ESM import. |
| V. Cross-Browser Compatibility | ✅ Pass | DOM (`HTMLTable*`, `getBoundingClientRect`), `Array.from`, `history.replaceState`, `localStorage` (guarded), `WeakMap` — all > 2 years on every engine; `localStorage` already guarded in `slider-persistence.ts`. No newly-shipped APIs. |
| VI. Offline-First / Air-Gapped | ✅ Pass | Zero network. No fonts/icons fetched — the `!` glyph and any list markup are text/CSS embedded in the bundle. URL + `localStorage` only. |
| Development-Phase Posture | N/A (favourable) | Pre-production: introducing the shared `column-statistics` module and switching `statistics.ts` from sample to population σ is permitted without a backwards-compat window (this changes a displayed number; covered by updated tests). Not added to the frozen public API. |

**No constitution violations.** Complexity Tracking section intentionally empty.

**Post-design re-check (2026-05-28)**: After producing `research.md`,
`data-model.md`, `contracts/`, and `quickstart.md`, every gate was re-evaluated
against the concrete module/API shape. No new runtime dependency, no network call,
two-channel marker confirmed, teardown path byte-identical, shared stats path
guarantees FR-024/SC-006, and nothing added to `window.gridSight.init`. Bundle
estimate holds. Verdict unchanged: passing on every principle.

## Project Structure

### Documentation (this feature)

```text
specs/004-outlier/
├── plan.md                       # This file (/speckit-plan output)
├── spec.md                       # Feature specification (input)
├── research.md                   # Phase 0 — σ convention, persistence param, filter recompute, glyph
├── data-model.md                 # Phase 1 — Outlier Directive / Column Statistics / Outlier Mark / Persisted state
├── quickstart.md                 # Phase 1 — wire & verify the enrichment end-to-end
├── contracts/
│   ├── outlier-enrichment-api.md # Phase 1 — module surface (compute, mark, persist, lozenge, popup)
│   └── url-fragment-schema.md    # Phase 1 — the gs.o persistence grammar
└── tasks.md                      # Phase 2 output — created by /speckit-tasks (NOT here)
```

### Source Code (repository root)

Reuses the existing single-project layout (`src/{core,ui,enrichments,utils}`). The
shared statistics helper goes in `core/` (foundational, consumed by both
`enrichments/statistics.ts` and the new outlier module — placing it in `core/`
avoids an `enrichments → enrichments` coupling and mirrors `column-types-cache.ts`).

```text
src/
├── core/
│   ├── column-statistics.ts             # NEW — shared mean + population σ over a filter-aware numeric-cell set
│   ├── enrichment-registry.ts           # MODIFIED — flip `outlier` to shipped:true; add tearDown + apply
│   ├── table-grid.ts                    # UNCHANGED — columnCells/cellValue used to read column values
│   └── type-detection.ts                # UNCHANGED — cleanNumericCell parses cell values
├── enrichments/
│   ├── outlier.ts                       # NEW — orchestrator: apply/teardown, compute marks, filter subscription
│   ├── outlier-marks.ts                 # NEW — pure mark computation (values+stats+threshold → OutlierMark[])
│   ├── outlier-styles.ts                # NEW — injected CSS for marker (ring + border) and tooltip
│   └── statistics.ts                    # MODIFIED — delegate mean/σ to column-statistics (population σ)
├── ui/
│   ├── outlier-lozenge.ts               # NEW — the `!` lozenge: idle→2σ→1σ→3σ cycle, aria-pressed, secondary affordance
│   ├── outlier-popup.ts                 # NEW — focus-trapped "outliers list" dialog (uses popup-chrome)
│   ├── outlier-tooltip.ts               # NEW — per-cell value/mean/σ tooltip on hover + focus
│   └── header-utils.ts                  # MODIFIED — register the outlier EnrichmentBehavior
├── utils/
│   └── outlier-persistence.ts           # NEW — gs.o URL/localStorage codec (mirrors slider-persistence/view-state-url)
└── index.ts                             # MODIFIED — call applyOutliers(table) in processTable; teardown in disable()

src/enrichments/__tests__/
├── column-statistics.test.ts            # NEW — population σ; agreement contract; filter-aware set
├── outlier-marks.test.ts                # NEW — threshold math, σ=0 inert, non-numeric exclusion, n<3
└── outlier.test.ts                      # NEW — apply/teardown round-trip; filter recompute; sort follow

src/ui/__tests__/
├── outlier-lozenge.test.ts              # NEW — cycle order, aria-pressed/name, inert state, secondary affordance
└── outlier-popup.test.ts                # NEW — sort order, row scroll/highlight, Escape/outside-click close + focus return

src/utils/__tests__/
└── outlier-persistence.test.ts          # NEW — encode/decode gs.o, missing table/column ignored, param coexistence

tests/e2e/
├── outlier.spec.ts                      # NEW — US1 one-click 2σ + tooltip; US2 cycle
├── outlier-list.spec.ts                 # NEW — US3 list popup sort + scroll-to-row
├── outlier-url-share.spec.ts            # NEW — US4 URL round-trip in fresh context, missing-column ignored
└── outlier-filter-and-toggle.spec.ts    # NEW — filter recompute; Grid-Sight off teardown (byte-identical)

src/stories/
└── outlier.stories.ts                   # NEW — interaction stories for lozenge cycle + list popup

demo/                                    # MODIFIED — add an outlier section to a demo page (docs §"Demo page")
docs/adding-an-enrichment.md             # REFERENCE — the full ship checklist this plan/tasks must satisfy
```

**Structure Decision**: Reuse the existing single-project layout and the
descriptor model already in place. The outlier enrichment follows the exact
wiring of `sort`/`filter`: a static catalog entry (already present) + a
self-registered `EnrichmentBehavior` for the lozenge + an `apply`/`tearDown`
pair in the registry + an `apply<Feature>(table)` call from `index.ts`. The one
new shared primitive — `src/core/column-statistics.ts` — is placed in `core/`
because two `enrichments/` modules consume it, exactly as `column-types-cache.ts`
sits below the feature modules. `docs/adding-an-enrichment.md` is the binding
checklist for `/speckit-tasks`: every section there must map to at least one task.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Section intentionally empty.
