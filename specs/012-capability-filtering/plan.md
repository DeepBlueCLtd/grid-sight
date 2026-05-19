# Implementation Plan: Per-Page Enrichment Capability Filtering

**Branch**: `claude/add-capability-filtering-dTXwp` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-capability-filtering/spec.md`

## Summary

Introduce a single in-library **enrichment registry** that names every Grid-Sight
enrichment by a stable identifier (`heatmap`, `sliders`, `sort`, …) and records its
default-on flag and human-readable label. Pages opt into a narrower set by declaring
`window.gridSight.pageConfig.enrichments` (or passing `enrichments` to `init()`)
**before** Grid-Sight initialises. The lozenge-spec assembly in `src/ui/header-utils.ts`
and the menu-item filter in `src/ui/enrichment-menu.ts` both consult the resolved
enabled set and filter out specs whose `id` is not in it; the result is that
disabled enrichments leave **no** lozenge, **no** menu entry, and **no** URL-state
activation. A second, opt-in **runtime toggle panel** lets a visitor flip
enrichments on and off live; its state persists per URL stem by sharing the
existing `src/utils/slider-persistence.ts` helpers (URL fragment `gs.e=…` and
`localStorage` key `gs:<stem>:enrichments` with the existing `{ version, entries }`
wrapper) and takes precedence over the static page config for that visitor. The
existing five demo pages (`public/demo/index.html` and the four `public/demo/sliders/*`)
each declare an explicit subset; one new demo (`public/demo/toggle/live-enrichments.html`)
showcases the runtime panel. No new runtime dependencies; net bundle growth ≤ 1 KB
gzipped, enforced by re-hardening the existing `scripts/bundle-size.js` (constitution §I).

Review fixes folded into this revision (see research R-1.1, revised R-4, new R-10,
new R-11): align `EnrichmentType` ids in `enrichment-menu.ts` with the registry
(rename `slider` → `sliders`, `threshold-slider` → `slider-threshold`, collapse
`toggle-sliders` into `sliders`, retire `zscore`/`aggregate`); share slider
persistence helpers rather than duplicate them; cache per-table column types via a
WeakMap so the refresh path is bounded by header count, not cell count; wrap every
`tearDown(table)` call in try/catch and emit a single console warning on throw;
abort runtime refresh and detach listeners when the panel's container becomes
detached from the document; re-enable the 10 KB gzipped ceiling in
`scripts/bundle-size.js` and surface the current bundle baseline before merging.

## Technical Context

**Language/Version**: TypeScript ~5.8 (existing project compiler version; output ES2020+)

**Primary Dependencies**:

- Runtime: none new. Existing `simple-statistics`, `shepherd.js` unrelated to this feature.
- Build/test: existing Vite 6, Vitest 3, Playwright 1.53, Storybook 9 (unchanged).

**Storage**: `window.localStorage` (existing per-URL-stem persistence) plus URL fragment params for visitor-set enabled set.

**Testing**: Vitest unit tests in `src/**/__tests__/`, Storybook 9 interaction tests via `@storybook/addon-vitest`, Playwright e2e under `tests/e2e/`.

**Target Platform**: Evergreen browsers ≤ 2 years old (Chrome, Firefox, Safari, Edge, Chromium derivatives). Must function from `file://` (offline).

**Project Type**: Browser library, single project. IIFE bundle (`grid-sight.iife.js`) plus npm/ESM via `src/index.ts` entry.

**Performance Goals**:

- Filter check at lozenge-spec build time: O(1) `Set` lookup per candidate spec.
- Runtime toggle: lozenge add / remove + cleanup completes within one animation frame (≤ 16 ms) on a mid-range laptop (SC-004).
- No re-layout cost beyond the lozenge mutation itself; no full re-process of table data.

**Constraints**:

- Net bundle delta ≤ 1 KB gzipped for the whole feature (SC-007 + constitution §I).
- Runtime toggle panel is opt-in per page but its **code** is part of the bundle; it must be tight enough to fit within the 1 KB total.
- No runtime network access (constitution §VI). No new deps.
- Keyboard + AT operability for the panel (FR-021 + constitution §III).
- Per-URL-stem persistence model unchanged.

