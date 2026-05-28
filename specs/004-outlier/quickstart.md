# Quickstart: Outlier Marker Enrichment

Feature: `004-outlier` · Date: 2026-05-28 · Companion to [plan.md](./plan.md)

This is the end-to-end path to ship the outlier enrichment and verify it. It follows
`docs/adding-an-enrichment.md` — the binding ship checklist. Each numbered step maps
to tasks `/speckit-tasks` will generate.

---

## Prerequisites

```bash
yarn install          # if not already
yarn test:watch       # keep unit tests running while you build
```

The `outlier` catalog entry already exists in `src/core/enrichment-registry.ts` as
`shipped: false` — you are *flipping it on*, not inventing it.

---

## Build order (inside-out: pure → DOM → wiring)

### 1. Shared statistics (`src/core/column-statistics.ts`) — research R-1

Create the single mean + **population** σ authority. Then change
`src/enrichments/statistics.ts` to derive its displayed mean/σ from it (drop the
`simple-statistics.standardDeviation` σ path). Update `statistics` tests to expect
population σ.

```bash
# verify
yarn test src/enrichments/__tests__/column-statistics.test.ts
```

Acceptance: `computeColumnStatistics` returns population σ; a contract test asserts
the statistics popup and outlier tooltip derive σ from the same call (SC-006).

### 2. Pure mark math (`src/enrichments/outlier-marks.ts`)

`nextThreshold`, `computeMarks`, `sortMarksByDistance`, `formatOutlierTooltip`. No
DOM beyond holding cell refs.

Acceptance (`outlier-marks.test.ts`): strict `|v−mean| > Nσ`; σ = 0 ⇒ `[]`;
non-numeric excluded; descending |σ| with doc-order ties; tooltip reads
`value 135, mean 100.0, +3.5σ`.

### 3. Persistence (`src/utils/outlier-persistence.ts`) — `gs.o` schema

Encode/decode per [contracts/url-fragment-schema.md](./contracts/url-fragment-schema.md);
reuse `urlStem()` / `storageKeyFor('outliers')` from `slider-persistence.ts`.

Acceptance (`outlier-persistence.test.ts`): round-trips the example fragments;
malformed input → empty state (never throws); `gs.s`/`gs.v` preserved on write;
missing table/column dropped on resolve (FR-017).

### 4. Styles (`src/enrichments/outlier-styles.ts`)

Inject CSS for the two-channel marker (coloured ring **and** distinct border style)
and the tooltip + row-highlight (FR-006). Removable on teardown.

### 5. Lozenge (`src/ui/outlier-lozenge.ts`)

Clone `sort-lozenge.ts`. `!` / `!2` / `!1` / `!3`; `aria-pressed`; live `aria-label`;
`Shift`+`Enter` → list; inert when σ = 0.

Acceptance (`outlier-lozenge.test.ts`): cycle `idle→2→1→3→idle`; aria-pressed and
accessible name update each click; inert click is a no-op with the right title.

### 6. List popup (`src/ui/outlier-popup.ts`) + tooltip (`src/ui/outlier-tooltip.ts`)

Build the dialog on `popup-chrome.ts` (`installPopupChrome` + `positionPopup`).
Tooltip shows on hover **and** focus (FR-007/FR-019).

Acceptance (`outlier-popup.test.ts`): sorted by |σ|; entry click scrolls + highlights
without closing; Escape/outside-click close and return focus to the lozenge.

### 7. Orchestrator (`src/enrichments/outlier.ts`)

`applyOutliers`, `tearDownOutliers`, `setOutlierThreshold`, `getOutlierThreshold`,
`getOutlierMarks`. Per-table `WeakMap` state; subscribe `onVisibleRowsChange` while
any column is active (filter recompute, research R-3).

Acceptance (`outlier.test.ts`): apply→teardown leaves byte-identical DOM (SC-005);
adding/clearing a filter recomputes marks over un-dimmed rows; sort does not change
the marked set.

### 8. Wiring

- `src/core/enrichment-registry.ts`: flip `outlier` to `shipped: true`; add
  `tearDown: tearDownOutliers`, `apply: applyOutliers`.
- `src/ui/header-utils.ts`: `registerEnrichment({ id: 'outlier', appliesTo, mount,
  isActive })` per [contracts/outlier-enrichment-api.md](./contracts/outlier-enrichment-api.md) §8.
- `src/index.ts`: call `applyOutliers(table)` in `processTable` gated on
  `isEnrichmentEnabled('outlier')`; ensure `disable()` removes all outlier DOM.

### 9. Demo + stories

Add an outlier section to a `demo/` page and `src/stories/outlier.stories.ts`
(lozenge cycle + list popup interaction stories).

---

## End-to-end manual smoke (matches the user stories)

```bash
yarn build && yarn preview:demo
```

1. **US1** — Enable Grid-Sight. On a numeric column with one clear outlier, click `!`
   once → that cell gets a ring **and** border-style marker; hover/focus shows
   `value …, mean …, +N.Nσ`. Unmarked cells show no tooltip.
2. **US2** — Click the same lozenge four times → marked set grows (2σ→1σ), shrinks
   (1σ→3σ), empties (3σ→idle); glyph shows `!2`/`!1`/`!3`/`!`.
3. **US3** — At 1σ on a busy column, open the list (icon or `Shift`+`Enter`) →
   entries sorted by descending |σ|; click the top entry → its row scrolls into view
   and highlights; Escape closes and refocuses the lozenge.
4. **US4** — Flag two columns at different thresholds; copy the URL; open in a private
   window → identical flagged view, identical glyphs, no `localStorage` needed. Edit
   the URL to name a removed column → it is ignored, the rest apply.
5. **Edge** — σ = 0 column shows an inert `!` ("All values equal…"); a < 3-numeric
   column shows no `!`; toggling Grid-Sight off removes all markers but keeps `gs.o`
   in the URL so toggling on restores them.

---

## Gates before merge (constitution §Development Workflow)

```bash
yarn test         # Vitest unit + Storybook — green
yarn test:e2e     # Playwright (outlier*.spec.ts) — green
yarn build        # tsc + vite + bundle-size — green; IIFE within 10 KB gz ceiling
```

Reconcile the capability surfaces (`docs/adding-an-enrichment.md` §4) so no parallel
enrichment-id list drifts, and tick every section of that checklist in the PR.
