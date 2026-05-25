# Quickstart Walkthrough Checklist (T059)

**Feature**: 012-virtual-columns | **Quickstart**: [../quickstart.md](../quickstart.md)
**Date**: 2026-05-23

Goal: walk through each section of `quickstart.md` against the current
implementation and record any drift between the documented behaviour and
what the code actually does. The same end-to-end paths are also covered by
the Playwright suite (`tests/e2e/virtual-column-*.spec.ts`); this checklist
is the human-readable cross-check.

## Section 1 — Cumulative running sum on `Weight`

- [x] Σ lozenge appears on every numeric column header. Demo page renders Σ
      on `Q1`, `Q2`, `Q3`, `Q4`, `Weight` (confirmed by reading
      `injectCumulativeLozenges` in `src/ui/virtual-column-lozenges.ts`).
- [x] Clicking Σ on `Weight` appends a `Σ Weight` column with per-row
      running sums (`10, 25, 45, 70, 100`). Verified by
      `tests/e2e/virtual-column-cumulative.spec.ts`.
- [x] Second click cycles to percent-of-total. Verified by the same e2e
      ("Σ lozenge cycles sum → percent → off with byte-identical detach").
- [x] Third click removes the column with byte-identical DOM (same e2e).

## Section 2 — Sparkline trend across numeric columns

- [x] ⌇ lozenge appears in the corner cluster when the table has ≥ 3
      numeric body columns (gated by `canActivate` in
      `src/enrichments/sparkline-column.ts`).
- [x] Clicking ⌇ appends a `Trend` column with one inline `<svg>` per body
      row containing one `<rect>` per numeric body column. Verified by
      `tests/e2e/virtual-column-sparkline.spec.ts`.
- [x] Hover / focus shows a tooltip with the row's min / max / last
      values and highlights the contributing source-column headers.
      Verified by `tests/e2e/virtual-column-sparkline-tooltip.spec.ts`.
- [x] Per-row / shared mode toggle appears next to the `Trend` header
      (`.gs-vc-scale-toggle`). Verified by
      `tests/e2e/virtual-column-sparkline-scale.spec.ts`.
- [x] Click ⌇ again removes the column with byte-identical DOM (same
      sparkline e2e).

## Section 3 — Compare pairwise column delta

- [x] Δ lozenge appears in the corner cluster. The picker overlay
      highlights numeric column headers and captures two clicks.
      Implementation: `src/ui/compare-picker.ts`.
- [x] After picking `Q1` then `Q4`, a `Δ Q4 − Q1` column appears with
      per-row direction glyphs `▲` / `▼` / `=`. Verified by
      `tests/e2e/virtual-column-compare.spec.ts`.
- [x] Glyph + colour combination satisfies the colour-vision-deficiency
      requirement (FR-014). Verified by reading the renderer
      (`compareRenderer.renderCell`).

## Section 4 — Three variants at once

- [x] Canonical order `[Σ*, Δ, Trend]` is enforced regardless of activation
      order. Verified by `tests/e2e/virtual-column-ordering.spec.ts` and
      `src/enrichments/__tests__/virtual-column-ordering.test.ts`.
- [x] Removing a cumulative leaves the remaining columns in the same
      relative order (US6 AS3). Same tests.

## Section 5 — Share the view via URL

- [x] Every activation updates `location.hash` under `gs.vc=...`. Verified
      by `tests/e2e/virtual-column-url-share.spec.ts`.
- [x] Opening the URL on another browser context restores every directive
      within one animation frame after first paint (SC-003). Verified by
      the same e2e plus `tests/e2e/virtual-column-perf.spec.ts` (SC-003
      timing assertion).
- [x] Order-violating URLs are silently re-canonicalised (FR-VC-010).
      Verified by the second test case in the URL-share e2e.
- [x] Missing source columns / rows are silently dropped on restore
      (FR-VC-009). Verified by `restoreToken` in
      `src/enrichments/virtual-column.ts` (`numeric.has(...)` guard).

## Section 6 — Programmatic activation

- [x] `window.gridSight.virtualColumns.addCumulative / addSparkline /
      addCompare / remove / removeAll / list` all match the documented
      signatures. Implementation: `src/index.ts`. The `list()` ordering
      matches canonical left-to-right (asserted by
      `virtual-column-ordering.test.ts`).

## Section 7 — Opting a table out

- [x] `data-gs-ignore` on a `<table>` short-circuits `activateDirective`
      (verified by `virtual-column.test.ts` 'data-gs-ignore refuses
      activation').
- [x] `data-gs-no-cumulative` / `data-gs-no-sparkline` / `data-gs-no-compare`
      each skip their respective lozenge factories. Implementation:
      `src/ui/virtual-column-lozenges.ts` (each factory early-returns).

## Section 8 — Disabling Grid-Sight on the page

- [x] `gridSight.disable()` calls `vcDetachAll()` which removes every
      appended column. Implementation: `src/index.ts` and
      `src/enrichments/virtual-column.ts:detachAll`. Byte-identical DOM
      is preserved (SC-005, verified by
      `tests/e2e/virtual-column-cumulative.spec.ts` 'SC-005: combined
      detach … is byte-identical').
- [x] URL state survives detach (FR-VC-012). Verified by the same e2e
      stripping `location.hash` only after the snapshot capture.

## Section 9 — Under the hood

- [x] Single scaffold in `src/enrichments/virtual-column.ts`. ✓
- [x] Visible-row sequence consumed via `src/utils/visible-rows.ts` (now
      fully implemented post-`002-003-row-visibility`). Verified by
      `tests/e2e/virtual-column-pipeline.spec.ts`.
- [x] Copy-as-CSV registry already populated by the scaffold (see
      `src/utils/copy-as-csv-registry.ts`), pending `009-copy-as-csv`.

## Drift identified

None. Quickstart matches the implementation.

## Notes

- The scale-toggle glyph in the implementation is `↔` (per-row) / `↕`
  (shared) rather than a textual "mode" button. Quickstart §2 says "use
  the small mode-toggle button next to the `Trend` header" — that wording
  is still accurate; the implementation choice of glyph is left
  unspecified by the spec.
- The bundle ceiling has been raised again (34 → 36 KB) to accommodate
  the spec-012 polish work; see
  `specs/012-capability-filtering/baseline-bundle-size.md` for the running
  history.
