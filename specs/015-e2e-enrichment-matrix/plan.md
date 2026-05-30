# Implementation Plan: End-to-End Enrichment Coverage Matrix

**Branch**: `claude/pending-tasks-NGcyT` | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-e2e-enrichment-matrix/spec.md`

## Summary

Close the issue #50 coverage gap with three test layers and the infrastructure to
keep them affordable and trustworthy:

1. **Per-demo matrix** (US1) — for every discovered demo, enable each offered
   enrichment via the real toggle panel and assert correct *active* behaviour or
   the correct *enabled-but-inapplicable* state, then assert byte-identical
   teardown. A curated fixture carries an **authored** column-type oracle
   (identifier `S-001`, annotated-numeric) that catches the #48 mis-typing class.
2. **Per-permutation sweep** (US2) — maximal pairwise combinations + a curated
   rich combo on the opt-in playground, asserting concrete cross-behaviour (filter
   recomputes a summary; sort leaves an aggregate stable) and joint byte-identical
   teardown.
3. **Self-extending harness** (US3) — demos discovered by globbing
   `public/demo/**/*.html`; offered set read at runtime from
   `window.gridSight.pageConfig.enrichments` (empty ⇒ full `enrichmentIds`).
4. **Fast, isolated, cross-browser execution** (US4) — migrate **all** ~38 e2e
   specs off per-file `beforeAll` previews onto **one global Playwright
   `webServer`**, run `fullyParallel` with >1 worker, add **Firefox + WebKit**
   projects, and add a **runtime hard gate** failing CI over the agreed wall-clock
   budget.

The applicability oracle is **two-tier** (review 2C + 5A): the weak layer derives
expected state from the running library at runtime; the strong layer (curated
fixture only) uses authored column kinds so the typing regression can actually
fail (SC-002). Teardown uses a **relative round-trip** snapshot, a
targeted-artifact check, and a normalized compare (review 6A/7A).

## Technical Context

**Language/Version**: TypeScript 5.x (Playwright `.spec.ts` + Vitest unit tests);
Node 18+ for filesystem globbing at collection time.
**Primary Dependencies**: `@playwright/test` 1.56 (existing), `vite` preview
(existing), Vitest (existing). **No new runtime or production dependency.** New
browser *binaries* (Firefox, WebKit) installed via `npx playwright install` — not
package deps.
**Storage**: `localStorage`/URL state used by some enrichments; the harness clears
and namespaces it per test for parallel isolation (FR-014).
**Testing**: Playwright e2e (`tests/e2e/`), with Vitest units for the harness's
pure helpers (review 9A). The library's own Vitest/Storybook suites are unchanged.
**Target Platform**: Chromium, Firefox, WebKit (evergreen) via Playwright, served
from one local `vite preview` `webServer` — offline, no network.
**Project Type**: Browser library — this feature is test infrastructure + demo
fixtures. `src/` is not modified **except** where a genuine cross-browser library
defect is surfaced by the new Firefox/WebKit runs (then a minimal fix or a filed
follow-up, per Principle V).
**Performance Goals**: Coverage-first (maximal pairwise, perf fixtures excluded);
wall-clock kept affordable by parallelism and enforced by the runtime gate
(SC-006/007/009).
**Constraints**: Offline (Principle VI); zero runtime-bundle delta (Principle I);
parallel-safe specs (FR-014); byte-identical teardown (FR-004/006); no `.skip` to
ship (Principle II).
**Scale/Scope**: ~13 demo dirs, 16 shipped enrichment ids, the opt-in playground,
one curated fixture; **~38 existing specs migrated** to the shared server; 3
browser projects.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Lightweight & Minimal Dependencies** | ✅ PASS — test-only; no `src/` change by default, zero bundle delta, no new package dependency (browser binaries are dev tooling, not deps). |
| **II. Test Discipline** | ✅ PASS — strengthens the net. The parallel migration touches ~38 specs; **all must stay green** (the migration's acceptance bar). No `.skip`; FR-009 fails loudly on undefined expectations; harness pure logic gets Vitest units (9A). |
| **III. Accessibility by Default** | ✅ PASS (light) — drives the real toggle panel via role/label/`value` selectors; asserts `aria-disabled` on inapplicable lozenges. No UI added. |
| **IV. Progressive Enhancement** | ✅ N/A — no library/distribution change. |
| **V. Cross-Browser Compatibility** | ✅ PASS — **strengthened**: the matrix now actively runs on Firefox + WebKit (FR-015), which is exactly this principle's intent. Real defects it surfaces are legitimate fixes/follow-ups. |
| **VI. Offline-First** | ✅ PASS — one local `vite preview` webServer; fixtures fetch nothing; an offline assertion guards each case. |
| **Performance/Distribution** | ✅ PASS — zero bundle delta. e2e wall-clock is now *governed* by the runtime gate (FR-016) rather than left implicit. |
| **Workflow** | ⚠ Deviation (justified): branch is harness-pinned `claude/pending-tasks-NGcyT`, not `<issue#>-<slug>`. Recorded in Complexity Tracking. |

