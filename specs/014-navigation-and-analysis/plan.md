# Implementation Plan: Large-Table Navigation & Analysis (Tier 1)

**Branch**: `claude/admiring-keller-lVBLC` (feature dir `014-navigation-and-analysis`) | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-navigation-and-analysis/spec.md`

## Summary

Add three new, individually-toggleable enrichments — **`freeze-panes`** (sticky
header row + frozen key column), **`summary-row`** (per-column aggregate footer
over visible rows), **`find-in-table`** (search with match highlight + jump) —
and **extend the existing `statistics` enrichment in place** with missing %,
distinct count, Q1/Q3, a mini histogram, visible-rows awareness, and an
empty-state (no new id; same lozenge and label). Every piece plugs into the
established enrichment machinery: the static registry + `registerEnrichment`
behavior model, the `isEnrichmentEnabled` gate, the spec-012 toggle panel
(`tearDown`/`apply` round-trip), the `visible-rows` pipeline, the table-grid
addressing layer (`cellAt`/`cellValue`/`gridRows`/`columnCells`), the shared
`popup-chrome`, and the `gs:` per-page persistence scheme. No new runtime
dependency; all four reuse existing primitives. Demos are added per the
`docs/adding-an-enrichment.md` checklist (new page per new enrichment; the
statistics extension is exercised by updating a statistics-bearing demo table).

## Technical Context

**Language/Version**: TypeScript ~5.8 (project compiler; emits ES2020+).

**Primary Dependencies**: **None new.** Reuses `simple-statistics` (already a
dependency, used by statistics/heatmap) for quantiles in the statistics
extension. Pure DOM for the other three. No `shepherd.js` involvement.

**Storage**: Only `summary-row` persists state — the per-(table, column)
aggregate choice — via the existing `gs:` per-URL-stem scheme
(`storageKeyFor`/`urlStem` in `src/utils/slider-persistence.ts`) with a distinct
suffix. `freeze-panes` derives its on/off purely from the enabled set;
`find-in-table` and the statistics popup hold only transient in-memory state.

**Testing**: Vitest unit tests (computation + persistence codec + byte-identical
teardown), jsdom interaction tests (lozenge reveal, keyboard contract, popup
focus), Storybook stories with `play` interactions, and Playwright e2e for the
golden path of each piece **including the enable→disable→enable round-trip**
(the spec-006/012 lesson). Existing suites remain the regression guard.

**Target Platform**: Evergreen browsers ≤ 2 years (constitution §V). `position:
sticky` (freeze-panes), `Element.scrollIntoView` (find), and inline SVG
(histogram) are all > 2 years on every engine — no feature detection required.
Runs from `file://` and in jsdom under Vitest.

**Project Type**: Browser library, single project. IIFE bundle
(`dist/grid-sight.iife.js`) + npm/ESM. Adds enrichment modules under
`src/enrichments/` + `src/ui/`; no addition to the frozen `window.gridSight`
public surface.

**Performance Goals**: Per constitution §runtime budget — a 1 000-cell table
processes within 100 ms. Freeze is a one-time class-tagging pass (O(rows));
summary aggregates are O(visible cells) per column, recomputed on visible-rows
change at the same cadence as frequency/outlier; find is O(visible cells) per
query, debounced on input.

**Constraints**:

- **Read-only / byte-identical teardown** (constitution §IV; checklist §1/§3):
  every piece only adds classes, inline styles, injected nodes marked
  `data-gs-injected`, and ARIA — all removed on `tearDown` to byte-identical DOM.
  Highlighting and freezing add **no text-node surgery** (cell-level class, not
  `<mark>` substring wrapping) so teardown is trivially exact.
- **Toggle round-trip without reload** (checklist §3): `summary-row` and
  `freeze-panes` are auto-rendered, so each provides an `apply(table)` registry
  hook (symmetric to `tearDown`); `find-in-table` and `statistics` restore via
  lozenge rebuild.
- **No network, offline-first** (constitution §VI): pure DOM + in-bundle SVG.
- **Bundle budget** (constitution §I; see Constitution Check): combined gzipped
  IIFE delta budgeted **≤ 4 KB**, measured incrementally with
  `node scripts/bundle-size.js --soft`; must stay under the enforced 42 KB
  ceiling in `scripts/bundle-size.js`.

**Scale/Scope**: Up to ~10 tables/page, each up to ~1 000 rows × ~50 columns,
with any combination of existing enrichments active. All four must stay correct
and within budget at that composition (cross-enrichment invariant, spec 013).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ⚠ Pass with note | **No new runtime dep.** Bundle: the constitution's 10 KB target was historically superseded; the **enforced** ceiling in `scripts/bundle-size.js` is **42 KB gz** (history recorded there + in `specs/012-capability-filtering/baseline-bundle-size.md`). This feature budgets a combined **≤ 4 KB gz** delta and MUST stay under 42 KB. If it would breach 42 KB, raise the ceiling explicitly per the constitution and call it out in the PR. Measured per-piece with `--soft`. |
| II. Test Discipline | ✅ Pass | Unit + Storybook + Playwright for each piece, incl. teardown byte-identity and the disable→enable round-trip. Full suites green before merge (SC-008). |
| III. Accessibility by Default | ✅ Pass | All controls keyboard-operable (reuse `installPopupChrome` for the find box & statistics popup; lozenges are `<button>`); non-colour signals for frozen edge, current find match, summary emphasis (verified in monochrome). ARIA removed on teardown without clobbering author `aria-*` (FR-018). |
| IV. Progressive Enhancement | ✅ Pass | Pure enhancement of existing tables; degrades to no-op when inputs absent (no numeric cols → no numeric aggregate/stat; no scroll overflow → freeze no-op; no matches → "0 matches"). No throw into host page. |
| V. Cross-Browser Compatibility | ✅ Pass | `position: sticky`, `scrollIntoView`, inline SVG, `WeakMap` — all > 2 years on every engine. No guarded API. |
| VI. Offline-First / Air-Gapped | ✅ Pass | Zero network; SVG histogram drawn in-DOM; no fonts/icons fetched. |
| Development-Phase Posture | N/A (favourable) | Pre-production; module layout free to evolve. Nothing added to the frozen `window.gridSight.init` surface. |

