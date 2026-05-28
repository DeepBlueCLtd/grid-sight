# Phase 0 Research: Large-Table Navigation & Analysis (Tier 1)

Design decisions resolving the open questions for the four pieces. Each entry:
**Decision / Rationale / Alternatives considered.** No `NEEDS CLARIFICATION`
remained after the spec's clarification round (P2 = extend `statistics`).

---

## R-1. freeze-panes: how to make the header row and key column sticky

**Decision**: Use CSS `position: sticky` with **no DOM wrapping**. A one-time
apply pass tags (a) every header cell in the header row and (b) the first
*logical* cell of every grid row (the key column, resolved via the addressing
layer, **not** `:first-child` — which can be a slider scaffold). A minified
injected stylesheet keyed off a `gs-freeze` class on the `<table>` sets
`position: sticky; top: 0` on tagged header cells, `position: sticky; left: 0`
on tagged key cells, and `top:0; left:0` + higher `z-index` on the corner
(header ∩ key). Tagged cells get an opaque background and `z-index` so scrolling
content does not show through. Stickiness resolves against the nearest scrolling
ancestor (the author's `overflow:auto` wrapper if present, else the viewport).

**Rationale**: Zero-wrap keeps teardown byte-identical (remove `gs-freeze` +
the two cell classes + any inline background we added). It works for the two
common cases — a full-page table (header sticks to the viewport top as the page
scrolls, à la DataTables FixedHeader) and a table inside an author scroll
container — without us inventing a viewport. Cheapest possible bundle cost
(mostly CSS).

**Alternatives considered**:

- *Wrap the table in a `gs-freeze-scroll` div with `max-height`/`overflow:auto`*:
  gives a guaranteed scroll region but mutates structure (teardown must unwrap,
  risks disturbing author layout/CSS) and forces a height policy we shouldn't
  own. Rejected; may revisit as an opt-in `data-gs-freeze-scroll` later.
- *JS-driven cloned floating header* (absolute-positioned clone synced on
  scroll): heavier, jankier, more bytes, and a second DOM copy to keep in sync.
  Rejected.

**FR-003 no-op**: With no scrollable ancestor, sticky simply never detaches —
the table renders identically. We do **not** attempt to detect overflow and
skip; sticky is inherently a no-op without scroll, satisfying FR-003 for free.

**Multi-row headers**: tag all rows of `<thead>` (each at its own `top`
offset). v1 supports a single sticky header band stuck at `top:0`; stacked
offsets for multi-row headers are a small follow-up if a demo needs it
(recorded, not blocking).

---

## R-2. statistics extension: quantiles, missing/distinct, and empty-state

**Decision**: Extend `StatisticsResult` with `missing: number`,
`missingPct: number`, `distinct: number`, `q1: number`, `q3: number`, and
`histogram: number[]` (bin counts). Compute quartiles with `simple-statistics`
`quantile(values, 0.25|0.75)` (already a dependency — no new import cost beyond
the symbol). `missing` is counted at the **extraction** layer (cells whose
`cellValue` is blank or non-numeric over the visible set), since
`calculateStatistics` only sees the numeric array. `distinct` is the size of a
`Set` of the numeric values. Replace the current throw-on-empty with a
**zero-value result** (`count:0, missing:all, …` with non-finite numerics shown
as the existing `N/A`), so the popup renders an empty state instead of throwing.

**Rationale**: Smallest change that delivers the spec figures; reuses
`simple-statistics` already in the bundle. Counting missing at extraction is the
only place that still sees blank/non-numeric cells (the numeric array has
already dropped them).

**Alternatives**: a separate `computeColumnProfile()` — rejected as it would
duplicate the count/min/max/mean already in `calculateStatistics` and risk drift
with the popup. Keep one function.

---

## R-3. statistics extension: compute over visible rows + live refresh

**Decision**: Change the extraction helpers in `toggle-injector.ts`
(`extractNumericColumnValues` etc.) to read the **visible** rows from
`getVisibleRows(table).current()` instead of all `bodyRows`/`columnCells`. While
the popup is open, subscribe via `onVisibleRowsChange(table, …)` and re-run
extraction + `StatisticsPopup.show(...)` so an applied/cleared filter updates the
open popup; unsubscribe on close (wire into the popup's existing `onClose`).

**Rationale**: Matches FR-006 and the established frequency/outlier pattern
(subscribe-and-recompute). Cheap: the subscription lives only while the popup is
open.

**Alternatives**: recompute only on open (no live update) — simpler but fails
the "recompute when the visible set changes" clause while open. Rejected.

---

## R-4. statistics extension: mini histogram rendering

**Decision**: Render an inline SVG bar histogram inside the popup content,
reusing the rendering approach of `src/enrichments/sparkline-svg.ts` (in-DOM
`<svg>` with `<rect>` bars, no external assets). **10 equal-width bins** over
[min, max] by default; an all-equal column collapses to a single full bar. Bars
get an SVG `<title>` (range + count) for a non-colour, screen-reader-legible
signal.

**Rationale**: Fixed 10 bins is predictable, cheap, and adequate for a "shape at
a glance" read. SVG reuse avoids new rendering code/bytes and stays offline.

**Alternatives**: Freedman–Diaconis / Sturges adaptive binning — more "correct"
but more code and variable bar counts that complicate layout. Recorded as a
possible refinement; not v1.

---

## R-5. summary-row: where the footer lives and how it recomputes

**Decision**: `summary-row` is an **auto-rendered** enrichment (like
`annotations`), not a header lozenge. On `apply(table)` (gated by
`isEnrichmentEnabled('summary-row')`) it injects a single `<tfoot>` row whose
cells align to the logical columns (via the addressing layer), each marked
`data-gs-injected` so the addressing layer and other enrichments ignore it. Each
numeric-column cell shows the chosen aggregate over `getVisibleRows` and carries
a small aggregate chooser (`summary-row-control`). It subscribes via
`onVisibleRowsChange` to recompute on sort/filter. `tearDown(table)` removes the
injected `<tfoot>` row (byte-identical). The registry entry provides both
`apply` and `tearDown` so the toggle-panel round-trip restores it without reload.

**Rationale**: A footer is table-level, not per-header, so the lozenge model
doesn't fit; the auto-render + `apply`/`tearDown` model (proven by annotations)
does. `data-gs-injected` keeps it invisible to the grid (won't be summed/sorted/
exported unless export opts in).

**Alternatives**: a sticky floating summary bar (rejected — overlaps freeze-panes
concerns, more bytes); a per-column lozenge that adds the column to the footer
(rejected — more clicks, more state than "footer on/off").

**Aggregate set**: sum, average, min, max, count. Numeric aggregates exclude
non-numeric/blank cells (consistent with statistics); `count` counts non-blank
cells. Non-numeric columns default to `count`.

---

## R-6. summary-row: persistence of the per-column aggregate choice

**Decision**: Persist a map of `{ logicalColumnIndex → aggregate }` per table
under the `gs:` scheme using `storageKeyFor('summary:' + tableKey)` (table key
from the existing `data-gs-key`/id/caption/index resolution). Reuse the
versioned-envelope + try/catch + one-warn degradation pattern from
`slider-persistence.ts`. No network.

**Rationale**: Matches checklist §5 and the existing per-page scheme; the choice
is small and discrete. Keyed by logical column index so it survives reorder/
scaffolding (addressing layer).

**Alternatives**: URL-fragment encoding of every column's choice — noisy for
wide tables; localStorage is the better default here, with URL reserved for the
on/off enabled-set already handled by spec 012. (Choice persists per-page via
storage; the enrichment on/off persists via the existing enabled-set URL.)

---

## R-7. find-in-table: highlight strategy and match navigation

**Decision**: **Cell-level** highlighting via a class on the matching cell
(`gs-find-match`), with a stronger class (`gs-find-current`) for the active
match — **no `<mark>` substring wrapping**, no text-node mutation. The search
reads `cellValue` over visible-row grid cells (case-insensitive `includes`),
builds an ordered list of matching cells, and Next/Previous step through it with
wrap-around, calling `scrollIntoView({block:'nearest'})` and moving
`gs-find-current`. The find box is a table-level affordance opened from a corner
lozenge (`find-in-table` behavior, `headerType==='table'`), built with
`installPopupChrome` for focus-trap/Escape. Input is debounced (~120 ms). Clear/
close removes all match classes (byte-identical).

**Rationale**: Cell-level class is byte-identical-safe and far cheaper than
substring marking (which requires splitting/rejoining text nodes and exact
restoration). The current-match emphasis + a count ("3 of 17") is a non-colour
signal. Reuses popup-chrome for a11y.

**Alternatives**: `<mark>` substring highlighting (rejected v1 — text-node
surgery threatens byte-identical teardown and costs bytes; recorded as a future
opt-in); the browser-native Ctrl+F (rejected — can't scope to visible rows or
strip injected UI, and doesn't count/scope to one table).

**Visible-rows scope**: matches are computed over the current visible set; if a
filter changes while the box is open, re-running the search on next keystroke
re-scopes. Live re-scope on filter change without a keystroke is a recorded
nice-to-have, not v1.

---

## R-8. Registry, gating, and the disable→enable round-trip

**Decision**: Add three entries to `enrichment-registry.ts`:
`freeze-panes` (apply=`applyFreezePanes`, tearDown=`removeFreezePanes`),
`summary-row` (apply=`applySummaryRow`, tearDown=`removeSummaryRow`),
`find-in-table` (tearDown=`removeFindUi`; restores via lozenge rebuild, no
auto-render so no `apply` needed). All `defaultOn: true`, `shipped: true` in the
shipping PR. `index.ts::processTable` calls `applyFreezePanes`/`applySummaryRow`
gated on `isEnrichmentEnabled(id)`; the find lozenge mounts through the existing
descriptor pass (gated automatically). The `statistics` entry is unchanged.

**Rationale**: Directly follows checklist §1/§2/§3; auto-rendered enrichments
need `apply` for the no-reload re-enable (the 006/012 lesson), click/lozenge
ones don't.

**Alternatives**: none — this is the prescribed pattern.

---

## R-9. Bundle budget allocation

**Decision**: Soft sub-budgets (gzipped): `freeze-panes` ≤ 0.6 KB (mostly CSS),
`summary-row` ≤ 1.4 KB, `find-in-table` ≤ 1.2 KB, statistics extension ≤ 0.8 KB
(histogram SVG + figures) — combined **≤ 4 KB**, kept under the enforced 42 KB
ceiling. Measure each with `node scripts/bundle-size.js --soft` as it lands; CSS
authored pre-minified in injected `<style>` strings (terser won't minify string
literals).

**Rationale**: Matches checklist §7; per-piece budgets catch overruns early.

**Alternatives**: a single combined budget — less actionable per piece.
Rejected.