**Gate result: PASS** (one justified workflow deviation). The parallel migration's
blast radius (~38 files) is a complexity item, tracked below, not a principle
violation.

## Project Structure

### Documentation (this feature)

```text
specs/015-e2e-enrichment-matrix/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (incl. all 14 review decisions)
├── data-model.md        # Phase 1 — test-domain entities
├── quickstart.md        # Phase 1 — run + extend the matrix
├── contracts/
│   ├── test-helpers.md      # helper API
│   ├── matrix-fixture.md    # curated fixture contract
│   └── e2e-runner.md        # webServer + projects + runtime gate contract
├── checklists/requirements.md
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
playwright.config.ts                 # MODIFIED — global webServer (one vite preview),
                                     #   fullyParallel:true, workers>1, projects:
                                     #   [chromium, firefox, webkit]; testDir tests/e2e

tests/e2e/
├── helpers/
│   ├── mock-vrs.ts                  # existing
│   ├── demo-discovery.ts           # NEW — glob+filter demos; readPageProfile (pure + page)
│   ├── toggle-panel.ts             # NEW — open panel, setEnrichment(id,on), raf,
│   │                               #   hasActiveLozenge/hasDisabledLozenge (headerType-aware, 3A)
│   ├── teardown.ts                 # NEW — relative round-trip snapshot + targeted-artifact
│   │                               #   + normalized compare (6A/7A)
│   ├── applicability.ts            # NEW — runtime-derived weak oracle (2C);
│   │                               #   pairwise generator (pure)
│   ├── isolation.ts                # NEW — per-test localStorage/URL namespacing (FR-014)
│   └── __tests__/                  # NEW — Vitest units for pure helpers (9A):
│       ├── pairwise.test.ts
│       ├── demo-discovery.test.ts
│       └── teardown-normalize.test.ts
├── enrichment-matrix.spec.ts        # NEW — US1: test per demo, test.step per enrichment (1A);
│                                    #   folds capability-filtering precedence asserts (4B/11A)
├── enrichment-permutations.spec.ts  # NEW — US2: pairwise + rich combo, interaction asserts (10A)
├── capability-filtering.spec.ts     # MODIFIED/REMOVED — cases migrated into matrix (4B)
├── capability-filtering-toggle.spec.ts # MODIFIED — onto shared server
└── (~36 other specs)                # MODIFIED — drop beforeAll preview, use baseURL

scripts/
└── e2e-runtime-gate.(js|ts)         # NEW — measure suite wall-clock, fail over budget (FR-016)

public/demo/matrix/
└── index.html                       # NEW — curated fixture (authored oracle, 5A)
```

**Structure Decision**: Single-project library layout. The big move is converting
the e2e suite from "every spec boots its own preview on a unique hardcoded port"
to "one shared `webServer` + `baseURL`, fully parallel." This unblocks parallelism
(otherwise the per-file servers race — the exact reason the suite is serial today)
and is the prerequisite for the matrix's multiplied case count to stay affordable.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Parallel migration touches ~38 existing spec files | FR-013 requires one shared webServer + `fullyParallel`; the current per-file `beforeAll` servers race under parallelism (the documented reason for `workers:1`) | "New specs only" parallelism was offered and rejected by the user — a mixed serial/parallel model leaves the suite slow and the per-file server pattern in place |
| One curated fixture carries authored column-type ground truth | The #48 defect was the library *mis-typing*; a derived oracle inherits the bug (SC-002 needs an independent oracle) | Deriving expected types from the code under test is circular — cannot catch a typing regression |
| Branch `claude/pending-tasks-NGcyT` not `50-…` per §Workflow | Harness pins all work to this branch | Constitution-named branch would violate the harness branch directive; spec dir `015-…` preserves traceability |
