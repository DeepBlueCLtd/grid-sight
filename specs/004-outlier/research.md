# Phase 0 Research: Outlier Marker Enrichment

Feature: `004-outlier` · Date: 2026-05-28 · Input: [spec.md](./spec.md)

This document resolves every unknown and `NEEDS CLARIFICATION` in the spec and
records the decisions that shape Phase 1. Format per decision: **Decision /
Rationale / Alternatives considered**.

---

## R-1. σ convention vs. statistics-popup agreement (the only real tension)

**Context.** The spec requires population σ (`÷ n`) for outliers (FR-008,
Assumption "Population σ, unmodified") **and** requires the outlier tooltip's
mean/σ to agree with the statistics enrichment to floating-point round-off
(FR-024, SC-006). But the existing statistics enrichment computes **sample** σ:
`src/enrichments/statistics.ts:46` calls `standardDeviation` from
`simple-statistics`, which divides by `n − 1`. Population σ and sample σ differ for
every finite column, so the two requirements cannot both hold while the two
enrichments compute σ independently with different formulas.

**Decision.** Introduce one shared module, `src/core/column-statistics.ts`, that is
the single authority for a column's `(mean, populationStdDev, numericCount)` over a
filter-aware numeric-cell set. Both the outlier enrichment and `statistics.ts`
consume it. The statistics popup therefore switches from sample σ to **population
σ** so the two views are identical by construction (same code path, same inputs).
The Development-Phase Posture (constitution §"Development-Phase Posture") explicitly
waives backwards-compatibility for displayed numbers pre-production, so changing the
statistics popup's σ from sample to population is permitted; the change is covered by
updating `statistics.ts` tests.

**Why population (not sample) is the shared convention.** The spec's outlier
acceptance scenarios are written against population σ ("the 68/95/99.7 rule"),
outliers is the feature under specification, and population σ is the textbook choice
for "distance from the mean of *this* set of values" (we are describing the column
we have, not inferring a wider population). Aligning the popup to outliers (rather
than the reverse) keeps the spec's acceptance math correct.

**Implementation note.** Population σ over `values: number[]` with mean `m` is
`Math.sqrt(values.reduce((s,v)=>s+(v-m)**2,0) / values.length)` — plain TS, no new
dependency (spec Assumption "No new runtime dependency"). `simple-statistics` does
expose population variants, but computing inline keeps `column-statistics` free of
the import-shape question and is trivially testable. The shared module returns the
mean alongside σ so callers never re-derive the mean from a different cell set.

**Agreement is then a test, not a hope.** `column-statistics.test.ts` asserts that,
given the same column, the value the statistics popup formats and the value the
outlier tooltip formats derive from one call — satisfying SC-006 structurally.

**Alternatives considered.**

- *Outliers use sample σ to match the current popup.* Rejected: contradicts FR-008
  and the spec's worked acceptance numbers, and sample σ is the wrong "distance from
  this column's mean" semantics.
- *Two independent computations that "happen to" use the same formula.* Rejected:
  this is exactly the drift the spec's Key Entity "Column Statistics — Shared with
  the statistics enrichment so the two views never disagree" forbids; two code paths
  will diverge under future edits.
- *Keep popup on sample σ, document a known discrepancy.* Rejected: violates SC-006
  outright.

---

## R-2. URL persistence: parameter and grammar

**Context.** FR-015 requires the active outlier state — per table, per column, per
threshold ∈ {1,2,3} — encoded in the URL fragment "using the same per-URL-stem
scheme as `src/utils/slider-persistence.ts`". Two existing precedents live in
`location.hash`: `gs.s` (slider positions, `slider-persistence.ts`) and `gs.v`
(combined sort+filter per-table directives, `view-state-url.ts`). Both preserve the
other `&`-separated parameters when writing.

**Decision.** Add a third, independent fragment parameter **`gs.o`** with a
per-table directive grammar modelled on `gs.v`:

```text
gs.o = <tableId>(<colKey>:<threshold>;<colKey>:<threshold>; …) , <tableId>( … )
```

