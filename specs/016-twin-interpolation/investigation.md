# Investigation: Twin (grouped) interpolation tables

**Branch**: `claude/twin-table-interpolation-rbbvxp`
**Created**: 2026-07-03
**Status**: **Implemented** (synced-blocks model, §3.2) — see the modules and
tests below.
**Trigger**: A real-world lookup table format spotted in the field — *Speed*
(rows) × *Direction* (columns) with a merged **Season** column (`Summer` /
`Winter`) grouping the speed rows into two independent blocks.

> **Implemented in this branch.** Twin detection (`src/core/twin-grid.ts`),
> per-block interpolation (`src/enrichments/twin-interp.ts`), and the synced
> twin-slider controller (`src/enrichments/twin-slider.ts`), wired into the
> lozenge/slider layer (`src/ui/header-utils.ts`). On a twin table the
> mis-placed H/# lozenges are no longer offered and the corner shows an enabled
> **S** toggle that adds a shared Direction slider plus a per-block Speed slider,
> synced by value, with out-of-range blocks disabled and cleared. Covered by
> unit tests (twin-grid, twin-interp, twin-slider) and an e2e spec
> (`tests/e2e/twin-interpolation.spec.ts`). **Deferred:** making the *other*
> enrichments (heatmap, statistics, sort/filter, outlier) group-aware — today
> they are simply not offered on a twin table rather than mis-applied.

---

## 1. The format ("twin" table)

The table is really **two stacked lookup grids that share one axis**. On the
left are two label columns — a merged **Season** group column and the numeric
**Speed** column — followed by the numeric **Direction** columns:

| Season (merged) | Speed | 000° | 045° | 090° | 135° | 180° |
| --------------- | ----- | ---- | ---- | ---- | ---- | ---- |
| Summer (rowspan 6) | 30 | … | … | … | … | … |
| ″ | 40 | … | … | … | … | … |
| ″ | 50 | … | … | … | … | … |
| ″ | 60 | … | … | … | … | … |
| ″ | 70 | … | … | … | … | … |
| ″ | 80 | … | … | … | … | … |
| Winter (rowspan 4) | 20 | … | … | … | … | … |
| ″ | 30 | … | … | … | … | … |
| ″ | 40 | … | … | … | … | … |
| ″ | 60 | … | … | … | … | … |

Key structural facts:

- **Summer** covers Speed 30–80 kts (6 rows); **Winter** covers 20–60 kts (4
  rows). The two speed ranges **overlap** but the *data* is independent.
- Both blocks share the same **Direction** column axis.
- A cell is addressed by **(Season, Speed, Direction)** — three coordinates,
  where Season is categorical and the other two are numeric.
- Interpolation must stay **inside one season block** — you never interpolate
  a value that blends Summer and Winter data.

A faithful reproduction lives at
[`public/demo/twin-table/index.html`](../../public/demo/twin-table/index.html)
(demo #15, *Twin table (investigation)*).

## 2. What happens today (reproduced, not assumed)

Grid-Sight's slider binding reads exactly **one** row-header column (the first
source cell of each body row) and treats every other body cell as data
(`src/enrichments/slider-injection.ts` → `readRawAxisHeaders`,
`readRawCellMatrix`). Run against the twin table it mis-reads every structural
element. Observed output from the live addressing layer:

```text
ROW headers (axis=row): ["Summer","40","50","60","70","80","Winter","30","40","60"]
COL headers (axis=col): ["Speed","000","045","090","135","180"]
Cell matrix (ragged):   [[30,…],[…],…,[20,…],[…],…]   // leading rows carry 5 values, others 4
buildAxisBinding(row):  null
buildAxisBinding(col):  null
```

Three distinct failures, all rooted in the single-row-header assumption:

1. **Row axis is poisoned by the group cell.** On a group-*leading* row the
   first source cell is the merged `Season` `<th>` (`Summer` / `Winter`), so
   `parseHeaderNumber` hits a non-number and the whole binding aborts. On
   continuation rows the first cell is the Speed value — so the column offset
   silently shifts by one between the two row kinds.
2. **Column axis gains a phantom `Speed` header.** `readRawAxisHeaders('col')`
   slices off only the *first* header cell (`Season`), leaving `Speed` sitting
   in the Direction axis.
3. **The cell matrix is ragged.** Group-leading rows keep an extra leading value
   (the Speed number leaks into the data row), so rows are 5 or 4 wide
   depending on whether they start a season.

**Net effect: `buildAxisBinding` returns `null` for both axes → no slider is
offered at all.** The table is silently un-enrichable — exactly the "we may not
be able to support this" the format was flagged for. (This is also *safe*: it
fails closed, it does not produce a wrong interpolated number.)

### 2.1 A second symptom: enrichment lozenges land in the wrong cells