**Scale/Scope**: Same as host-page scope — up to ~10 tables per page, up to ~14 registered enrichment ids today (room to grow). Toggle panel lists every registered id; expected list length 10–20 over the next year.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ✅ Pass | No new runtime deps. Net additions targeted ≤ 1 KB gzipped (SC-007); measured each PR. |
| II. Test Discipline | ✅ Pass | Vitest unit tests for registry resolution / config parsing / persistence; Storybook interaction tests for the toggle panel; Playwright e2e for one demo subset and the live-toggle demo. |
| III. Accessibility by Default | ✅ Pass | Toggle panel uses native `<input type="checkbox">` with associated `<label>`; arrow/tab focus order; `aria-live` not required since each control's state is conveyed by the checkbox itself. No colour-only signalling. |
| IV. Progressive Enhancement | ✅ Pass | Pages without a page-config behave exactly as today (FR-008). Toggle panel is opt-in (FR-013); pages that do not request it pay only the bundle cost. Library still works as IIFE drop-in and as ESM. |
| V. Cross-Browser Compatibility | ✅ Pass | `Set`, `URLSearchParams`, `localStorage`, native checkboxes all available in evergreen ≤ 2 years. No new APIs guarded. |
| VI. Offline-First / Air-Gapped | ✅ Pass | All logic client-side. URL + localStorage persistence uses already-resident state. No fetches. |
| Development-Phase Posture | N/A | Pre-production; backwards-compat freeze does not apply. `window.gridSight.pageConfig` is a new surface introduced explicitly under the waiver. |

**No constitution violations.** Complexity Tracking section below is intentionally empty.

**Post-design re-check (2026-05-19)**: After producing `research.md`, `data-model.md`,
`contracts/public-api.md`, and `quickstart.md`, the Constitution Check was
re-evaluated. Bundle estimate (R-7) is ~0.7 KB gzipped — under the 1 KB feature
budget. No new runtime dependencies introduced. All behaviour stays client-side
(constitution §VI). Verdict: still passing on every principle.

**Post-review re-check (2026-05-19, after `/speckit-review` Compressed mode and
revisions 1A/2A/3A/4A + three failure-mode guards)**: The Constitution Check
was re-evaluated against the revised plan.

- **Principle I (Lightweight)**: bundle estimate revised to ~0.89 KB gzipped
  (R-7) — still under the 1 KB feature target. Enforcement of the 10 KB
  absolute ceiling moves from "informational" back to a hard gate by editing
  the existing `scripts/bundle-size.js` (R-11). Pass — with the open question
  that the implementation PR MUST measure the current bundle and either
  bundle-cut to <10 KB or land an explicit constitution amendment before
  flipping enforcement on.
- **Principle II (Test Discipline)**: two new test files added in this
  revision (`enrichment-menu-filter.test.ts`, `header-utils.refresh.test.ts`)
  close the FR-010 acceptance gap and the column-types-cache coverage gap.
  Bundle-size assertion (3A / R-11) closes the silent-failure gap on the
  bundle ceiling. Pass.
- **Principle III (Accessibility)**: unchanged. Pass.
- **Principle IV (Progressive Enhancement)**: unchanged; the
  container-resilience guard (R-5 addition) makes the panel safer in SPA
  hosts. Pass.
- **Principle V (Cross-Browser)**: `WeakMap` (R-10) is available in evergreen
  ≤ 2 years. Pass.
- **Principle VI (Offline-First)**: unchanged. Pass.
- **Development-Phase Posture**: the `EnrichmentType` rename in
  `enrichment-menu.ts` (R-1.1) is a breaking change to internal types, which
  the posture explicitly waives. Pass.

Verdict: still passing on every principle. One open question (R-11 — current
bundle baseline vs the 10 KB ceiling at the moment enforcement is flipped on)
is recorded for the implementation task list rather than blocking the plan.

## Project Structure

### Documentation (this feature)

```text
specs/012-capability-filtering/
├── plan.md              # This file
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 — decisions on registry shape, config surface, panel, persistence
├── data-model.md        # Phase 1 — EnrichmentRegistry, PageEnrichmentConfig, EffectiveEnabledSet
├── quickstart.md        # Phase 1 — wire a subset into a host page in <5 min
├── contracts/
│   └── public-api.md    # Phase 1 — new window.gridSight.pageConfig + init() option surface
├── checklists/
│   └── requirements.md  # Spec validation (already passing)
└── tasks.md             # Phase 2 output — created by /speckit-tasks (not by /speckit-plan)
```

### Source Code (repository root)