**One note (Principle I), no violation.** The 10 KB figure in the constitution
text is superseded by the recorded 42 KB enforced ceiling; this plan does not
change the ceiling and budgets well under it. Complexity Tracking left empty.

**Post-design re-check (2026-05-28)**: After producing `research.md`,
`data-model.md`, `contracts/`, and `quickstart.md`, every gate was re-evaluated
against the concrete design. No new dependency, no network, no public-API
addition; the only persisted state is the summary aggregate choice on the
existing `gs:` scheme. Verdict unchanged: passing (with the bundle note).

## Project Structure

### Documentation (this feature)

```text
specs/014-navigation-and-analysis/
├── plan.md                       # This file
├── spec.md                       # Feature specification (input)
├── research.md                   # Phase 0 — design decisions for the 4 pieces
├── data-model.md                 # Phase 1 — entities + invariants
├── quickstart.md                 # Phase 1 — wire a new toggleable enrichment in <10 min
├── contracts/
│   ├── freeze-panes.md           # Phase 1 — module contract
│   ├── summary-row.md            # Phase 1 — module contract
│   ├── find-in-table.md          # Phase 1 — module contract
│   └── statistics-extension.md   # Phase 1 — extended StatisticsResult + popup contract
└── checklists/
    └── requirements.md           # Spec validation (existing)
```

### Source Code (repository root)

Reuses the existing single-project layout. New enrichment logic lives in
`src/enrichments/`; new UI in `src/ui/`; the statistics extension modifies two
existing files. Registry, index wiring, and persistence are touched per the
`docs/adding-an-enrichment.md` checklist.

```text
src/
├── core/
│   └── enrichment-registry.ts          # MODIFIED — add freeze-panes/summary-row/find-in-table entries (+ apply/tearDown); statistics entry unchanged
├── enrichments/
│   ├── freeze-panes.ts                  # NEW — tag header + key-column cells; apply/tearDown
│   ├── summary-row.ts                   # NEW — inject tfoot summary; per-col aggregate; visible-rows subscription; apply/tearDown
│   ├── find-in-table.ts                 # NEW — search model, match list, next/prev, highlight; tearDown
│   └── statistics.ts                    # MODIFIED — extend StatisticsResult + calculateStatistics (missing/distinct/Q1/Q3/histogram); empty-state safe
├── ui/
│   ├── freeze-panes-styles.ts           # NEW — minified injected sticky CSS
│   ├── summary-row-control.ts           # NEW — per-column aggregate chooser UI
│   ├── find-in-table-box.ts             # NEW — search box + counter + next/prev (uses popup-chrome)
│   ├── statistics-popup.ts              # MODIFIED — render new figures + inline SVG histogram; empty-state
│   ├── toggle-injector.ts               # MODIFIED — statistics trigger reads VISIBLE rows; register find-in-table table-level lozenge
│   └── header-utils.ts                  # UNCHANGED (uses existing buildLozenge/registerEnrichment paths)
├── index.ts                             # MODIFIED — applyFreezePanes/applySummaryRow per processed table, gated on isEnrichmentEnabled
└── utils/
    └── slider-persistence.ts            # UNCHANGED — reuse storageKeyFor/urlStem for summary-row choice

src/enrichments/__tests__/
├── freeze-panes.test.ts                 # NEW
├── summary-row.test.ts                  # NEW
├── find-in-table.test.ts                # NEW
└── statistics.test.ts                   # MODIFIED/EXTENDED

src/stories/
├── freeze-panes.stories.ts              # NEW
├── summary-row.stories.ts               # NEW
└── find-in-table.stories.ts             # NEW

public/
├── index.html                           # MODIFIED — demo cards for the 3 new pages
└── demo/
    ├── freeze-panes/index.html          # NEW — tall/wide scientific table
    ├── summary-row/index.html           # NEW — filterable measurement table
    ├── find-in-table/index.html         # NEW — dense lookup table
    └── statistics/index.html            # NEW or MODIFIED — table with blanks + skewed dist

e2e/ (Playwright)
└── navigation-and-analysis.spec.ts      # NEW — golden path + round-trip per piece
```

**Structure Decision**: Reuse the existing single-project layout. Each new
enrichment is one logic module (`src/enrichments/`) + one UI module
(`src/ui/`), mirroring how sort/filter/sparkline are split. The statistics
extension stays inside the two files that already own it (`statistics.ts`,
`statistics-popup.ts`) plus its trigger in `toggle-injector.ts` — no new id, no
new module, honouring the "no parallel id lists" rule (checklist §4).

## Complexity Tracking

> No violations. Section intentionally empty.
