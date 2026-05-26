# Implementation Plan: Canonical Table-Grid Addressing Layer

**Branch**: `claude/funny-cannon-ojWpI` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-table-grid-addressing/spec.md`

## Summary

Introduce one stateless module — `src/core/table-grid.ts` — that is the sole
authority for translating between a **logical** (row, column) coordinate and a
**physical** live-DOM cell, and back. It derives everything from the live DOM
plus the existing structural markers at call time (no cached snapshots, no new
markers), so it is correct regardless of which enrichments are active or the
order in which they were activated. Scaffolding cells (`data-gs-injected`) are
never part of the grid; virtual columns (`data-gs-virtual-column`) are real,
addressable columns ordered after the source columns. The module also owns the
canonical "data text of a cell" reader (stripping injected UI) and the
logical-row-identity lookup (delegating to the Original Order Record). All
existing physical-index consumers — sort, filter, frequency, heatmap row
lookup, the lozenge index/refresh helpers, the toggle-injector statistics/
frequency sites, sparkline/compare/cumulative/threshold value extraction, and
column-type detection — migrate onto it, and the two copy-pasted
`nonInjected*` helpers collapse into it. Correctness is locked in by a
composition test matrix run in both activation orders.

## Technical Context

**Language/Version**: TypeScript ~5.8 (project compiler; emits ES2020+).

**Primary Dependencies**: **None new.** Pure DOM traversal (`HTMLTableElement`,
`HTMLTableRowElement`, `HTMLTableCellElement`, `Array.from`, attribute reads).
Reuses the existing `original-order.ts` record. No `simple-statistics` or
`shepherd.js` involvement.

**Storage**: None. The layer is stateless — it holds no per-table state of its
own. The only state it *reads* is the Original Order Record already owned by
`src/utils/original-order.ts` (a `WeakMap<HTMLTableElement, …>`).

**Testing**: Vitest unit tests (`src/core/__tests__/table-grid.test.ts`) for
the addressing primitives and edge cases; a dedicated **composition matrix**
suite asserting the cross-enrichment invariant in both activation orders;
existing Storybook interaction tests and Playwright e2e remain the integration
guard. The regression test added with the original bug fix
(`src/ui/__tests__/header-utils.slider-placement.test.ts`) stays.

**Target Platform**: Evergreen browsers ≤ 2 years (constitution §V). Must work
from `file://` (constitution §VI). Runs in jsdom under Vitest.

**Project Type**: Browser library, single project. IIFE bundle
(`dist/grid-sight.iife.js`) + npm/ESM via `src/index.ts`. This feature adds an
internal `src/core/` module; it is **not** added to the public API surface.

**Performance Goals**: Per constitution §runtime budget — a 1 000-cell table
must process within 100 ms. Addressing queries are O(cells-in-row) /
O(rows-in-table) filters over the live DOM; called at the same cadence as the
physical-index code they replace, so no new hot path is introduced. Where a
consumer iterates every column over every row (e.g. table-wide stats), it
resolves the logical row/cell lists once per pass rather than per cell.

**Constraints**:

- **Zero new DOM / markers** (FR-011): the layer only *reads* attributes, so
  byte-identical teardown (SC-004 / prior SC-005) is unaffected.
- **Identity when un-enriched** (FR-012): with no `data-gs-injected` /
  `data-gs-virtual-column` present, every query equals naive physical indexing.
- **No new runtime deps; bundle within budget** (constitution §I): target a
  net IIFE delta of **≤ 0.5 KB gzipped** — the module is small and largely
  replaces existing inline filters (some sites get *smaller*).
- **No network, offline-first** (constitution §VI): pure DOM, no fetch.

**Scale/Scope**: Up to ~10 tables per page, each up to ~1 000 rows × ~50
columns, with up to: 2 axis sliders, N virtual columns, one sort, per-column
filters — all potentially active at once. The layer must remain correct and
within budget at that composition.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0:

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Lightweight & Minimal Dependencies | ✅ Pass | No new runtime deps. Net IIFE delta budgeted ≤ 0.5 KB gzipped; several migrated sites shrink (inline filters → shared calls). Measured by `scripts/bundle-size.js`. |
| II. Test Discipline | ✅ Pass | New Vitest unit suite + composition matrix (both activation orders). The shipped bug fix already carries a regression test; this feature generalises it. Full unit + e2e green before merge (SC-005). |
| III. Accessibility by Default | ✅ Pass | No UI change. By placing trigger buttons on correct cells and reading correct values, it *improves* the fidelity of `aria-sort`/`aria-checked` state already emitted by consumers. No new controls. |
| IV. Progressive Enhancement | ✅ Pass | Pure read layer; identity behaviour when no enrichment active (FR-012). No DOM mutation, so the no-valid-table and missing-data degradations are unchanged. |
| V. Cross-Browser Compatibility | ✅ Pass | Only `Array.from`, attribute reads, `HTMLTable*` DOM, `WeakMap` (via existing OOR). All > 2 years on every engine. No feature detection needed. |
| VI. Offline-First / Air-Gapped | ✅ Pass | Zero network. Pure in-memory DOM traversal. |
| Development-Phase Posture | N/A (favourable) | Pre-production: module layout and the (internal-only) API may evolve freely. The layer is explicitly **not** added to the frozen `window.gridSight.init` surface. |