The existing single-project layout is reused. Filtering concerns are concentrated in
one new core module + one new UI module, with a small change to the lozenge-spec
assembly in `src/ui/header-utils.ts`.

```text
src/
├── core/
│   ├── enrichment-registry.ts        # NEW — canonical id → { label, defaultOn, tearDown? }
│   ├── page-config.ts                # NEW — reads window.gridSight.pageConfig + init() options
│   ├── effective-enabled-set.ts      # NEW — resolves visitor > page > defaults
│   └── column-types-cache.ts         # NEW (review fix 4A) — WeakMap<HTMLTableElement, ColumnType[]>
├── ui/
│   ├── header-utils.ts               # MODIFIED — filter LozengeSpec[] by effective enabled set; consult columnTypes cache on refresh
│   ├── toggle-panel.ts               # NEW — opt-in runtime visitor toggle UI; container.isConnected guard; tearDown try/catch wrap
│   └── enrichment-menu.ts            # MODIFIED — rename EnrichmentType ids (review fix 2A); filter ENRICHMENT_ITEMS by effective enabled set
├── utils/
│   └── slider-persistence.ts         # MODIFIED (review fix 1A) — parameterise readFromUrl/writeUrlHash/readFromStorage/writeToStorage by key/suffix; widen PersistedState.entries to string[] | Record<string, number>
├── core/__tests__/
│   ├── enrichment-registry.test.ts   # NEW
│   ├── page-config.test.ts           # NEW
│   ├── effective-enabled-set.test.ts # NEW
│   └── column-types-cache.test.ts    # NEW (review fix 4A)
├── ui/__tests__/
│   ├── toggle-panel.test.ts          # NEW (Storybook + interaction)
│   ├── enrichment-menu-filter.test.ts # NEW (review fix 3A — FR-010 acceptance)
│   └── header-utils.refresh.test.ts  # NEW (review fix 4A — spy on inferHeaderColumnType not invoked on cache hit)
├── utils/__tests__/
│   ├── slider-persistence.test.ts    # MODIFIED — exercises generic helpers via slider call sites (no behaviour change)
│   └── slider-persistence.enrichments.test.ts # NEW — gs.e + string[] entries round-trip
├── stories/
│   └── TogglePanel.stories.ts        # NEW
└── index.ts                          # MODIFIED — read pageConfig at init; expose pageConfig type; call clearColumnTypes on disable()

tests/e2e/
├── capability-filtering.spec.ts      # NEW — Story 1 + Story 3 (demo subsets on the five real demos)
└── capability-filtering-toggle.spec.ts # NEW — Story 2 (live toggle + persistence)

public/demo/
├── index.html                        # MODIFIED — declares full shipped-enrichment subset
├── sliders/interpolation.html        # MODIFIED — declares ['heatmap','sliders','statistics']
├── sliders/alternate-calc-models.html # MODIFIED — declares ['sliders','statistics']
├── sliders/synced-tables.html        # MODIFIED — declares ['sliders']
├── sliders/heatmap.html              # MODIFIED — declares ['heatmap','sliders','slider-threshold']
└── toggle/                           # NEW
    └── live-enrichments.html         # NEW — runtime toggle demo (Story 2 / FR-020)

scripts/
└── bundle-size.js                    # MODIFIED (review fix 3A / R-11) — re-enable 10 KB gzipped ceiling; exit 1 on overage; --soft flag for warn-only local builds
```

**Structure Decision**: Single-project layout, additive on the new modules and
**refactor-in-place** for the shared persistence helpers. The registry is the
single new source of truth; the page-config and effective-set resolvers are
stateless pure functions sized for unit testing. The filter integration into
`header-utils.ts` and `enrichment-menu.ts` is a two-line change inside each call
site's spec-collection loop, so the existing lozenge tests continue to cover
the happy path and the new unit tests cover the filter semantics in isolation.
The toggle panel sits in its own module so it does not bleed into pages that
don't opt in to it. The column-types cache is a tiny WeakMap helper that
processTable populates once per table and the refresh path consults instead of
re-walking cell content.

**Notable structural change vs the original plan**: there is no new
`utils/enrichment-persistence.ts` module. Sharing the existing slider-persistence
helpers via parameterisation is both DRY (review issue 1) and cheaper on bundle
budget (R-7 saves ~0.05 KB).

## Complexity Tracking

> *No constitution violations identified. Section intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
