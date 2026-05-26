# Implementation Plan: Cell Annotations Enrichment

**Branch**: `claude/determined-dijkstra-7qowD` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-cell-annotations/spec.md`

## Summary

Let users attach one short text note (≤ 280 chars) to any body cell while
Grid-Sight is enabled. Hovering or focusing a cell reveals a "pin" affordance;
clicking it opens an anchored popover (textarea + **Save** + **Delete**) reusing
the existing `installPopupChrome` focus-trap/Escape/outside-click machinery. A
saved note paints a persistent corner-triangle marker on the cell and wires the
cell's `aria-describedby` to a node holding the note text. Every annotation is
keyed by a load-time-stable `(table-key, row-key, column-key)` triple — never by
post-sort visual position — so notes follow their source cell across sort,
filter, and other enrichments. The full active set is serialised into a new
`gs.a` URL-fragment parameter that co-exists with `gs.s`/`gs.e`/`gs.v`, using the
same per-URL-stem write-back pattern as `src/utils/slider-persistence.ts`, with
**no** `localStorage`/`sessionStorage`/cookie use. A P3 "Show annotations" panel
in the GS surface lists every note with table+column context and scroll-targets
the cell on click. `annotations` is already registered (spec-only) in
`src/core/enrichment-registry.ts`; this feature flips it to `shipped: true` and
adds its `tearDown`.

## Technical Context

**Language/Version**: TypeScript ~5.8 (project compiler, `strict`,
`noUnusedLocals`/`noUnusedParameters`; emits ES2020+ via Vite).

**Primary Dependencies**:

- Runtime: **none new**. Built entirely on platform DOM, `encodeURIComponent`,
  `history.replaceState`, `Element.scrollIntoView`, `requestAnimationFrame`, and
  the existing in-repo `installPopupChrome`/lozenge/style-injection helpers.
  `shepherd.js` and `simple-statistics` remain untouched.
- Build/test: existing Vite 6, Vitest 3, Playwright 1.53, Storybook 9.

**Storage**: URL fragment only — a new `gs.a` parameter alongside `gs.s`
(sliders), `gs.e` (enrichment toggles), and `gs.v` (sort/filter). Per-URL-stem
(`origin + pathname`) write-back via `history.replaceState`, mirroring
`slider-persistence.ts`. **No** `localStorage`, `sessionStorage`, IndexedDB, or
cookies (FR-018) — this is the one place annotations deliberately diverge from
the slider scheme, which also writes `localStorage`.

**Testing**: Vitest unit tests (per-folder `__tests__/`) for the cell-identity
triple derivation, the `gs.a` codec (round-trip, orphan-drop, 8 KB cap,
opt-out filtering), and the 280-char clamp; Storybook 9 interaction tests for
the affordance reveal, popover keyboard contract, marker render, and panel
navigation; Playwright e2e for the four golden flows (annotate→marker, URL
round-trip on a clean profile, annotation survives sort/filter, panel
scroll-to-cell).

**Target Platform**: Evergreen browsers released within the last two years
(constitution §V). Must work from `file://` and fully offline (§VI).

**Project Type**: Browser library, single project. IIFE bundle
(`dist/grid-sight.iife.js`) + npm/ESM via `src/index.ts`.

**Performance Goals**:

- Re-opening a URL with up to **50 annotations** paints every marker within
  **one animation frame** of first paint (SC-002).
- Sort/filter/reorder keeps **100%** of annotations on their source cell, no
  visual drift (SC-004) — markers re-attach by identity triple, not position.
- Save is a single user-visible step (close popover + paint marker + write
  `gs.a`) within one frame (FR-009).

**Constraints**:

- Net IIFE delta MUST keep the bundle ≤ 10 KB gzipped (constitution §I).
  Feature budget: **≤ 2 KB gzipped** (SC-005), measured by
  `scripts/bundle-size.js` each PR.
- Note cap **280 chars** (enforced on input + paste-truncate); total `gs.a`
  fragment cap **8 KB** (refuse-and-warn on overflow, never silently drop —
  FR-017).
- Byte-identical DOM on toggle-off: `tearDown` removes every marker, affordance,
  injected `aria-describedby` node, popover, and panel — no residue.
- No network access anywhere on the runtime path (§VI).
- Keyboard + AT operability mandatory (§III): affordance focusable, popover
  focus-trapped, marker has accessible name, panel arrow-navigable, colour not
  the sole channel for the marker (§III, FR-024).

**Scale/Scope**: Up to ~10 tables/page, each up to ~1 000 rows × ~50 columns.
Up to 50 annotations/page comfortably; one note per cell (re-save replaces).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ✅ Pass | No new runtime dep. Net IIFE delta budgeted ≤ 2 KB gzipped (SC-005), measured each PR by `scripts/bundle-size.js`. Reuses existing popup-chrome / lozenge / style-injection helpers. |
| II. Test Discipline | ✅ Pass | Identity-triple, codec, and clamp covered by Vitest; affordance/popover/marker/panel covered by Storybook interaction tests; four golden flows by Playwright. Every FR maps to at least one test (see quickstart + contracts). |
| III. Accessibility by Default | ✅ Pass | Affordance keyboard-focusable and Tab-reachable (FR-002); popover focus lands in textarea, Tab cycles Save/Delete, Escape closes without saving (FR-006); marker has accessible name + `aria-describedby` (FR-004, FR-022); panel arrow/Enter/Escape navigable (FR-021); corner-triangle distinguishable in monochrome (FR-024). |
| IV. Progressive Enhancement | ✅ Pass | No DOM mutation until Grid-Sight is enabled and a cell is hovered/focused. Toggle-off restores byte-identical DOM via `tearDown`. Cells in tables with `data-gs-ignore`/`data-gs-no-annotate` are never touched (FR-012). Degrades silently on tables without stable keys (one console warning, FR-013). |
| V. Cross-Browser Compatibility | ✅ Pass | Only `scrollIntoView`, `requestAnimationFrame`, `history.replaceState`, `encodeURIComponent`, and standard DOM/CSS — all > 2 years across every evergreen engine. CSS corner marker via `::before`/`::after` (no new APIs). No feature-detection needed. |
| VI. Offline-First / Air-Gapped | ✅ Pass | URL fragment only; explicitly **no** `localStorage`/`sessionStorage`/cookies (FR-018); zero network calls; markers/affordance/popover are pure DOM+CSS, no external icons/fonts. |
| Development-Phase Posture | N/A | Pre-production; the `gs.a` fragment shape and the annotations module API are allowed to evolve before the production cut. |

