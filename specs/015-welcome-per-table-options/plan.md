# Implementation Plan: Welcome Page Redesign & Per-Table Options

**Branch**: `claude/welcome-page-redesign-rVjHn` (feature dir `015-welcome-per-table-options`) | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-welcome-per-table-options/spec.md`

## Summary

Two bundled deliverables, one motivating the other:

1. **Per-table options** — a new platform capability that lets a host page give
   different tables on the same page different configurations, addressing each
   table by **`id` or CSS selector**. Two things are scoped per table: the
   **enrichment set** offered, and the **GS-toggle start-state** (whether the
   table's "GS" corner toggle begins *active* — enrichments revealed — or
   *inactive*, the default). The existing page-level config and the global
   on/off behaviour are preserved; per-table is an additive tier with precedence
   **visitor > per-table > page > library defaults**.

2. **Welcome page redesign** — rebuild `public/index.html` from a sliders-demo
   index into a broad, warm-but-technical introduction for first-time visitors:
   a hero + principles intro, then four feature sections laid out as alternating
   narrative/live-table rows (stacking on mobile), each demo table driven by the
   per-table API to show only its feature and (mostly) start with enrichments
   already revealed. The global enable/disable toggle stays, explained in the
   narrative; the page also demonstrates the start-state option by showing a
   table that starts inactive next to one that starts active. Links to all 12
   existing demo pages are retained.

The core engineering move is making the gate **table-aware**: today
`isEnrichmentEnabled(id)` and `getEffectiveEnabledSet()` resolve a single
page-global set (`src/core/enabled-set-state.ts`). This plan adds an optional
table argument so the injection pass (`header-utils.addLozengesToHeader`, which
already holds the table) and the auto-render gates in `index.ts` resolve the set
*for that table*. With no per-table entry, resolution is byte-for-byte the
current global behaviour (no regression). The GS-toggle start-state reuses the
existing toggle activate/deactivate logic — extracted from the inline click
handler in `toggle-injector.ts` into named functions — invoked once after
`injectToggle` when a table's resolved start-state is active.

## Technical Context

**Language/Version**: TypeScript ~5.8 (project compiler; emits ES2020+).

**Primary Dependencies**: **None new.** Pure DOM + existing core modules. CSS
selector matching uses the native `Element.matches` / `document.querySelectorAll`
(both > 2 years on every engine). No `shepherd.js`, no `simple-statistics`
involvement in this feature.

**Storage**: **None new.** Per-table options are author-declared config read at
`init()` from `window.gridSight.pageConfig` (or `init(options)`); the start-state
is a load-time initial position only — the visitor's subsequent GS-toggle clicks
are transient in-DOM state exactly as today. No new `gs:` persistence key, no new
URL fragment.

**Testing**: Vitest unit tests (per-table resolver precedence, selector
matching, config parsing/normalisation, start-state default), jsdom interaction
tests (table-aware lozenge injection; programmatic toggle activation;
byte-identical teardown), Storybook stories for the per-table demo composition,
and Playwright e2e for the welcome page (two tables exposing different
enrichments simultaneously; one start-active vs one start-inactive; global
toggle round-trip; all demo links reachable; `file://` load). Existing suites
remain the regression guard (SC-009).

**Target Platform**: Evergreen browsers ≤ 2 years (constitution §V).
`Element.matches`, `querySelectorAll`, `WeakMap`, CSS grid (alternating
two-column layout, `@media` stacking) are all > 2 years on every engine — no
feature detection required. Runs from `file://` and in jsdom under Vitest.

**Project Type**: Browser library, single project. IIFE bundle
(`dist/grid-sight.iife.js`) + npm/ESM. Adds per-table resolution to `src/core/`,
threads a table argument through `src/ui/` injection, and refactors the toggle
activate path in `src/ui/toggle-injector.ts`. The welcome page is a
`public/index.html` rewrite (no new runtime surface). No addition to the frozen
`window.gridSight.init` signature — `pageConfig.tables` is read from the existing
config object.

