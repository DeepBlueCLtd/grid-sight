# Implementation Plan: Copy Table As CSV / TSV / Markdown

**Branch**: `claude/confident-johnson-aszaK` | **Date**: 2026-06-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-copy-as-csv/spec.md`

## Summary

Add a table-level **Copy** enrichment that serialises a table's *current visible
view* (post-sort, post-filter, with optional Grid-Sight virtual columns) to the
clipboard as CSV, TSV, or GitHub-flavoured Markdown. A corner-cluster lozenge
opens a small modal dialog (format radios + three option checkboxes + Copy /
Close); pressing **Copy** writes the serialised text to the system clipboard and
announces an `aria-live` toast, falling back to a pre-selected textarea when the
asynchronous clipboard interface is unavailable or denied. The most-recent
format and the three booleans persist per page in the URL fragment (plus
localStorage) using the established view-state mechanism.

The feature is almost entirely a **consumer** of existing infrastructure rather
than new machinery: it reads the visible view through `visibleBodyRows`
(`src/utils/visible-rows.ts`), reads canonical cell text and column structure
through the `table-grid` addressing layer (`src/core/table-grid.ts`), pulls
appended-column text from the already-populated `copy-as-csv-registry`
(`src/utils/copy-as-csv-registry.ts`), mounts via the shared enrichment
descriptor model (`registerEnrichment`), and reuses `installPopupChrome` /
`positionPopup` (`src/ui/popup-chrome.ts`) for the dialog. The only genuinely
new logic is three pure serialisers and a small page-level persistence module.

## Technical Context

**Language/Version**: TypeScript ~5.8 (project compiler; emits ES2020+).

**Primary Dependencies**: **None new.** Reuses in-tree modules only —
`table-grid`, `visible-rows`, `copy-as-csv-registry`, `popup-chrome`,
`enrichment-registry`, `view-state-url`. Browser `navigator.clipboard.writeText`
is used when present (feature-detected) with a `<textarea>` + `document`
selection fallback. No `simple-statistics` / `shepherd.js` involvement.

**Storage**: URL fragment (`location.hash`) as the primary channel, mirrored to
`localStorage` under the existing `gs:${stem}:…` key scheme — identical pattern
to `src/utils/outlier-persistence.ts`. State persisted is a single **page-level**
record (chosen format + three booleans), not per-table.

**Testing**: Vitest unit tests for the pure serialisers (RFC 4180 / TSV / GFM
vectors), the export-model builder (visible rows, row-headers, virtual columns,
rowspan/colspan flattening, `data-gs-no-export`), and the persistence
round-trip + malformed-fallback. A Storybook interaction story and a Playwright
e2e spec (`tests/e2e/copy-as-csv.spec.ts`) drive the lozenge → popup → clipboard
path (reading back the clipboard, plus the textarea fallback) and the
toggle-off teardown.

**Target Platform**: Evergreen browsers ≤ 2 years (constitution §V). Must work
from `file://` (constitution §VI); insecure-context clipboard unavailability is
the textarea-fallback path, not an error. Runs in jsdom under Vitest (serialiser
+ builder + persistence tests are DOM-light; clipboard is mocked).

**Project Type**: Browser library, single project. IIFE bundle
(`dist/grid-sight.iife.js`) + npm/ESM via `src/index.ts`. This feature flips the
existing `copy-as-csv` registry entry from `shipped: false` to `shipped: true`
and adds a side-effect import for its descriptor; it is **not** added to the
frozen `window.gridSight.init` public surface.

**Performance Goals**: Per spec SC-002 — for ≤ 1 000 visible rows × 20 columns,
serialise + clipboard write in **< 200 ms**; toast within one animation frame of
success (SC-005). Building the export model is one linear pass over
`visibleBodyRows` × visible columns, reusing the addressing layer's per-row cell
resolution; no new hot path beyond the single on-demand pass at Copy time.

**Constraints**:

- **Bundle budget (constitution §I)**: The IIFE is already **~19 KB gzipped**
  against the §I 10 KB ceiling, under an explicitly-recorded interim **25 KB**
  enforcement cap (see `specs/012-capability-filtering/baseline-bundle-size.md`
  and `scripts/bundle-size.js`). This feature does **not** resolve that
  pre-existing violation; it MUST stay well under the 25 KB cap. Target a net
  delta of **≤ 1.5 KB gzipped** — achievable because most behaviour is reused
  (popup-chrome, table-grid, visible-rows) and the new code is three small pure
  serialisers + a thin popup + a small codec.