- `tableId` is the table's stable id (same id source `gs.v` uses — see R-5).
- `colKey` is `colKeyAt(table, colIndex)` from `view-state-url.ts` (slug of the
  header text; falls back to `c<index>`), so outliers, sort, and filter all name
  columns identically.
- `threshold` ∈ `{1,2,3}` (idle columns are simply absent).

Persistence reuses the shared per-URL-stem helpers already exported by
`slider-persistence.ts`: `urlStem()` and `storageKeyFor('outliers')` for the
`localStorage` mirror key `gs:${stem}:outliers`, and `history.replaceState` to write
the hash without a history entry (same as `persistPosition`/`commitViewStateToLocation`).

**Rationale.** `gs.o` is a separate concern from sort/filter, so a separate parameter
keeps `view-state-url.ts` untouched and avoids cross-feature coupling, while the
per-table/per-column grammar and stem/storage rules are identical to the established
schemes the spec points at. Using `colKeyAt` guarantees a missing-column directive is
detectable (no matching header → skip), satisfying FR-017.

**Alternatives considered.**

- *Reuse `gs.v` and extend its grammar with an `o:` directive.* Rejected: couples a
  new feature to the frozen 002-003 contract (`url-fragment-schema.md`) and bloats a
  module other enrichments share; a parallel `gs.o` is cleaner and independently
  testable.
- *Use the `gs.s` `id:pos` shape literally.* Rejected: that shape is flat (one global
  id→number map) and cannot express per-table + per-column nesting; threshold is an
  enum, not a 0–1 position.
- *`localStorage` as source of truth.* Rejected: SC-004 requires 100% reproduction on
  another machine with **no `localStorage` dependency**; URL is authoritative,
  `localStorage` is a same-machine convenience mirror only (mirrors slider behaviour).

---

## R-3. Recompute trigger when filters change

**Context.** FR-008 / spec Assumption "Recompute on filter changes": when any filter
is active, σ and mean are computed over currently un-dimmed rows, and marks recompute
whenever the filter set changes. Sort reorders rows but does not change which cells
are outliers (Edge Cases).

**Decision.** Subscribe to `onVisibleRowsChange(table, listener)` from
`src/utils/visible-rows.ts` for any table with at least one active outlier directive.
On each emission, recompute that table's active columns' statistics over the
un-dimmed rows (`entry.state === 'visible'`) and re-derive marks. The subscription is
established lazily when a column first becomes active and torn down when the last
directive on the table clears (and on enrichment/Grid-Sight teardown). Because marks
are keyed to cells (not row indices), sort reordering needs no special handling —
markers ride their cells; only a filter-driven change to the *un-dimmed set* changes
which cells qualify.

**Rationale.** `onVisibleRowsChange` already fires on both sort and filter mutations
with a `revision` counter; reusing it means outliers stay consistent with the same
pipeline sort/filter use, with no new event surface. Recomputing only active columns
keeps within the SC-002 budget.

**Alternatives considered.**

- *MutationObserver on the tbody.* Rejected: coarser, fires on unrelated DOM churn,
  and duplicates what `visible-rows` already centralises.
- *Always compute over the full unfiltered population.* Rejected by the spec
  Assumption (the user has declared the visible subset the "real" data); noted there
  as a possible future per-table option, out of scope for v1.

---

## R-4. Two-channel marker + keyboard-reachable tooltip

**Context.** FR-006 requires ≥ 2 visual channels (colour alone insufficient);
FR-007/FR-019 require the per-cell tooltip on hover **and** keyboard focus.

