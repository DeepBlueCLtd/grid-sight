# Investigation: Twin (grouped) interpolation tables

**Branch**: `claude/twin-table-interpolation-rbbvxp`
**Created**: 2026-07-03
**Status**: Investigation / feasibility — not yet scheduled for implementation
**Trigger**: A real-world lookup table format spotted in the field — *Speed*
(rows) × *Direction* (columns) with a merged **Season** column (`Summer` /
`Winter`) grouping the speed rows into two independent blocks.

---

## 1. The format ("twin" table)

The table is really **two stacked lookup grids that share one axis**. On the
left are two label columns — a merged **Season** group column and the numeric
**Speed** column — followed by the numeric **Direction** columns:

| Season | Speed | 000° | 045° | 090° | 135° | 180° |
|--------|------:|-----:|-----:|-----:|-----:|-----:|
| **Summer** (rowspan 6) | 30 | … | … | … | … | … |
|        | 40 | … | | | | |
|        | 50 | … | | | | |
|        | 60 | … | | | | |
|        | 70 | … | | | | |
|        | 80 | … | | | | |
| **Winter** (rowspan 4) | 20 | … | … | … | … | … |
|        | 30 | … | | | | |
|        | 40 | … | | | | |
|        | 60 | … | | | | |

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

### 3.2 Interaction model (the real design question)

Two UX shapes, both buildable on the existing slider:

- **A. Season selector + shared sliders (recommended).** One extra control — a
  small segmented `Summer | Winter` selector rendered in the corner cluster —
  chooses the active block; the existing Speed (row) and Direction (col) sliders
  then bind to that block's sub-grid. Speed slider min/max **re-ranges** when the
  season changes (30–80 vs 20–60). One readout, one mental model, minimal new
  surface. This matches how a human reads the sheet: "pick the season, then read
  off speed and bearing."
- **B. Two independent slider sets.** Bind a full row+col slider pair to each
  block simultaneously (two readouts). More literal to the "twin" name but
  doubles the on-table UI and the axis-sync questions; better as a later option
  than a first cut.

Recommendation: **ship A first.** B is a superset that can be added behind the
same binding model if demand appears.

### 3.3 Where the code changes land

| Area | Change | Size |
|------|--------|------|
| `src/core/table-grid.ts` | Add group-column detection + a `rowGroups(table)` reader (label + its body rows), reusing `sourceCells`/`cellValue`. Pure DOM read. | small |
| `src/enrichments/slider-injection.ts` | Generalise `readRawAxisHeaders`/`readRawCellMatrix`/`buildAxisBinding` to take an optional row-group so the row axis skips the group column and the matrix is sliced to the group's rows. | small–medium |
| `src/enrichments/slider.ts` + `src/ui/` | Season selector control; re-range the row slider on group change; thread the active group into `refreshTable`. | medium |
| `src/utils/interpolation.ts` | **None** — `bilinear`/`linear1D` are reused verbatim. | none |
| Persistence/sync (`slider-persistence`, `sync-key`) | Add the active-group id to the per-slider key so a bookmarked position restores to the right block. | small |

No new runtime dependency; no network; the maths layer is untouched.

## 4. Constitution check (feasibility-level)

| Principle | Verdict | Note |
|-----------|---------|------|
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
