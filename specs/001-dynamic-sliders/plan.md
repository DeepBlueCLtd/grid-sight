# Implementation Plan: Dynamic Sliders & Interactive Examples

**Branch**: `001-dynamic-sliders` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-dynamic-sliders/spec.md`

## Summary

Introduce continuous, pixel-precise sliders attached to numeric table axes, integrated
through Grid-Sight's existing plus-icon menu. Sliders drive live readouts via linear
(1-D) and bilinear (2-D) interpolation; they auto-sync across tables on the same page
that share an axis-header signature; their position is encoded in the URL for
bookmarking and falls back to `localStorage`. A heatmap variant adds a position marker
and a threshold slider that fades cells below a chosen value. No new runtime
dependencies; behaviour must work fully offline (constitution Principle VI).

## Technical Context

**Language/Version**: TypeScript ~5.8 (existing project compiler version; output ES2020+)
**Primary Dependencies**:
  - Runtime: none new. Existing `simple-statistics` is unrelated to this feature; no
    new addition. `shepherd.js` (tour library) is unrelated and not used here.
  - Build/test: existing Vite 6, Vitest 3, Playwright 1.53, Storybook 9 (unchanged).
**Storage**: `window.localStorage` (existing per-URL-stem persistence model) plus URL
  query/hash params for slider state.
**Testing**: Vitest unit tests (per-folder `__tests__/`), Storybook 9 interaction tests
  via `@storybook/addon-vitest`, Playwright e2e under `tests/e2e/`.
**Target Platform**: Evergreen browsers ≤ 2 years old (Chrome, Firefox, Safari, Edge,
  Chromium derivatives). Must function from `file://` (offline).
**Project Type**: Browser library, single project. IIFE bundle (`grid-sight.iife.js`)
  + npm/ESM via `src/index.ts` entry.
**Performance Goals**:
  - ≥ 60 FPS sustained during slider drag on a mid-range laptop (SC-004).
  - ≤ 16 ms (one animation frame) end-to-end input → readout update (SC-002, SC-005).
  - Interpolation O(log n) per axis via binary search across header values.
**Constraints**:
  - Bundle ceiling: published IIFE stays ≤ 10 KB gzipped (constitution §I).
  - No runtime network access (constitution §VI). No new deps.
  - Keyboard + AT operability mandatory (constitution §III, FR-019/FR-020).
  - Per-URL-stem persistence model unchanged (FR-014).
**Scale/Scope**: Up to ~10 tables per page, each up to ~50×50 cells; up to ~10 sliders
  active simultaneously; sync groups of up to ~5 tables. No multi-page state.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ✅ Pass | No new runtime deps; net additions stay within 10 KB ceiling. Bundle delta measured each PR. |
| II. Test Discipline | ✅ Pass | Vitest unit tests for interpolation, sync-key derivation, persistence; Storybook interaction tests for slider DOM; Playwright e2e for the three demo flows. |
| III. Accessibility by Default | ✅ Pass | `<input type="range">` semantics + ARIA-live readouts; arrow/Page/Home/End keys (FR-019); colour-independent threshold cue (fade, not just colour). |
| IV. Progressive Enhancement | ✅ Pass | Sliders are off by default; added via existing plus-icon menu. Library load injects no slider DOM unless added. Disabling cleanly removes (edge case). |
| V. Cross-Browser Compatibility | ✅ Pass | `<input type="range">`, Pointer Events, `URLSearchParams`, `IntersectionObserver` are all available in evergreen ≤ 2 years. No new APIs guarded. |
| VI. Offline-First / Air-Gapped | ✅ Pass | All assets embedded; no fetches. URL persistence is local — no remote round-trip. Confirmed in research.md. |
| Development-Phase Posture | N/A | Pre-production; backwards-compat freeze does not apply to this feature. Public API additions are flexible. |

**No constitution violations.** Complexity Tracking section below is intentionally empty.

**Post-design re-check (2026-05-01)**: After producing `research.md`, `data-model.md`,
`contracts/public-api.md`, and `quickstart.md`, the Constitution Check was
re-evaluated. Bundle estimate (R-9) is ~5.8 KB total — well within the 10 KB
ceiling. No new runtime dependencies introduced. All slider behaviour stays
client-side. Verdict: still passing on every principle.

## Project Structure

### Documentation (this feature)

```text
specs/001-dynamic-sliders/
├── plan.md              # This file
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 — decisions on interpolation, sync, persistence, a11y
├── data-model.md        # Phase 1 — Slider, AxisBinding, Readout, SyncKey, PersistedState
├── quickstart.md        # Phase 1 — how to wire a slider into a host page in <5 min
├── contracts/
│   └── public-api.md    # Phase 1 — new window.gridSight surface for sliders
├── checklists/
│   └── requirements.md  # Spec validation (already passing)
└── tasks.md             # Phase 2 output — created by /speckit-tasks (not by /speckit-plan)
```

### Source Code (repository root)

The existing single-project layout is reused; this feature adds files under the
existing top-level groupings rather than introducing new top-level dirs.

```text
src/
├── core/                            # existing: detection, processor
├── enrichments/
│   ├── slider.ts                    # NEW — registers "Add slider" / "Remove slider"
│   ├── slider-threshold.ts          # NEW — heatmap threshold variant (Story 4)
│   ├── heatmap.ts                   # existing — extended to expose colour-fade hook
│   └── ...
├── ui/
│   ├── slider-control.ts            # NEW — slider DOM, drag, keyboard, ARIA
│   ├── heatmap-marker.ts            # NEW — position marker overlay (Story 4)
│   ├── enrichment-menu.ts           # MODIFIED — add slider menu items
│   └── ...
├── utils/
│   ├── interpolation.ts             # NEW — linear (1-D) + bilinear (2-D) pure funcs
│   ├── sync-key.ts                  # NEW — derives identity from numeric header tuple
│   └── slider-persistence.ts        # NEW — URL ↔ localStorage round-trip
├── core/__tests__/                  # existing
├── enrichments/__tests__/
│   ├── slider.test.ts               # NEW
│   └── slider-threshold.test.ts     # NEW
├── ui/__tests__/
│   ├── slider-control.test.ts       # NEW (Storybook + interaction)
│   └── heatmap-marker.test.ts       # NEW
├── utils/__tests__/
│   ├── interpolation.test.ts        # NEW
│   ├── sync-key.test.ts             # NEW
│   └── slider-persistence.test.ts   # NEW
├── stories/
│   ├── Slider.stories.ts            # NEW
│   ├── SliderSync.stories.ts        # NEW
│   └── SliderHeatmap.stories.ts     # NEW
└── index.ts                         # MODIFIED — export slider entry points

tests/e2e/
├── slider-interpolation.spec.ts     # NEW — Story 1
├── slider-alt-models.spec.ts        # NEW — Story 2
├── slider-sync.spec.ts              # NEW — Story 3 + persistence
└── slider-heatmap.spec.ts           # NEW — Story 4 (marker + threshold)

public/demo/                         # existing demo pages
└── sliders/                         # NEW — three demo pages mirroring the
                                     #       reference mockups (offline copy)
```

**Structure Decision**: Single-project layout, additive only. Slider concerns split
across `enrichments/` (registration / orchestration), `ui/` (DOM + a11y), and `utils/`
(pure logic — interpolation, persistence, sync). One existing file is modified:
`ui/enrichment-menu.ts` to register the new menu entries. `index.ts` is extended to
export the new public surface (see `contracts/public-api.md`).

## Complexity Tracking

> *No constitution violations identified. Section intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
