# Implementation Plan: Row Visibility & Order (Sort + Filter)

**Branch**: `claude/row-visibility-spec-UxTM5` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-003-row-visibility/spec.md`
**Source specs (superseded for planning only)**: [`specs/002-sort/spec.md`](../002-sort/spec.md), [`specs/003-filter/spec.md`](../003-filter/spec.md)

## Summary

Land a single **Visible Row Sequence** pipeline that owns the table's row
projection — what order rows appear in (sort) and which ones are dimmed
(filter) — and expose it as the only sanctioned read-channel for every
downstream enrichment (`005-sparkline`, `008-cumulative-column`,
`009-copy-as-csv`, `010-diff-compare`). The pipeline is filter-then-sort
with dimming (not removal), one composed URL-fragment directive per table
under a per-page namespace that mirrors `src/utils/slider-persistence.ts`,
a one-shot Original Order Record captured at first activation of either
lozenge, and a synchronous change event so consumers re-render within one
animation frame. Sort and filter ship as separate priorities against this
shared scaffold: the pipeline lands first as an identity projection with
the public API frozen; sort, filter (numeric), filter (categorical), the
clear-all chip, sort-over-filter semantics, and URL persistence layer in
on top in user-story order.

## Technical Context

**Language/Version**: TypeScript ~5.8 (project compiler; emits ES2020+).
**Primary Dependencies**:

- Runtime: **none new**. Comparison uses `Array.prototype.sort` +
  `Intl.Collator`; filtering uses `Number`, `String.prototype.trim`, and
  `Intl.Collator` where needed. Existing `simple-statistics` and
  `shepherd.js` are unrelated and remain untouched.
- Build/test: existing Vite 6, Vitest 3, Playwright 1.53, Storybook 9.

**Storage**: URL fragment only (no `localStorage`). One namespace per page,
one directive object per table, sort and filter under a single object —
no separate keys. Mirrors the per-URL-stem scheme of
`src/utils/slider-persistence.ts` (origin + pathname stem) but does not
share its `gs.s` key.

**Testing**: Vitest unit tests (per-folder `__tests__/`) for the pipeline,
comparator, filter predicates, URL codec, and Original Order Record;
Storybook 9 interaction tests (`@storybook/addon-vitest`) for lozenge
popups, chip, keyboard contract; Playwright e2e for the four golden
flows (sort-only, filter-only, sort-over-filter, URL round-trip on a
fresh browser).

**Target Platform**: Evergreen browsers released within the last two years
(constitution §V). Must work from `file://` (constitution §VI).

**Project Type**: Browser library, single project. IIFE bundle
(`dist/grid-sight.iife.js`) + npm/ESM via `src/index.ts`.

**Performance Goals**:

- 1 000-row table: sort, filter, or combined re-evaluation completes in
  **< 100 ms** on a mid-range laptop (SC-002 = constitution §runtime
  budget).
- URL restore visible **within one animation frame** of first paint
  (SC-003).
- Pipeline `onChange` emits **synchronously** so downstream
  re-renders settle in the same frame (FR-VP-003).

**Constraints**:

- Bundle delta for this feature must keep the IIFE ≤ 10 KB gzipped
  (constitution §I). Target: ≤ 2.0 KB gzipped net delta for the
  combined sort + filter + pipeline + URL codec.
- No runtime network access. No new runtime deps (constitution §VI, §I).
- **Byte-identical DOM on toggle-off** (SC-005): no leftover classes,
  attributes, or injected nodes from the projection. The Original Order
  Record is the means by which we guarantee this.
- Keyboard + AT operability mandatory (constitution §III). Filter
  popups need a focus trap; sort lozenge announces next action.

**Scale/Scope**: Up to ~10 tables per page, each up to ~1 000 rows × ~50
columns. One sort directive per table; up to one filter predicate per
column.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ✅ Pass | No new runtime deps; net IIFE delta budgeted ≤ 2 KB gzipped. Bundle measured each PR by `scripts/bundle-size.js`. |
| II. Test Discipline | ✅ Pass | Pipeline + comparator + URL codec covered by Vitest unit suite; lozenge / popup / chip covered by Storybook interaction tests; four golden flows covered by Playwright. SC-006 adds an automated parity check between pipeline output and rendered DOM. |
| III. Accessibility by Default | ✅ Pass | Sort lozenge sets `aria-sort` and announces the next action; filter lozenge uses `aria-pressed`; popups trap focus; chip is keyboard-reachable; dimmed rows remain announced (no `aria-hidden`). Carried verbatim from the source specs and unchanged here. |
| IV. Progressive Enhancement | ✅ Pass | Pipeline starts as an identity projection; no DOM mutation until a user activates a lozenge. Toggling Grid-Sight off restores byte-identical DOM (SC-005). |
| V. Cross-Browser Compatibility | ✅ Pass | Only `Array.prototype.sort` (stable since ES2019), `Intl.Collator`, `URLSearchParams`, `requestAnimationFrame`, and standard DOM APIs. All > 2 years across every evergreen engine. No feature-detection needed. |
| VI. Offline-First / Air-Gapped | ✅ Pass | URL fragment only; no `localStorage` reliance (explicit non-goal in SC-004); zero network calls anywhere on the runtime path. |
| Development-Phase Posture | N/A | Pre-production; the spec's URL-fragment shape and the `utils/visible-rows.ts` API are explicitly allowed to evolve before the production cut. |