**No constitution violations.** Complexity Tracking section intentionally empty.

**Post-design re-check (2026-05-26)**: After producing `research.md`,
`data-model.md`, `contracts/table-grid-api.md`, and `quickstart.md`, every gate
was re-evaluated against the concrete API shape. No new dependency, no network
call, no new DOM/marker, no addition to the public API surface; bundle estimate
holds. Verdict unchanged: passing on every principle.

## Project Structure

### Documentation (this feature)

```text
specs/013-table-grid-addressing/
├── plan.md                      # This file (/speckit-plan output)
├── spec.md                      # Feature specification (input)
├── research.md                  # Phase 0 — coordinate model, marker semantics, migration decisions
├── data-model.md                # Phase 1 — logical grid entities + addressing invariants
├── quickstart.md                # Phase 1 — migrate a consumer off physical indexing in < 5 min
├── contracts/
│   └── table-grid-api.md        # Phase 1 — the src/core/table-grid.ts public surface
├── checklists/
│   └── requirements.md          # Spec validation (passing 16/16)
└── tasks.md                     # Phase 2 output — created by /speckit-tasks (not here)
```

### Source Code (repository root)

Reuses the existing single-project layout; the only architectural addition is
`src/core/table-grid.ts` as the shared addressing hub. Every other change is a
migration of an existing consumer onto it.

```text
src/
├── core/
│   ├── table-grid.ts                    # NEW — the logical↔physical addressing authority
│   ├── table-detection.ts               # MODIFIED — column-type derivation reads via table-grid
│   ├── type-detection.ts                # MODIFIED — cell reads via table-grid.cellValue / source cells
│   └── original-order.ts                # UNCHANGED — consulted by table-grid for row identity
├── ui/
│   ├── header-utils.ts                  # MODIFIED — delegate nonInjected* to table-grid; fix headerColIndex; injectPlusIcons uses grid
│   ├── toggle-injector.ts               # MODIFIED — statistics/frequency/heatmap/row sites use logical coords + cellValue
│   └── …                                # other UI unchanged
├── enrichments/
│   ├── slider-injection.ts              # MODIFIED — delegate nonInjectedRows/Cells to table-grid (single source)
│   ├── sort.ts                          # MODIFIED — comparison reads via table-grid (rowspan-safe column cells)
│   ├── filter.ts                        # MODIFIED — predicate reads via table-grid
│   ├── filter-helpers.ts                # MODIFIED — cell access via table-grid
│   ├── frequency.ts                     # MODIFIED — column/row extraction via table-grid
│   ├── heatmap.ts                        # MODIFIED — replace tbody tr:nth-child(i) with logical row access
│   ├── sparkline-column.ts              # MODIFIED — source-cell reads via table-grid
│   ├── compare-column.ts                # MODIFIED — source-cell reads via table-grid
│   ├── cumulative-column.ts             # MODIFIED — source-cell reads via table-grid
│   └── slider-threshold.ts              # MODIFIED — cell reads via table-grid
└── utils/
    └── view-state-url.ts                # ALREADY FIXED — colKeyAt filters injected; optionally delegate to table-grid

src/core/__tests__/
├── table-grid.test.ts                   # NEW — primitives + edge cases (rowspan, virtual, header detection, OOB)
└── table-grid.composition.test.ts       # NEW — the {slider}×{virtual}×{sort} matrix in BOTH activation orders

src/ui/__tests__/
└── header-utils.slider-placement.test.ts # EXISTING — kept (the original regression)
```

**Structure Decision**: Reuse the existing single-project layout. The **only**
architectural addition is `src/core/table-grid.ts`. It is placed under
`src/core/` (alongside `table-detection.ts`, `type-detection.ts`,
`original-order.ts`'s consumers) because it is foundational and consumed by both
`enrichments/` and `ui/`; placing it in `core/` avoids an `enrichments → ui` or
`ui → enrichments` dependency cycle. This mirrors how `original-order.ts` and
`column-types-cache.ts` sit below the feature modules.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Section intentionally empty.
