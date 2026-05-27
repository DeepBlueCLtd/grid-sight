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
filter, and other enrichments. Annotations persist to **`localStorage`**, keyed
per document under the same `gs:` per-URL-stem (`origin + pathname`) scheme as
`src/utils/slider-persistence.ts`, each note carrying a last-modified timestamp;
there is **no** URL-fragment persistence and **no** network on the persistence
path. A P3 "Show annotations" popup scans every `localStorage` annotation key for
the current origin and lists all notes grouped by document with their dates;
clicking an entry scroll-targets the cell in place, or navigates to the other
document (same origin) and scrolls there on load via a transient cell-target URL
hint. `annotations` is already registered (spec-only) in
`src/core/enrichment-registry.ts`; this feature flips it to `shipped: true` and
adds its `tearDown`.

## Technical Context

**Language/Version**: TypeScript ~5.8 (project compiler, `strict`,
`noUnusedLocals`/`noUnusedParameters`; emits ES2020+ via Vite).

**Primary Dependencies**:

- Runtime: **none new**. Built entirely on platform DOM, `localStorage`,
  `Element.scrollIntoView`, `requestAnimationFrame`, `history.replaceState`
  (transient cell-target hint only), and the existing in-repo
  `installPopupChrome`/lozenge/style-injection helpers. `shepherd.js` and
  `simple-statistics` remain untouched.
- Build/test: existing Vite 6, Vitest 3, Playwright 1.53, Storybook 9.

**Storage**: **`localStorage` only.** One key per document,
`gs:${origin+pathname}:annotations`, holding a versioned envelope
`{ version, title?, entries }` where `entries` maps the identity triple to
`{ text, modifiedAt }`. This reuses the `gs:` prefix and per-URL-stem derivation
of `slider-persistence.ts` (`storageKeyFor`/`urlStem`), but is a distinct key
(`annotations` suffix) and a distinct payload shape (free text + timestamp, not
numeric positions). The cross-document popup enumerates `localStorage` keys
matching `gs:*:annotations` for the current origin. The **URL fragment is not a
persistence channel** — it carries only a transient `gs.annot` cell-target hint
when navigating from the popup, consumed and cleared on load.

**Testing**: Vitest unit tests for the cell-identity triple derivation, the
`localStorage` codec (round-trip, versioned envelope, orphan-drop, opt-out drop,
quota-refuse, timestamp), the cross-document index builder, and the 280-char
clamp; Storybook 9 interaction tests for the affordance reveal, popover keyboard
contract, marker render, and popup navigation; Playwright e2e for the golden
flows (annotate→marker→reload-survives, note survives sort/filter, popup
scroll-to-cell same-doc, popup navigate-to-other-doc-then-scroll).

**Target Platform**: Evergreen browsers released within the last two years
(constitution §V). Must work from `file://` and fully offline (§VI); degrades to
session-only when `localStorage` is unavailable (FR-017).

**Project Type**: Browser library, single project. IIFE bundle
(`dist/grid-sight.iife.js`) + npm/ESM via `src/index.ts`.

**Performance Goals**:

- Re-opening a document with up to **50 annotations** paints every marker within
  **one animation frame** of first paint (SC-002).
- Sort/filter/reorder keeps **100%** of annotations on their source cell, no
  visual drift (SC-004) — markers re-attach by identity triple, not position.
- Save is a single user-visible step (close popover + paint marker + write
  `localStorage`) within one frame (FR-009).

**Constraints**:

- Net IIFE delta MUST keep the bundle ≤ 10 KB gzipped (constitution §I).
  Feature budget: **≤ 2 KB gzipped** (SC-005), measured by
  `scripts/bundle-size.js` each PR.
- Note cap **280 chars** (enforced on input + paste-truncate). No URL-size cap
  (annotations are not in the URL); `localStorage` quota is handled by
  refuse-and-warn (FR-017), never silently dropping existing notes.