**No constitution violations.** Complexity Tracking section is intentionally empty.

**Post-design re-check (2026-05-19)**: After producing `research.md`,
`data-model.md`, `contracts/visible-rows-api.md`,
`contracts/url-fragment-schema.md`, and `quickstart.md`, every gate was
re-evaluated against the concrete shapes proposed. No new dependency, no
network call, no fall-back to `localStorage`, no API outside the published
contract; bundle estimate (research R-7) stays inside the 2 KB net budget.
Verdict unchanged: passing on every principle.

## Project Structure

### Documentation (this feature)

```text
specs/002-003-row-visibility/
├── plan.md                       # This file (/speckit-plan output)
├── spec.md                       # Feature specification (input)
├── research.md                   # Phase 0 — pipeline / URL / sort / filter decisions
├── data-model.md                 # Phase 1 — Visible Row Sequence, directives, Original Order Record
├── quickstart.md                 # Phase 1 — wire a downstream enrichment to the pipeline in < 5 min
├── contracts/
│   ├── visible-rows-api.md       # Phase 1 — utils/visible-rows.ts surface
│   └── url-fragment-schema.md    # Phase 1 — combined sort+filter directive shape
├── checklists/
│   └── requirements.md           # Spec validation (already passing 12/15; 3 accepted exceptions)
└── tasks.md                      # Phase 2 output — created by /speckit-tasks (not here)
```

### Source Code (repository root)

Existing single-project layout is reused; this feature adds files under
the existing top-level groupings rather than introducing new top-level
directories.

```text
src/
├── core/                                       # existing — unchanged
├── enrichments/
│   ├── sort.ts                                 # NEW — sort directive, comparator, lozenge wiring
│   ├── filter.ts                               # NEW — filter predicates (numeric range, categorical), popup orchestration
│   ├── filter-chip.ts                          # NEW — clear-all chip + per-filter summary
│   └── ...                                     # existing enrichments unchanged
├── ui/
│   ├── sort-lozenge.ts                         # NEW — ↕ lozenge button + aria-sort handling
│   ├── filter-lozenge.ts                       # NEW — ▽ lozenge button + popup trigger
│   ├── filter-popup-numeric.ts                 # NEW — Min/Max inputs, "Hide empty cells" toggle
│   ├── filter-popup-categorical.ts             # NEW — count-labelled checkboxes, search, select-all/none
│   ├── header-utils.ts                         # MODIFIED — register sort + filter in the lozenge cluster
│   └── ...                                     # existing UI unchanged
├── utils/
│   ├── visible-rows.ts                         # NEW — Visible Row Sequence pipeline (the public hub)
│   ├── original-order.ts                       # NEW — one-shot snapshot per table
│   ├── view-state-url.ts                       # NEW — combined sort+filter URL codec (separate from slider-persistence)
│   └── ...                                     # existing utils unchanged
└── index.ts                                    # MODIFIED — re-export visible-rows public surface; no breaking change to existing exports

src/enrichments/__tests__/
├── sort.test.ts                                # NEW
├── filter.test.ts                              # NEW
└── filter-chip.test.ts                         # NEW

src/ui/__tests__/
├── sort-lozenge.test.ts                        # NEW
├── filter-popup-numeric.test.ts                # NEW
└── filter-popup-categorical.test.ts            # NEW

src/utils/__tests__/
├── visible-rows.test.ts                        # NEW — pipeline composition + change event
├── original-order.test.ts                      # NEW — snapshot capture timing
└── view-state-url.test.ts                      # NEW — codec round-trip + missing-target drop

tests/e2e/
├── sort.spec.ts                                # NEW — Playwright: three-state sort
├── filter.spec.ts                              # NEW — Playwright: numeric + categorical filters
├── sort-over-filter.spec.ts                    # NEW — Playwright: US5 golden path
└── view-state-url.spec.ts                      # NEW — Playwright: shareable URL round-trip on a clean profile
```

**Structure Decision**: Reuse the existing single-project layout. The
**only architectural addition** is `src/utils/visible-rows.ts` as the
shared hub. Sort and filter both live in `src/enrichments/` and are
the only modules that mutate pipeline state; every downstream feature
reads from `visible-rows.ts` and never touches `tbody` directly. This
mirrors how `src/enrichments/slider.ts` and
`src/ui/slider-control.ts` are layered for spec 001.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Section intentionally empty.
