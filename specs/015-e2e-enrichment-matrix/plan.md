# Implementation Plan: End-to-End Enrichment Coverage Matrix

**Branch**: `claude/pending-tasks-NGcyT` | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-e2e-enrichment-matrix/spec.md`

## Summary

Close the e2e coverage gap from issue #50 by adding two **test-only** layers plus
a self-extending harness, with **no change to shipped library behaviour**:

1. A **per-demo matrix** that, for every demo page, enables each enrichment the
   page offers (via the real toggle panel) and asserts either correct *active*
   behaviour or the correct *enabled-but-inapplicable* state, then asserts
   byte-identical teardown.
2. A **per-permutation interaction sweep** on the opt-in playground that enables
   representative (pairwise) combinations and asserts each member still behaves
   under the others, with byte-identical joint teardown.
3. A **data-driven harness**: the demo set is discovered by globbing
   `public/demo/**/*.html`, and each demo's offered enrichment set is read at
   runtime from `window.gridSight.pageConfig.enrichments` (or, when empty, the
   full `window.gridSight.enrichmentIds`). Adding a demo or offering a new
   enrichment extends coverage with no test-file edits.

The defect oracle that catches the #48 class (identifier columns like `S-001`
mis-typed as numeric; annotated numeric cells losing sort/filter affordances)
lives on a **curated matrix fixture** with authored column-type ground truth, so
the test asserts independently of the library's own typing.

## Technical Context

**Language/Version**: TypeScript 5.x (Playwright `.spec.ts`), Node 18+ for
test-collection-time filesystem globbing.
**Primary Dependencies**: `@playwright/test` (existing), `vite` preview server
(existing). **No new runtime or dev dependency.**
**Storage**: `localStorage` is used by some enrichments (summary-row choices,
slider state, annotations); the harness clears it between cases for determinism.
N/A otherwise.
**Testing**: Playwright e2e under `tests/e2e/` (the new specs); the project's
Vitest suite is unaffected.
**Target Platform**: Evergreen Chromium via Playwright (the only configured
project), served from a local `vite preview` — offline, no network.
**Project Type**: Browser library — this feature adds test infrastructure and
demo fixtures only; `src/` is not modified.
**Performance Goals**: The full e2e suite stays within its current runtime
budget. New specs use **one** shared preview server and **pairwise** (not
power-set) combinations (SC-006).
**Constraints**: Offline / air-gapped (Principle VI); zero runtime-bundle delta
(Principle I); byte-identical teardown invariant (FR-004/FR-006); no `.skip` to
ship (Principle II) — undefined expectations fail loudly (FR-009).
**Scale/Scope**: ~13 demo directories, 16 shipped enrichment ids, the opt-in
playground, and one curated matrix fixture; pairwise combinations over the
playground's offered set.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Lightweight & Minimal Dependencies** | ✅ PASS — test-only. No `src/` change, no runtime/dev dependency, zero bundle delta. The harness reads existing runtime surfaces (`pageConfig`, `enrichmentIds`, `isEnrichmentEnabled`) and DOM lozenges; it does **not** require new test hooks on `window.gridSight`. |
| **II. Test Discipline** | ✅ PASS — this feature *is* tests; it strengthens the merge-time net. No `.skip`; FR-009 surfaces missing expectations as explicit failures, not silent passes. Must be green at merge. |
| **III. Accessibility by Default** | ✅ PASS (light) — harness drives controls via the real toggle panel and prefers role/label/`value`-based selectors; an a11y reachability assertion on toggles is in scope, but no UI is added. |
| **IV. Progressive Enhancement** | ✅ N/A — no library/distribution change. |
| **V. Cross-Browser** | ✅ PASS — runs on the existing Chromium project; no new browser-specific API used. |
| **VI. Offline-First** | ✅ PASS — runs against local `vite preview`; fixtures embed all data and fetch nothing. A guard asserts no network requests leave the page during a case. |
| **Performance/Distribution** | ✅ PASS — zero bundle delta; e2e runtime bounded by single shared server + pairwise combos (SC-006). |
| **Workflow** | ⚠ Deviation (justified): constitution prefers `<issue#>-<slug>` branches, but the harness pins this work to `claude/pending-tasks-NGcyT`. Spec directory `015-e2e-enrichment-matrix` retains traceability. Recorded in Complexity Tracking. |

**Gate result: PASS** (one justified workflow deviation; no principle violation).

## Project Structure

### Documentation (this feature)

```text
specs/015-e2e-enrichment-matrix/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 — decisions & rationale
├── data-model.md        # Phase 1 — test-domain entities
├── quickstart.md        # Phase 1 — run + extend the matrix
├── contracts/           # Phase 1 — helper API + fixture contract
│   ├── test-helpers.md
│   └── matrix-fixture.md
├── checklists/
│   └── requirements.md  # (from /speckit-specify)
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (repository root)

This feature touches **tests and demo fixtures only** — no `src/` changes.

```text
tests/e2e/
├── helpers/
│   ├── mock-vrs.ts                  # existing
│   ├── preview-server.ts            # NEW — shared vite preview lifecycle (one port)
│   ├── toggle-panel.ts              # NEW — open panel, set enrichment on/off by id, raf
│   ├── demo-discovery.ts            # NEW — glob public/demo/**/*.html; read offered set
│   ├── teardown-snapshot.ts         # NEW — capture/compare byte-identical table outerHTML
│   └── applicability.ts             # NEW — expected active/inapplicable oracle + lozenge reads
├── enrichment-matrix.spec.ts        # NEW — US1: per-demo × per-offered-enrichment
├── enrichment-permutations.spec.ts  # NEW — US2: pairwise combos on opt-in playground
└── (existing specs unchanged)

public/demo/
├── matrix/
│   └── index.html                   # NEW — curated fixture: numeric + categorical +
│                                    #        identifier (S-001) + annotated-numeric columns,
│                                    #        offering the full enrichment set
└── (existing demos unchanged; fixtures enriched only where data is too thin — FR-012)
```

**Structure Decision**: Single-project library layout. All new code is under
`tests/e2e/` (helpers + two specs) and `public/demo/matrix/` (one curated
fixture). The harness derives the demo list from the filesystem and the offered
set from each page's runtime `pageConfig`, so the matrix self-extends (FR-007/008).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Branch is `claude/pending-tasks-NGcyT`, not `50-e2e-enrichment-matrix` per constitution §Workflow | The remote-execution harness pins all work to this designated branch; deviating would push to an unauthorized branch | A constitution-named branch would violate the harness branch directive; spec dir `015-…` preserves issue/traceability instead |
| One curated fixture carries authored column-type ground truth (not fully derived) | The #48 defect was the library *mis-typing* a column; a derived oracle would inherit the same bug and never fail | Deriving expected types from the library under test is circular — it cannot catch a typing regression, defeating SC-002 |