**Performance Goals**: Per constitution §runtime budget — a 1,000-cell table
processes within 100 ms. Per-table resolution is O(entries × tables) selector
matching done once at `init()` and cached per table in a `WeakMap`; the injection
pass reads the cached set (O(1) per header). Start-state activation runs the same
one-time work a manual GS click does. No added per-frame cost.

**Constraints**:

- **Read-only / byte-identical teardown** (constitution §IV): the per-table path
  only changes *which* enrichments are offered and *whether the toggle starts
  active* — it adds no new injected nodes beyond what an enrichment already adds,
  all marked `data-gs-injected` and removed on teardown. A start-active table
  torn down (global off, or toggle clicked off) MUST restore byte-identical
  original markup (FR-024).
- **No regression for non-adopters** (FR-018, SC-009): a table matched by no
  per-table entry resolves to the identical global set it does today; the table
  argument is optional and defaults to current behaviour.
- **`data-gs-ignore` still absolute** (FR-019): opted-out tables are skipped
  before any per-table matching.
- **No network, offline-first** (constitution §VI): the welcome page and every
  inline demo run from `file://` with the IIFE bundle; no fetched fonts/icons.
- **Bundle budget** (constitution §I; see Constitution Check): the enforced
  ceiling in `scripts/bundle-size.js` is **42 KB gz** (history in
  `specs/012-capability-filtering/baseline-bundle-size.md`). This feature budgets
  a small delta (selector matching + threading a param + extracted toggle
  functions) **≤ 1.5 KB gz** and MUST stay under 42 KB; the welcome page HTML
  itself is not bundled. Measured with `node scripts/bundle-size.js --soft`.

**Scale/Scope**: Up to ~10 tables/page (the welcome page has several inline
demos), each up to ~1,000 rows × ~50 columns, with any combination of existing
enrichments active and any number of per-table entries. Resolution and injection
must stay correct and within budget at that composition.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ⚠ Pass with note | **No new runtime dep.** Bundle: the constitution's 10 KB text is historically superseded by the **enforced 42 KB gz** ceiling in `scripts/bundle-size.js` (recorded in `specs/012-capability-filtering/baseline-bundle-size.md` and spec 014's plan). This feature budgets **≤ 1.5 KB gz** and MUST stay under 42 KB. If it would breach, raise the ceiling explicitly per the constitution and call it out in the PR. Measured with `--soft`. |
| II. Test Discipline | ✅ Pass | Unit (resolver/selector/parse/default) + jsdom (table-aware injection, programmatic activation, teardown identity) + Storybook + Playwright (welcome-page golden path incl. simultaneous distinct enrichment sets and the start-state contrast). Full suites green before merge (SC-009). |
| III. Accessibility by Default | ✅ Pass | The GS toggle remains a keyboard-operable `<button>` with correct `aria-expanded`; programmatic start-active sets `aria-expanded="true"` to match. Welcome-page sections use semantic headings/landmarks; the alternating layout uses CSS order only (DOM order stays logical for SR/keyboard); no colour-only signals. No ARIA regressions on teardown. |
| IV. Progressive Enhancement | ✅ Pass | Pure enhancement: unmatched tables behave exactly as today; an empty per-table enrichment list yields a valid no-enrichment table; malformed `pageConfig.tables` is warned-and-ignored (degrades, never throws into the host page). Welcome page works as a plain `<script>` include. |
| V. Cross-Browser Compatibility | ✅ Pass | `Element.matches`, `querySelectorAll`, `WeakMap`, CSS grid + `@media` — all > 2 years on every engine. No guarded API. |
| VI. Offline-First / Air-Gapped | ✅ Pass | Zero network. Welcome page + IIFE + inline demos load from `file://`; no fetched fonts/icons/telemetry. |
| Development-Phase Posture | N/A (favourable) | Pre-production; config shape and module layout free to evolve. `pageConfig` gains a `tables` field but `window.gridSight.init`'s signature is unchanged. |