- **No network, offline-first (constitution §VI)**: pure string handling;
  clipboard is a local OS operation. No fetch on any path.
- **Byte-identical teardown**: the feature mutates the source DOM zero times
  (it only *reads*); its `tearDown` merely closes any open popup/toast and
  removes its lozenge via the standard rebuild, so the no-op teardown invariant
  holds trivially.

**Scale/Scope**: Up to ~10 tables per page, each up to ~1 000 visible rows × ~50
columns, with sort + per-column filters + N virtual columns potentially active.
Only one copy popup is open at a time (page-level singleton).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ⚠️ Conditional Pass | **No new runtime dependency.** Actual net IIFE delta **~3.1 KB gzipped** (serialisers + export-model builder + popup/toast + `gs.cp` codec), measured by `scripts/bundle-size.js`. The bundle already exceeds the §I 10 KB ceiling (now ~50 KB on main) under a long-standing, explicitly-recorded violation. **Project decision (2026-06-01): the bundle gate is now report-and-warn only** (no longer fails the build; `--strict` restores the hard gate) — growth is watched and trimmed deliberately rather than blocking each feature. The §I 10 KB target is unchanged and still warned on. Tracked in Complexity Tracking. |
| II. Test Discipline | ✅ Pass | New Vitest unit suites (serialisers with RFC 4180 / GFM vectors, export-model builder, persistence round-trip), a Storybook interaction story, and a Playwright e2e (clipboard read-back + textarea fallback + teardown). Full unit + e2e green before merge. |
| III. Accessibility by Default | ✅ Pass | Lozenge is a keyboard-operable `<button>`; popup is a single `role="dialog"` with labelled title, focus trap, Esc-to-close, and focus restored to the lozenge on close (via `installPopupChrome`). Toast is an `aria-live="polite"` `role="status"` region that does **not** steal focus. Colour is not the sole channel for any state. |
| IV. Progressive Enhancement | ✅ Pass | No valid table → no lozenge (descriptor `appliesTo` gate). Missing clipboard API / insecure context → textarea fallback, never a thrown error into the host page. Pure read layer; no DOM mutation of source content. |
| V. Cross-Browser Compatibility | ✅ Pass | `navigator.clipboard?.writeText` is feature-detected at the call site with the textarea + selection fallback; no newly-shipped API is required at load. Only `Array.from`, attribute reads, string methods, and DOM creation otherwise. |
| VI. Offline-First / Air-Gapped | ✅ Pass | Zero network. Serialisation is in-memory string handling; clipboard write is a local OS interaction. Behaviour identical from `file://`, mirror, or air-gap. |
| Development-Phase Posture | N/A (favourable) | Pre-production: the new module layout and the (internal-only) copy API may evolve freely. Not added to the frozen `window.gridSight.init` surface. |

**One conditional item (bundle).** It is a *pre-existing* recorded violation,
not introduced by this feature; documented in Complexity Tracking with the
mitigation (≤ 1.5 KB delta budget enforced by the existing 25 KB cap gate).