- Byte-identical DOM on toggle-off: `tearDown` removes every marker, affordance,
  injected `aria-describedby` node, popover, and popup — no residue. Stored
  notes are left in `localStorage` so toggle-on re-hydrates.
- No network access anywhere on the runtime path (§VI). `localStorage` is local
  and fully offline-compatible.
- Keyboard + AT operability mandatory (§III): affordance focusable, popover
  focus-trapped, marker has accessible name, popup arrow-navigable, colour not
  the sole channel for the marker (§III, FR-025).

**Scale/Scope**: Up to ~10 tables/page, each up to ~1 000 rows × ~50 columns.
Dozens of annotations per document and across documents on an origin; one note
per cell (re-save replaces and re-timestamps).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ✅ Pass | No new runtime dep. Net IIFE delta budgeted ≤ 2 KB gzipped (SC-005), measured each PR by `scripts/bundle-size.js`. Reuses existing popup-chrome / lozenge / style-injection / `storageKeyFor` helpers. |
| II. Test Discipline | ✅ Pass | Identity-triple, `localStorage` codec, cross-document index, and clamp covered by Vitest; affordance/popover/marker/popup covered by Storybook interaction tests; golden flows by Playwright. Every FR maps to at least one test (see quickstart + contracts). |
| III. Accessibility by Default | ✅ Pass | Affordance keyboard-focusable and Tab-reachable (FR-002); popover focus lands in textarea, Tab cycles Save/Delete, Escape closes without saving (FR-006); marker has accessible name + `aria-describedby` (FR-004, FR-023); popup arrow/Enter/Escape navigable (FR-022); corner-triangle distinguishable in monochrome (FR-025). |
| IV. Progressive Enhancement | ✅ Pass | No DOM mutation until Grid-Sight is enabled and a cell is hovered/focused. Toggle-off restores byte-identical DOM via `tearDown`. Cells in tables with `data-gs-ignore`/`data-gs-no-annotate` are never touched (FR-012). Degrades to session-only without throwing when `localStorage` is unavailable (FR-017); one console warning on index-fallback (FR-013). |
| V. Cross-Browser Compatibility | ✅ Pass | Only `localStorage`, `scrollIntoView`, `requestAnimationFrame`, `history.replaceState`, and standard DOM/CSS — all > 2 years across every evergreen engine. CSS corner marker via `::before`/`::after`. `localStorage` access is wrapped in try/catch with graceful fallback (FR-017). |
| VI. Offline-First / Air-Gapped | ✅ Pass | Persistence is `localStorage` — entirely local, zero network calls on any path; markers/affordance/popover/popup are pure DOM+CSS with no external icons/fonts. Works identically from `file://`, internal mirror, or air-gapped network (degrading to session-only only where the browser itself blocks storage). |
| Development-Phase Posture | N/A | Pre-production; the `localStorage` envelope shape and the annotations module API are allowed to evolve before the production cut. |

**No constitution violations.** Complexity Tracking section intentionally empty.

**Post-design re-check (2026-05-26)**: After producing `research.md`,
`data-model.md`, `contracts/localstorage-schema.md`,
`contracts/annotations-module-api.md`, and `quickstart.md`, every gate was
re-evaluated against the concrete shapes proposed. No new dependency, no network
call, no API outside the published contract; `localStorage` access is fully
guarded; the bundle estimate (research R-7) stays inside the 2 KB net budget.
Verdict unchanged: passing on every principle.

## Project Structure

### Documentation (this feature)