**No constitution violations.** Complexity Tracking section intentionally empty.

**Post-design re-check (2026-05-26)**: After producing `research.md`,
`data-model.md`, `contracts/url-fragment-schema.md`,
`contracts/annotations-module-api.md`, and `quickstart.md`, every gate was
re-evaluated against the concrete shapes proposed. No new dependency, no network
call, no `localStorage` fallback, no API outside the published contract; the
bundle estimate (research R-7) stays inside the 2 KB net budget. Verdict
unchanged: passing on every principle.

## Project Structure

### Documentation (this feature)

```text
specs/006-cell-annotations/
├── plan.md                          # This file (/speckit-plan output)
├── spec.md                          # Feature specification (input)
├── research.md                      # Phase 0 — identity, persistence, popover, panel decisions
├── data-model.md                    # Phase 1 — Annotation, identity triple, persisted set, panel VM
├── quickstart.md                    # Phase 1 — annotate a cell + verify URL round-trip in < 5 min
├── contracts/
│   ├── url-fragment-schema.md       # Phase 1 — gs.a payload grammar + caps + opt-out rules
│   └── annotations-module-api.md    # Phase 1 — enrichments/annotations.ts public surface
└── tasks.md                         # Phase 2 output — created by /speckit-tasks (not here)
```

### Source Code (repository root)

Existing single-project layout is reused; this feature adds files under the
existing top-level groupings rather than introducing new top-level directories.

```text
src/
├── core/
│   └── enrichment-registry.ts                  # MODIFIED — flip `annotations` to shipped:true + add tearDown
├── enrichments/
│   ├── annotations.ts                          # NEW — apply/tearDown, in-memory store, save/delete orchestration
│   ├── annotation-identity.ts                  # NEW — (table-key, row-key, column-key) derivation + opt-out checks
│   ├── annotation-persistence.ts               # NEW — gs.a codec (read/write/encode/decode) + 8 KB cap
│   ├── annotation-styles.ts                    # NEW — injected CSS for affordance, corner marker, popover, panel
│   └── ...                                      # existing enrichments unchanged
├── ui/
│   ├── annotation-affordance.ts                # NEW — hover/focus pin affordance + persistent corner marker
│   ├── annotation-popover.ts                   # NEW — editor popover (textarea/Save/Delete) via installPopupChrome
│   ├── annotation-panel.ts                      # NEW — "Show annotations" page-level panel (P3) + GS-menu entry
│   ├── popup-chrome.ts                          # REUSED (no change) — focus trap / Escape / outside-click
│   └── ...                                      # existing UI unchanged
├── utils/
│   └── view-state-url.ts                        # REUSED — `colKey` for the column-key segment (no change)
└── index.ts                                     # MODIFIED — wire annotations apply into processTable; re-export public surface

src/enrichments/__tests__/
├── annotation-identity.test.ts                  # NEW — triple derivation, table-key preference, fallback warning
├── annotation-persistence.test.ts               # NEW — gs.a round-trip, orphan-drop, 8 KB cap, opt-out drop
└── annotations.test.ts                          # NEW — save replaces, delete removes, 280-char clamp, tearDown

src/ui/__tests__/
├── annotation-popover.test.ts                   # NEW — focus-on-open, Tab order, Escape, Delete-disabled gating
├── annotation-affordance.test.ts                # NEW — hover/focus reveal, marker render, aria-describedby
└── annotation-panel.test.ts                     # NEW — list grouping, empty state, keyboard nav, scroll-target

src/stories/
└── annotations.stories.ts                       # NEW — Storybook interaction coverage for the above

tests/e2e/
├── annotations.spec.ts                          # NEW — annotate → marker → re-open popover → delete
├── annotations-url.spec.ts                      # NEW — URL round-trip on a clean profile (no localStorage)
├── annotations-reorder.spec.ts                  # NEW — note survives sort + filter (SC-004)
└── annotations-panel.spec.ts                    # NEW — panel scroll-to-cell + marker pulse (P3)
```

**Structure Decision**: Reuse the existing single-project layout. The
enrichment's logic lives in `src/enrichments/annotations*.ts` (orchestration,
identity, persistence, styles) and its UI in `src/ui/annotation-*.ts`
(affordance/marker, popover, panel), mirroring how sort/filter split
`enrichments/*.ts` logic from `ui/*-lozenge.ts` / `ui/*-popup-*.ts` chrome. The
**only registry change** is flipping the pre-registered `annotations` entry to
`shipped: true` and giving it a `tearDown`. Persistence gets its own `gs.a`
codec module rather than overloading `slider-persistence.ts`, because
annotations are URL-only (no `localStorage`) and carry free-text values, not
numeric positions — same write-back discipline, different payload shape.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Section intentionally empty.