The same single-row-header assumption lives in the lozenge injector
(`src/ui/header-utils.ts` → `injectPlusIcons`), so the twin table also mounts the
per-column / per-row H (heatmap) and # (statistics) lozenges on the wrong cells.
Dumped from the live DOM after enabling Grid-Sight on the fixture:

```text
header row:        Speed[H,#]  000°[H,#]  045°[H,#] … 180°[H,#]
Summer block row1: "Summer"[H,#]   30 (—)   18.2 …          // lozenges on the merged Season cell
Summer block rowN: 40[H,#] 50[H,#] 60[H,#] 70[H,#] 80[H,#]  // on the Speed values
Winter block row1: "Winter"[H,#]   20 (—)   15.0 …
Winter block rowN: 30[H,#] 40[H,#] 60[H,#]
```

Three placement bugs, all the same root cause:

1. **`Speed` (a row-header *label* column) is mistaken for a data column.** The
   injector treats every header cell after index 0 as a column, so the Speed
   label header wrongly offers column enrichments (H/#).
2. **On group-leading rows the row lozenges attach to the merged `Season` cell.**
   The row pass always reads `gridCells(row)[0]`, which on a leading row is the
   `Summer`/`Winter` rowspan cell, not the Speed value.
3. **The first speed of each block (30, 20) gets no lozenge at all.** It sits in
   `gridCells(row)[1]` of a group-leading row, which the row pass never inspects.

Note the codebase already has *partial* rowspan awareness: `columnHasRowspanBodyCells`
correctly **suppresses** sort / filter / outlier on the grouped column (which is
why only H and # mis-mount, not the whole cluster). But that is a defensive
guard, not structural understanding — it prevents some wrong lozenges without
placing the right ones. **Twin support is therefore an addressing-layer concern,
not a slider-only one:** the same `rowGroups` / group-column detection that fixes
the binding also feeds the lozenge injector, heatmap, and sort/filter suppression.

## 3. Can we offer "twin" interpolation? — Yes, and it is a small extension

A proof-of-concept group-aware binding builder was prototyped against the same
fixture. It partitions the body rows on the `rowspan` group cell, emits **one
grid per season** sharing the Direction axis, and feeds each into the existing
pure `bilinear()` primitive **unchanged**:

```text
GROUPS:
  Summer  rowHeaders=[30,40,50,60,70,80]  colHeaders=[0,45,90,135,180]  matrix 6×5 ✓ rectangular
  Winter  rowHeaders=[20,30,40,60]        colHeaders=[0,45,90,135,180]  matrix 4×5 ✓ rectangular
bilinear(Summer, speed=35, dir=22.5) = 3.5   // bracketed strictly within the Summer block
```

So the hard parts — interpolation maths, highlight/readout, persistence, sync —
are **already done and reusable**. The only genuinely new work is *structural*:
recognising the group column and slicing the body into per-group sub-grids.

### 3.1 Detecting a twin table

A table is "twin" when a **leading group column** partitions the body rows.
Robust, DOM-only signal (no new authoring markup required):

- Some body row's **first source cell has `rowSpan > 1`** (the merged
  `Season` cell). This is the primary detector and it is what the reproduction
  uses.
- The **row-header (Speed) column** is then the *first numeric* source column —
  i.e. the source column immediately after the group column(s).
- Generalises to *N* leading label columns and *N* groups; the format is not
  limited to two seasons.

An explicit opt-in/---out attribute (e.g. `data-gs-group-col="0"` or
`data-gs-twin`) can back-stop the heuristic for tables where `rowspan` is used
cosmetically rather than structurally.

### 3.2 Interaction model — synced blocks (decided 2026-07-03)

**Chosen model: treat the two blocks as *synced sub-tables*, no selector.** Each
block gets its own Speed (row) slider; the two are **synced by value** — dragging
Summer's Speed to 55 moves Winter's to 55 as well — exactly like the existing
cross-table sync (`deriveSyncKey` / `broadcastSync`, demo #3). The Direction
(col) axis is shared. Each block renders its own interpolated readout and its own
four-cell highlight rectangle.

The one behaviour beyond today's sync is **range divergence**: the blocks'
Speed ranges differ (Summer 30–80, Winter 20–60).

- In the **overlap (30–60)** both blocks are live: both interpolate, both show a
  highlight rectangle, both sliders track the shared value.
- When the shared Speed leaves a block's range — e.g. 70 (inside Summer, outside
  Winter) — that block's Speed slider is **disabled** and its highlight rectangle
  and interpolated readout are **cleared** (shown as `—`), while the in-range
  block keeps interpolating. Symmetrically at the low end (e.g. 25 disables
  Summer, keeps Winter).

This differs from the existing `broadcastSync`, which *clamps* an out-of-range
partner to its min/max; here an out-of-range partner must **disable + clear**,
not clamp to a misleading edge value. That is the one new rule the twin
controller adds on top of the reused sync/interpolation/highlight machinery.

A `Summer | Winter` selector was considered and **rejected** — the synced-blocks
model reads the way the physical sheet is used (both seasons visible at once) and
reuses the sync pattern users already know from demo #3.

### 3.3 Where the code changes land

| Area | Change | Size |
| ---- | ------ | ---- |
| `src/core/table-grid.ts` | Add group-column detection + a `rowGroups(table)` reader (label + its body rows), reusing `sourceCells`/`cellValue`. Pure DOM read. | small |
| `src/enrichments/slider-injection.ts` | Generalise `readRawAxisHeaders`/`readRawCellMatrix`/`buildAxisBinding` to take an optional row-group so the row axis skips the group column and the matrix is sliced to the group's rows. | small–medium |
| `src/enrichments/twin-slider.ts` (NEW) | Self-contained twin controller: per-block Speed slider + shared Direction slider, value-sync across blocks, out-of-range disable + clear (§3.2). Reuses pure `bilinear` + highlight helpers; leaves the single-grid slider path untouched so normal tables can't regress. | medium |
| `src/ui/header-utils.ts` | Branch the `sliders` descriptor to the twin controller when a twin table is detected; use the group-aware row-header column so H/# lozenges mount on the Speed value (not the merged `Season` cell), skip the label columns, and cover the first speed of each block (fixes §2.1). | small |
| `src/utils/interpolation.ts` | **None** — `bilinear`/`linear1D` are reused verbatim. | none |
| Persistence/sync (`slider-persistence`, `sync-key`) | Add the active-group id to the per-slider key so a bookmarked position restores to the right block. | small |

No new runtime dependency; no network; the maths layer is untouched.

## 4. Constitution check (feasibility-level)

| Principle | Verdict | Note |
| --------- | ------- | ---- |
| I. Lightweight & minimal deps | ✅ | No new dependency; reuses `bilinear`. Est. bundle delta small (detection + selector); size gate is report-and-warn. |
| II. Test discipline | ✅ | Pure `rowGroups`/binding builders are unit-testable in isolation; the POC already exercises the partition + bilinear path. Adds a Storybook + e2e on the reproduction fixture. |
| III. Accessibility | ✅ | Season selector as a keyboard-operable `radiogroup`; colour never the sole channel. |
| IV. Progressive enhancement | ✅ | Non-twin tables are unaffected (detector is opt-in by structure). A twin table with a non-numeric axis still simply offers no slider — **fails closed today, keeps failing closed** until the feature ships. |
| V. Cross-browser | ✅ | `rowSpan`, attribute reads, DOM creation only. |
| VI. Offline-first | ✅ | Pure in-memory reads; zero network. |

## 5. Risks & open questions

- **Detection false-positives.** `rowspan` is sometimes cosmetic. Mitigation:
  require the group column to sit *before* a numeric row-header column, and offer
  `data-gs-twin` / `data-gs-no-twin` as explicit overrides.
- **Overlapping speed ranges.** Summer 30–80 and Winter 20–60 overlap; the
  selector (design A) removes ambiguity because interpolation is always scoped to
  the chosen block. Worth an explicit acceptance test.
- **Ragged blocks / gaps.** Winter skips 50 kts (20, 30, 40, 60). `bilinear`
  already brackets by header value, so uneven spacing is fine; a block with a
  <2-row or <2-col axis simply offers no slider on that axis (existing rule).
- **>2 groups and multi-level headers.** The design generalises to N groups; a
  *second* group column (nested merges) is out of scope for a first cut.
- **Heatmap/statistics interaction.** Those enrichments already read via the
  addressing layer; group-awareness there (per-block heat scaling) is a separate,
  optional follow-up, not a blocker.

## 6. Recommendation

**Feasible and worth doing.** The blocking work is a small, well-contained
addressing-layer extension (group detection + per-group sub-grid slicing); the
interpolation core is reused unchanged. Suggested next step: promote this to a
full `spec.md` (via `/speckit-specify`) for design **A** (season selector +
shared, re-ranging sliders), using
[`public/demo/twin-table/index.html`](../../public/demo/twin-table/index.html)
as the driving fixture. Until then, the current fail-closed behaviour is correct
and safe — Grid-Sight offers no slider rather than a wrong number.

## Appendix — how these findings were produced

Both the failure and the proof-of-concept were run against the live jsdom
addressing layer (not reasoned about on paper):

- **Current behaviour**: constructed the twin DOM, called the real
  `readRawAxisHeaders` / `readRawCellMatrix` / `buildAxisBinding`
  (`src/enrichments/slider-injection.ts`) → both bindings `null`, ragged matrix,
  poisoned row headers (§2).
- **Twin POC**: a group-aware builder partitioned on the `rowspan` group cell →
  two rectangular grids (Summer 6×5, Winter 4×5) sharing the Direction axis;
  `bilinear(Summer, 35, 22.5) = 3.5`, strictly bracketed within Summer (§3).

The probe was a throwaway `vitest` spec and is not committed; the reproduction
fixture (demo #15) reproduces the same DOM for manual/e2e verification.