```text
specs/006-cell-annotations/
├── plan.md                          # This file (/speckit-plan output)
├── spec.md                          # Feature specification (input)
├── research.md                      # Phase 0 — identity, localStorage persistence, popover, popup decisions
├── data-model.md                    # Phase 1 — Annotation, identity triple, per-doc set, cross-doc index
├── quickstart.md                    # Phase 1 — annotate a cell + verify reload + cross-doc popup in < 5 min
├── contracts/
│   ├── localstorage-schema.md       # Phase 1 — per-document localStorage envelope + key scheme + caps
│   └── annotations-module-api.md    # Phase 1 — annotations module public surface
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
│   ├── annotation-persistence.ts               # NEW — per-document localStorage codec (read/write/encode/decode) + quota guard + timestamp
│   ├── annotation-index.ts                     # NEW — cross-origin-document index: scan gs:*:annotations keys, build popup view model
│   ├── annotation-styles.ts                    # NEW — injected CSS for affordance, corner marker, popover, popup
│   └── ...                                      # existing enrichments unchanged
├── ui/
│   ├── annotation-affordance.ts                # NEW — hover/focus pin affordance + persistent corner marker
│   ├── annotation-popover.ts                   # NEW — editor popover (textarea/Save/Delete) via installPopupChrome
│   ├── annotation-popup.ts                      # NEW — "Show annotations" cross-document popup (P3) + GS-menu entry
│   ├── popup-chrome.ts                          # REUSED (no change) — focus trap / Escape / outside-click
│   └── ...                                      # existing UI unchanged
├── utils/
│   ├── slider-persistence.ts                    # REUSED — `storageKeyFor`/`urlStem` stem derivation (may export if not already)
│   └── view-state-url.ts                        # REUSED — `colKey` for the column-key segment (no change)
└── index.ts                                     # MODIFIED — wire annotations apply into processTable; consume gs.annot hint; re-export public surface

src/enrichments/__tests__/
├── annotation-identity.test.ts                  # NEW — triple derivation, table-key preference, fallback warning
├── annotation-persistence.test.ts               # NEW — localStorage round-trip, envelope, orphan-drop, opt-out drop, quota-refuse, timestamp
├── annotation-index.test.ts                     # NEW — cross-document scan, grouping, ordering, empty state
└── annotations.test.ts                          # NEW — save replaces+re-timestamps, delete removes, 280-char clamp, tearDown, session-only fallback

src/ui/__tests__/
├── annotation-popover.test.ts                   # NEW — focus-on-open, Tab order, Escape, Delete-disabled gating, quota inline error
├── annotation-affordance.test.ts                # NEW — hover/focus reveal, marker render, aria-describedby
└── annotation-popup.test.ts                     # NEW — list grouping, dates, empty state, keyboard nav, same-doc scroll vs cross-doc navigate

src/stories/
└── annotations.stories.ts                       # NEW — Storybook interaction coverage for the above

tests/e2e/
├── annotations.spec.ts                          # NEW — annotate → marker → re-open popover → delete
├── annotations-persist.spec.ts                  # NEW — reload survives via localStorage (no network)
├── annotations-reorder.spec.ts                  # NEW — note survives sort + filter (SC-004)
└── annotations-popup.spec.ts                    # NEW — cross-document popup: same-doc scroll + navigate-to-other-doc-then-scroll (P3)
```

**Structure Decision**: Reuse the existing single-project layout. The
enrichment's logic lives in `src/enrichments/annotations*.ts` (orchestration,
identity, persistence, cross-document index, styles) and its UI in
`src/ui/annotation-*.ts` (affordance/marker, popover, popup), mirroring how
sort/filter split `enrichments/*.ts` logic from `ui/*-lozenge.ts` /
`ui/*-popup-*.ts` chrome. The **only registry change** is flipping the
pre-registered `annotations` entry to `shipped: true` and giving it a
`tearDown`. Persistence gets its own `localStorage` codec rather than overloading
`slider-persistence.ts`, because annotations carry free-text values with
timestamps (not numeric positions) and are URL-free — but it reuses that file's
`gs:` key prefix and per-URL-stem derivation so the two feature stores live
side-by-side under one consistent scheme. The cross-document index
(`annotation-index.ts`) is the one genuinely new capability: it reads *other*
documents' annotation keys for the current origin to back the popup.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Section intentionally empty.