**One note (Principle I), no violation.** The 10 KB figure is superseded by the
recorded 42 KB enforced ceiling; this plan budgets well under it and does not
change the ceiling. Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/015-welcome-per-table-options/
├── plan.md                       # This file
├── spec.md                       # Feature specification (input)
├── research.md                   # Phase 0 — design decisions
├── data-model.md                 # Phase 1 — entities + invariants
├── quickstart.md                 # Phase 1 — wire per-table options in <10 min
├── contracts/
│   ├── per-table-options.md      # Phase 1 — config schema + resolution contract
│   └── welcome-page.md           # Phase 1 — welcome-page structure/content contract
└── checklists/
    └── requirements.md           # Spec validation (existing)
```

### Source Code (repository root)

Reuses the existing single-project layout. The capability lands in `src/core/`
(resolution) + `src/ui/` (threading the table through injection; extracting the
toggle activate path); `src/index.ts` threads the table into the auto-render
gates and triggers start-state. The welcome page is a `public/index.html`
rewrite.

```text
src/
├── core/
│   ├── page-config.ts                 # MODIFIED — parse + normalise pageConfig.tables (selector, enrichments?, startActive?); validation policy in one place
│   ├── effective-enabled-set.ts       # MODIFIED — add a per-table tier to resolveEnabledSet (visitor > per-table > page > defaults)
│   ├── enabled-set-state.ts           # MODIFIED — table-aware getEffectiveEnabledSet(table?)/isEnrichmentEnabled(id, table?); per-table cache (WeakMap); store parsed table entries
│   └── per-table-options.ts           # NEW — selector→table matching + resolved-config lookup/cache (matchTableEntries, resolveTableConfig)
├── ui/
│   ├── header-utils.ts                # MODIFIED — addLozengesToHeader passes its `table` to getEffectiveEnabledSet(table)
│   ├── toggle-injector.ts             # MODIFIED — extract activateToggle(table)/deactivateToggle(table) from the inline click handler; export for start-state + reuse
│   └── toggle-panel.ts                # REVIEW — runtime panel reads the page-global set; confirm it composes with per-table (panel edits page tier only)
├── index.ts                           # MODIFIED — thread the table into isEnrichmentEnabled gates (outlier/freeze/summary) and getEffectiveEnabledSet; after injectToggle, activateToggle when resolved start-state is active
└── enrichments/                       # REVIEW — slider.ts/slider-threshold.ts/annotations.ts call isEnrichmentEnabled(id) without a table; confirm correct under per-table (pass table where the call is table-scoped)

src/core/__tests__/
├── per-table-options.test.ts          # NEW — selector matching (id + CSS), last-match-wins, data-gs-ignore precedence, no-match fallback
├── effective-enabled-set.test.ts      # MODIFIED/EXTENDED — per-table tier precedence + unknown-id drop at the per-table tier
└── page-config.test.ts                # MODIFIED/EXTENDED — pageConfig.tables parsing/normalisation + malformed-input policy

src/ui/__tests__/
├── header-utils.per-table.test.ts     # NEW — table-aware lozenge injection (two tables, different sets)
└── toggle-injector.start-state.test.ts# NEW — programmatic activate/deactivate; aria-expanded; byte-identical teardown

src/stories/
└── per-table-options.stories.ts       # NEW — two tables, distinct enrichment sets + start-active vs start-inactive

public/
├── index.html                         # REWRITTEN — hero + principles, 4 alternating feature sections with live demos, explained global toggle, start-state contrast, all-demos index
└── demo/                              # UNCHANGED — existing demo pages remain; welcome page links to them

e2e/ (Playwright)
└── welcome-per-table.spec.ts          # NEW — distinct enrichment sets co-resident; start-active vs start-inactive; global toggle round-trip; all demo links reachable; offline/file:// smoke
```

**Structure Decision**: Reuse the existing single-project layout. Per-table
resolution is a thin new core module plus a per-table tier added to the existing
`resolveEnabledSet`, keeping "one place for resolution" intact. The table
argument is threaded (not duplicated) through the single injection pass. The
toggle activate/deactivate logic is **extracted, not reimplemented**, so the
start-state path and a manual click share one code path (DRY; guarantees
identical teardown). The welcome page is content/HTML/CSS plus a small inline
config script — no new bundled runtime surface.

## Complexity Tracking

> No violations. Section intentionally empty.