**Decision.** Mark a cell by adding a class (e.g. `gs-outlier-cell`) plus a
`data-gs-outlier` attribute carrying the signed σ distance. CSS in
`outlier-styles.ts` renders two independent channels: a coloured **ring/outline**
*and* a distinct **border style** (e.g. dashed vs the table's solid). To make the
tooltip keyboard-reachable, the cell is made focusable (`tabindex="0"`) only while
marked and the tooltip is shown on both `mouseenter`/`mouseleave` and
`focus`/`blur`; the accessible text is also mirrored to the cell's `aria-describedby`
target so screen readers announce "value 135, mean 100.0, +3.5σ". On teardown the
`tabindex`, attributes, class, and describedby node are all removed so the DOM is
byte-identical (SC-005).

**Rationale.** Two-channel marking and dual hover/focus tooltips are the established
accessible pattern; the project already injects CSS per enrichment
(`slider-styles.ts`, `annotation-styles.ts`, `row-visibility-styles.ts`), so a
dedicated `outlier-styles.ts` fits convention and is removable for clean teardown.

**Alternatives considered.**

- *Background-colour only.* Rejected by FR-006 (colour as sole channel).
- *Native `title` attribute for the tooltip.* Rejected: not focus-reachable, not
  stylable, and inconsistent across browsers; a managed tooltip element matches
  `statistics-popup`/`popup-chrome` conventions and satisfies FR-019.

---

## R-5. Lozenge model, glyph, and secondary affordance

**Context.** FR-001–FR-004, FR-011, FR-018. The lozenge lives in the existing header
cluster alongside `H` (heatmap), `#` (statistics), `▽` (filter), `↕` (sort), and is
keyboard-operable with an `aria-pressed` state and a four-step cycle.

**Decision (glyph — resolves spec Assumption clarification).** Use **`!`**. Audited
in-use lozenge glyphs: `H` (`header-utils.ts:190`), `#` (`header-utils.ts:231,248`),
`▽` (filter, `filter-lozenge.ts:32`), `↕` (sort, `sort-lozenge.ts:41`). **`!` is not
used by any existing or registered-but-unshipped lozenge** → no collision. The
active threshold is shown by appending the digit to the glyph (`!2`, `!1`, `!3`);
idle shows a bare `!`.

**Decision (model).** Build `createOutlierLozenge(args)` mirroring `createSortLozenge`
(`sort-lozenge.ts`): a `<button data-gs-lozenge-id="outlier" class="gs-lozenge …">`
with an internal `refresh()` that, on each render, reads the current directive and
updates: glyph text (`!`/`!2`/`!1`/`!3`), `aria-pressed` (`true` when active),
`aria-label`/`title` describing the current threshold and the next action
(e.g. "Outliers in column 'Latency' at 1σ; click for 3σ"), and the active class.
Click cycles `idle → 2σ → 1σ → 3σ → idle`; Enter/Space trigger the same handler
(native `<button>` already does this). The behavior is contributed via
`registerEnrichment({ id: 'outlier', appliesTo, mount, isActive })` from
`header-utils.ts`, exactly like sort/filter.

**Decision (secondary affordance — FR-011).** While active, the lozenge exposes a
"show list" affordance reachable by **mouse** (a small adjacent icon button rendered
in the cluster next to the active lozenge) **and** by **keyboard** (`Shift`+`Enter`
while the lozenge is focused). Both open the same outliers-list dialog (R-6).

**Decision (tableId / colKey).** Reuse the same `tableId` source `gs.v` uses and
`colKeyAt(table, colIndex)` from `view-state-url.ts` so outlier directives name
tables/columns identically to sort/filter (consistency for persistence + missing-
column detection).

**Rationale.** Cloning the proven `sort-lozenge` shape minimises risk and keeps ARIA
and refresh conventions identical across lozenges; `!` reads as "attention" without a
statistical commitment and is unambiguous in one character (spec Assumption).

**Alternatives considered.** `±`, `σ`, `▲` (spec Assumption) — `σ` over-claims a
specific statistic, `±` is visually heavy next to `#`, `▲` collides conceptually with
sort arrows. `!` chosen.

---

## R-6. Outliers list popup (focus-trapped dialog)

**Context.** FR-012–FR-014, FR-020: a sorted list dialog, click-to-scroll-and-
highlight without closing, close on Escape/outside-click/second activation with focus
returned to the lozenge.

**Decision.** Build `openOutlierPopup(args)` on top of the shared
`installPopupChrome(popup, anchor, focusables, onClose)` and `positionPopup` from
`src/ui/popup-chrome.ts` — the same primitives the filter popups use. The popup is a
`role="dialog"` with `aria-label` "Outliers in column 'X' at Nσ", lists each mark as
`row label — value — σ distance` sorted by descending `|σ|` with document-order
tie-break (FR-012), and each entry is a focusable button. Activating an entry scrolls
its row into view (`scrollIntoView({ block: 'nearest' })`) and adds a brief highlight
class without disposing the popup (FR-013). `installPopupChrome` already gives Escape,
Tab focus-trap, outside-click dismiss, and refocus-the-anchor on close (FR-014/FR-020);
a second activation of the secondary affordance calls the returned `dispose()`.

**Rationale.** `popup-chrome.ts` already implements the exact focus-trap/Escape/
outside-click/return-focus contract the spec mandates; reusing it guarantees parity
with the filter popups and avoids re-implementing accessibility-critical code.

**Alternatives considered.** Native `<dialog>` — inconsistent focus-return and
styling across the supported range and not what the codebase uses; rejected for
convention consistency.

---

## R-7. Lifecycle: registry, apply, teardown, round-trip

**Context.** `docs/adding-an-enrichment.md` is the binding ship checklist. The
`outlier` catalog entry already exists as `shipped: false`
(`enrichment-registry.ts:128`).

**Decision.**

- **Registry**: flip `outlier` to `shipped: true`; add `tearDown(table)` that removes
  all markers/tooltips/popups and unsubscribes the filter listener (byte-identical
  DOM, FR-021/SC-005); add `apply(table)` (the enrichment renders persisted marks
  automatically from `gs.o`, so it needs the re-apply hook for the
  enable→disable→enable round-trip — checklist §3).
- **Apply wiring** (`index.ts`): call `applyOutliers(table)` for each processed table
  in `processTable`, gated on `isEnrichmentEnabled('outlier')`; ensure `disable()`
  removes all outlier DOM (global off path byte-identical).
- **Gating attributes**: `appliesTo` returns false for `data-gs-no-outlier` on the
  table (FR-022) and the whole table is skipped under `data-gs-ignore` (FR-023) — the
  latter is already handled centrally by the table-detection/injection pass.
- **Grid-Sight off** keeps `gs.o` in the URL (FR-021): teardown removes DOM only, it
  does not rewrite the hash.

**Rationale.** This is the standard descriptor-model lifecycle (sort/filter/
annotations); following the checklist verbatim is what keeps an enrichment from
shipping "half-wired" (the doc's stated failure mode).

**Alternatives considered.** None — the lifecycle is prescribed by the architecture.

---

## R-8. Edge-case handling (consolidated)

| Case | Decision | Source |
|------|----------|--------|
| `n < 3` numeric cells | No lozenge rendered (`appliesTo` false). | FR-010, Edge Cases |
| All-equal values (σ = 0) | Lozenge rendered but **inert**: click is a no-op, tooltip "All values equal; no outliers to flag". | FR-009, Edge Cases |
| Non-numeric cells | Excluded from mean/σ (via `cleanNumericCell` → null) and never marked. | FR-005, FR-008, Edge Cases |
| `rowspan` body cells | Column does not qualify (`appliesTo` false), mirroring sort/filter `columnHasRowspanBodyCells`. | FR-002 |
| Single extreme distorts σ | Accepted (textbook population σ); robust estimators out of scope. | Edge Cases, Assumptions |
| Filter active | Stats over un-dimmed rows; recompute on `onVisibleRowsChange`. | R-3, FR-008 |
| Sort active | Marks ride cells; no recompute needed. | R-3, Edge Cases |
| Missing table/column in `gs.o` | Directive silently skipped; others applied. | FR-017, R-2 |
| Grid-Sight off | DOM removed; `gs.o` retained in URL. | FR-021, R-7 |

---

## Open questions

None. All spec `NEEDS CLARIFICATION` items resolved:

- **`!` glyph collision** (spec Assumption) → resolved in R-5: no collision with
  `H`, `#`, `▽`, `↕`, or any registered id.
- **Population vs sample σ / agreement** (FR-008 vs FR-024/SC-006) → resolved in R-1:
  one shared `column-statistics` module; statistics popup moves to population σ.