**Post-design re-check (2026-06-01)**: After producing `research.md`,
`data-model.md`, `contracts/copy-as-csv-api.md`, and `quickstart.md`, every gate
was re-evaluated against the concrete module shapes. No new dependency, no
network call, no addition to the public API surface; bundle delta estimate
holds. Verdict unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/009-copy-as-csv/
├── plan.md                      # This file (/speckit-plan output)
├── spec.md                      # Feature specification (input)
├── research.md                  # Phase 0 — serialisation, clipboard, flatten, persistence decisions
├── data-model.md                # Phase 1 — export model + persisted-config entities
├── quickstart.md                # Phase 1 — wire & verify the copy feature in < 5 min
├── contracts/
│   └── copy-as-csv-api.md        # Phase 1 — the internal module surfaces this feature adds
├── checklists/
│   └── requirements.md          # Spec validation (passing)
└── tasks.md                     # Phase 2 output — created by /speckit-tasks (not here)
```

### Source Code (repository root)

Reuses the existing single-project layout. New modules are small and grouped by
concern (pure logic in `enrichments/` + `utils/`, presentation in `ui/`),
mirroring how the outlier and find-in-table features are organised.

```text
src/
├── core/
│   ├── enrichment-registry.ts            # MODIFIED — flip 'copy-as-csv' to shipped:true; add tearDown: removeCopyUi
│   └── table-grid.ts                     # UNCHANGED — consumed for cellValue / column structure / flatten
├── enrichments/
│   ├── copy-as-csv.ts                    # NEW — orchestrator: build export model + run copy; removeCopyUi teardown
│   └── csv-serialize.ts                  # NEW — PURE serialisers: toCsv / toTsv / toMarkdown (no DOM)
├── ui/
│   ├── copy-csv-lozenge.ts               # NEW — registerEnrichment descriptor (table-level corner lozenge)
│   ├── copy-csv-popup.ts                 # NEW — the dialog (radios/checkboxes/Copy/Close) + clipboard + fallback
│   ├── copy-toast.ts                     # NEW — minimal aria-live="polite" status toast (auto-dismiss ≤ 5s)
│   ├── popup-chrome.ts                   # UNCHANGED — reused for focus-trap / outside-click / Esc / positioning
│   └── header-utils.ts                   # UNCHANGED — descriptor injection pass already drives table-level lozenges
├── utils/
│   ├── copy-persistence.ts               # NEW — gs.cp URL fragment + localStorage codec (page-level config)
│   ├── visible-rows.ts                   # UNCHANGED — visibleBodyRows() is the visible-view read-channel
│   └── copy-as-csv-registry.ts           # UNCHANGED — listVirtualColumnsForCopy() consumed for appended columns
└── index.ts                              # MODIFIED — add `import './ui/copy-csv-lozenge';` (side-effect register)

src/enrichments/__tests__/
├── csv-serialize.test.ts                 # NEW — RFC 4180 / TSV / GFM vectors + escaping edge cases
└── copy-as-csv.builder.test.ts           # NEW — export-model: visible rows, row-headers, virtual cols, flatten, no-export

src/utils/__tests__/
└── copy-persistence.test.ts              # NEW — encode/decode round-trip + malformed/unknown-format fallback

src/stories/
└── copy-as-csv.stories.ts                # NEW — interaction story (open popup, pick format, copy, fallback)

tests/e2e/
└── copy-as-csv.spec.ts                   # NEW — lozenge → popup → clipboard read-back + fallback + teardown

demo/
└── copy-as-csv/                          # NEW — demo page + nav entry (matches existing per-enrichment demos)
```

**Structure Decision**: Reuse the existing single-project layout. Pure,
DOM-free serialisation logic lives in `src/enrichments/csv-serialize.ts` so it
is trivially unit-testable in isolation; the orchestrator
(`src/enrichments/copy-as-csv.ts`) bridges the DOM-reading model builder to the
pure serialisers. Presentation (lozenge, popup, toast) lives in `src/ui/`
alongside the descriptor-registration siblings (`virtual-column-lozenges.ts`,
`find-in-table-box.ts`). Persistence lives in `src/utils/copy-persistence.ts`
next to `outlier-persistence.ts`, whose shape it copies. This keeps the
`enrichments → ui` / `ui → core` dependency directions consistent with the rest
of the codebase and avoids any new cycle.

## Complexity Tracking

> Filled because Constitution Check has one conditional (pre-existing) item.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Bundle exceeds §I 10 KB gzipped ceiling (inherited; main already ~50 KB) | The bundle was already ~50 KB before this feature (long-standing recorded override in `specs/012-capability-filtering/baseline-bundle-size.md` + the ceiling history in `scripts/bundle-size.js`). This feature adds ~3.1 KB of genuinely new logic (serialisers + builder + popup + persistence) and cannot land under a 10 KB gate the tree already violates by 5×. | Per the 2026-06-01 project decision the size gate is now **report-and-warn only**, so it neither blocks this feature nor hides the number — the gzipped size is printed every build and trimmed deliberately when it grows too large. A hard per-feature ceiling bump (the prior pattern) was rejected as friction; the formal §I 10 KB resolution remains a separate future effort. |
