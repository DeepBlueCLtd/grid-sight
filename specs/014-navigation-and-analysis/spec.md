# Feature Specification: Large-Table Navigation & Analysis (Tier 1)

**Feature Branch**: `014-navigation-and-analysis`
**Created**: 2026-05-28
**Status**: Draft
**Input**: User description: "Add the four Tier-1 capabilities identified in capability-research.md — frozen header/key column, per-column EDA profile, column summary row, and find-in-table — each matching the existing enrichment model (registry, on/off toggling, demo page)."

This feature adds four independent, individually-toggleable enrichments that
help analysts and scientists navigate and exploit large tables. They were
selected in [`../../capability-research.md`](../../capability-research.md) as the
highest value-per-byte additions that fit Grid-Sight's read-only,
offline-first, progressive-enhancement posture. Each is its own enrichment with
its own registry id, so it can ship, be demoed, and be toggled independently;
they compose with each other and with every existing enrichment.

The four new enrichment ids introduced here are:

| Story | Enrichment id | Label | Scope |
|-------|---------------|-------|-------|
| US1 (P1) | `freeze-panes` | "Freeze panes" | Table-level |
| US2 (P2) | `column-profile` | "Column profile" | Column-level lozenge |
| US3 (P3) | `summary-row` | "Summary row" | Table/column-level |
| US4 (P4) | `find-in-table` | "Find in table" | Table-level |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Frozen header row & key column while scrolling (Priority: P1)

A scientist opens a page containing a 600-row, 30-column results table inside a
scrollable region. As soon as they scroll down, the column headers stay pinned
to the top of the table's scroll area, and as they scroll right, the first
(label/key) column stays pinned to the left. They never lose track of which
metric a value belongs to or which specimen a row describes. A table-level
"Freeze panes" lozenge (suggested glyph **❄** or **⇲**) in the corner cluster
turns the behaviour on and off; when off, the table reverts to byte-identical
unfrozen scrolling.

**Why this priority**: Orientation in a large table is the most common pain and
the cheapest, highest-leverage win — it is mostly sticky positioning over cells
the table-grid addressing layer already identifies. It delivers value the moment
a single tall/wide table is on the page, with no dependency on the other three
stories.

**Independent Test**: Open a page with one tall, wide table in a scroll
container, enable `freeze-panes`, scroll down and right, and confirm the header
row and the first data column remain visible and aligned with their cells.
Disable it and confirm the DOM returns to its pre-enrichment state.

**Acceptance Scenarios**:

1. **Given** a table taller than its scroll viewport with `freeze-panes` active,
   **When** the user scrolls vertically, **Then** the header row(s) remain
   visible at the top of the scroll area and stay horizontally aligned with the
   columns beneath them.
2. **Given** a table wider than its scroll viewport with `freeze-panes` active,
   **When** the user scrolls horizontally, **Then** the first column (the key /
   row-label column as resolved by the addressing layer) remains visible at the
   left and stays vertically aligned with its rows.
3. **Given** both header and key column are frozen, **When** the user scrolls
   diagonally, **Then** the top-left corner cell remains pinned and never
   overlaps or detaches from the data region.
4. **Given** `freeze-panes` is disabled via the runtime toggle panel, **When**
   teardown completes, **Then** the table DOM is byte-identical to its
   pre-enrichment state (no leftover classes, inline styles, or attributes), and
   re-enabling restores freezing without a page reload.
5. **Given** a table with no distinct scroll region (it is shorter/narrower than
   the viewport), **When** `freeze-panes` is active, **Then** the table renders
   identically to the unfrozen table (freezing is a no-op until scrolling is
   possible) and the lozenge still reflects its on/off state.

---

### User Story 2 - Per-column profile / quick EDA (Priority: P2)

An analyst evaluating an unfamiliar dataset wants a fast read on a single column
before trusting it. They click a column-level "Column profile" lozenge
(suggested glyph **▥** or **∿**) on a numeric column header. A popover shows:
count of values, count and percentage of missing/blank cells, number of distinct
values, and — for numeric columns — minimum, first quartile (Q1), median, third
quartile (Q3), maximum, mean, and standard deviation, plus a compact mini
histogram of the distribution. On a categorical column, the popover instead
shows the count, missing %, distinct count, and the top values by frequency
(reusing the existing frequency machinery). All figures are computed over the
currently **visible** rows so the profile reflects any active filter/sort.

**Why this priority**: This is the feature scientists value most for "do I
believe this column?" exploratory work, and it extends the existing statistics
popup, frequency code, and numeric detector rather than introducing new
infrastructure. It is independent of the other stories.

**Independent Test**: Open a page with a numeric column containing some blank
cells, click the column-profile lozenge, and confirm the popover reports the
correct count, missing %, distinct count, quartiles, mean/σ, and a histogram.
Apply a filter that hides some rows and reopen the popover; confirm the figures
recompute over only the visible rows.

**Acceptance Scenarios**:

1. **Given** a numeric column with known values and some blanks, **When** the
   user opens its profile, **Then** the popover shows count, missing count and
   percentage, distinct count, min/Q1/median/Q3/max, mean, and standard
   deviation, each matching a hand-computed reference, and a mini histogram of
   the distribution.
2. **Given** a categorical column, **When** the user opens its profile, **Then**
   the popover shows count, missing %, distinct count, and the most frequent
   values with their counts (no quartiles/histogram).
3. **Given** an active filter hides half the rows, **When** the user opens (or
   reopens) the profile, **Then** every figure is computed over only the visible
   rows.
4. **Given** the profile popover is open, **When** the user presses Escape or
   clicks outside, **Then** the popover closes and focus returns to the lozenge;
   no profile state persists in the DOM after close.
5. **Given** `column-profile` is disabled via the toggle panel, **When**
   teardown completes, **Then** the lozenge is removed and the table DOM is
   byte-identical to its pre-enrichment state.

---

### User Story 3 - Column summary / footer row over visible rows (Priority: P3)

An analyst who has filtered a table to the rows of interest wants the totals at a
glance. With the "Summary row" enrichment active, a summary footer appears
beneath the table body showing a per-column aggregate for each numeric column.
Each summary cell offers a small control to choose the aggregate for that column
(sum, average, min, max, count). The summary always reflects the **currently
visible** rows, recomputing live as sort and filter change the visible set.
Non-numeric columns show a count (or blank) rather than a numeric aggregate.

**Why this priority**: Footer aggregates are an everyday analyst staple and slot
directly into the existing visible-rows pipeline, so correctness under
filter/sort is mostly inherited. It is valuable on its own but ranks below
orientation (US1) and single-column EDA (US2).

**Independent Test**: Open a page with a numeric column, enable `summary-row`,
and confirm a footer cell shows the correct sum over all visible rows. Switch
that column's aggregate to average and confirm the value updates. Apply a filter
and confirm the footer recomputes over only the visible rows.

**Acceptance Scenarios**:

1. **Given** a numeric column and `summary-row` active, **When** the table
   renders, **Then** a summary footer cell shows the chosen aggregate (default
   sum) over all currently visible rows, matching a hand-computed reference.
2. **Given** the summary footer is showing a sum, **When** the user selects
   "average" for that column, **Then** the cell updates to the mean of the
   visible values, and the choice persists across reload via the standard
   per-page state scheme.
3. **Given** an active filter changes which rows are visible, **When** the
   filter is applied or cleared, **Then** every summary cell recomputes over the
   new visible set without a page reload.
4. **Given** a column contains non-numeric / blank cells, **When** the aggregate
   is sum/average/min/max, **Then** those cells are excluded from the
   computation (consistent with existing statistics behaviour) and the count
   aggregate counts only non-blank cells.
5. **Given** `summary-row` is disabled via the toggle panel, **When** teardown
   completes, **Then** the footer is removed and the table DOM is byte-identical
   to its pre-enrichment state; re-enabling restores the footer (and the
   per-column aggregate choices) without a reload.

---

### User Story 4 - Find within a table with highlight & jump (Priority: P4)

A user faced with a dense table wants to locate every occurrence of a term
without reading every cell. A table-level "Find in table" lozenge (suggested
glyph **🔍** or **⌕**) opens a small search box. As they type, every matching
cell is visually highlighted, a match counter shows "3 of 17", and Enter /
Next / Previous controls scroll the table to and visually emphasise the current
match. Clearing the search removes all highlighting. Matching is over the
canonical cell text (injected UI stripped) of the currently visible rows.

**Why this priority**: A strong orientation aid for wide/tall tables, and the
addressing layer already maps a matched cell to a logical coordinate to scroll
to. It is ranked last of the four only because US1–US3 deliver broader everyday
value; it remains fully independent.

**Independent Test**: Open a page with a table containing a repeated term, enable
`find-in-table`, type the term, and confirm all occurrences highlight and the
counter is correct. Press Next repeatedly and confirm the current match cycles
through every occurrence and the table scrolls each into view. Clear the box and
confirm all highlighting is removed.

**Acceptance Scenarios**:

1. **Given** a table and an open find box, **When** the user types a term,
   **Then** every visible cell whose canonical text contains the term is
   highlighted and the counter shows the total number of matches.
2. **Given** matches exist, **When** the user presses Next (or Enter)
   repeatedly, **Then** the "current" match advances through every occurrence in
   document order, wraps at the end, scrolls each match into view, and visually
   distinguishes the current match from the others; Previous moves backwards.
3. **Given** an active filter hides some rows, **When** the user searches,
   **Then** only cells in visible rows are matched and counted.
4. **Given** matches are highlighted, **When** the user clears the box or closes
   the find UI, **Then** all highlighting is removed and the table DOM is
   byte-identical to its pre-find state.
5. **Given** `find-in-table` is disabled via the toggle panel, **When** teardown
   completes, **Then** the lozenge and any highlighting/search UI are removed and
   the table DOM is byte-identical to its pre-enrichment state.

---

### Edge Cases

- **Merged cells (rowspan/colspan).** Freezing, profiling, summary, and find all
  read through the table-grid addressing layer; a spanned cell is attributed to
  its source logical position and is not double-counted.
- **Scaffolding & virtual columns.** Injected scaffolding cells
  (`data-gs-injected`) are never frozen, profiled, summed, or matched; virtual
  columns (`data-gs-virtual-column`) are real addressable columns and ARE
  eligible for profile/summary/find unless their source enrichment opts out.
- **No numeric columns.** `column-profile` still works on categorical columns;
  `summary-row` shows count-only footers and no numeric aggregates.
- **All rows filtered out.** Profile and summary show an explicit empty state
  (zero count) rather than `NaN`/blank; find reports "0 matches".
- **Table not in a scroll container.** Freezing degrades to a no-op (US1 #5).
- **Composition order.** Enabling/disabling these in any order, and combining
  with sort/filter/sliders/virtual columns, yields the same result (the
  cross-enrichment invariant from spec 013).
- **Grid-Sight globally disabled.** None of the four render any affordance or
  DOM while Grid-Sight is off (the spec-012 lesson: gate on the enabled set, not
  only page-init).

## Requirements *(mandatory)*

### Functional Requirements — per feature

- **FR-001** (`freeze-panes`): The system MUST keep the header row(s) visible at
  the top of the table's scroll area while the user scrolls vertically.
- **FR-002** (`freeze-panes`): The system MUST keep the key column (first
  logical column per the addressing layer) visible at the left while the user
  scrolls horizontally, with the top-left corner pinned when both are active.
- **FR-003** (`freeze-panes`): Freezing MUST be a no-op when the table has no
  scrollable overflow, and MUST not alter computed row/column alignment.
- **FR-004** (`column-profile`): Users MUST be able to open a per-column profile
  showing count, missing count + %, and distinct count for any column.
- **FR-005** (`column-profile`): For numeric columns the profile MUST additionally
  show min, Q1, median, Q3, max, mean, standard deviation, and a mini histogram;
  for categorical columns it MUST show top values by frequency.
- **FR-006** (`column-profile`): All profile figures MUST be computed over the
  currently visible rows and recompute when the visible set changes.
- **FR-007** (`summary-row`): The system MUST render a summary footer with a
  per-numeric-column aggregate computed over the currently visible rows.
- **FR-008** (`summary-row`): Users MUST be able to choose the aggregate per
  column from at least {sum, average, min, max, count}; numeric aggregates MUST
  exclude non-numeric/blank cells.
- **FR-009** (`summary-row`): The summary MUST recompute live on sort/filter
  changes without a page reload.
- **FR-010** (`find-in-table`): Users MUST be able to search the table; all
  matching visible cells MUST be highlighted and a match count shown.
- **FR-011** (`find-in-table`): Users MUST be able to step Next/Previous through
  matches with wrap-around, scrolling the current match into view and visually
  distinguishing it; clearing the search MUST remove all highlighting.
- **FR-012** (all): Matching/reading of cell text MUST use the canonical cell
  text reader (injected UI stripped) and the table-grid addressing layer; none
  of the four may double-count merged cells or include scaffolding cells.

### Functional Requirements — enrichment-model integration (cross-cutting)

These ensure the four features match the existing enrichment model. Each maps to
the checklist in [`docs/adding-an-enrichment.md`](../../docs/adding-an-enrichment.md).

- **FR-013** (Registry): Each feature MUST add one entry to
  `src/core/enrichment-registry.ts` with a unique lower-case-hyphen `id`
  (`freeze-panes`, `column-profile`, `summary-row`, `find-in-table`), a `label`,
  and `defaultOn`, and MUST set `shipped: true` in the PR that ships it.
- **FR-014** (Toggling on/off): Each feature MUST be independently toggleable via
  the spec-012 runtime toggle panel and via page-level
  `pageConfig.enrichments`. Disabling MUST run a `tearDown(table)` that restores
  **byte-identical** DOM; the **off → on round-trip MUST fully restore the
  feature without a page reload** (auto-rendered state — frozen styling, footer,
  per-column aggregate choices — MUST be restored via an `apply` hook, not only
  on a fresh click).
- **FR-015** (Global gate): No feature may render any lozenge, footer, frozen
  styling, or highlight while Grid-Sight is globally disabled or while its id is
  not in the effective enabled set — gated at apply time, not only at page init.
- **FR-016** (No id drift): The new ids MUST be reconciled across every
  capability surface (registry, any `+`-menu items list if used, and all demo
  `pageConfig.enrichments` arrays including the landing page) so "which
  enrichments exist" does not diverge across files.
- **FR-017** (Persistence): Any stored choice (e.g. per-column summary aggregate,
  last freeze state) MUST reuse the `gs:` per-URL-stem scheme with a distinct
  suffix, wrap `localStorage` in try/catch (degrade to session-only with one
  warning, never throw), use a versioned envelope, and make **no network calls**
  (works from `file://` and offline).
- **FR-018** (Accessibility): Every affordance MUST be keyboard-operable end to
  end (Tab/Enter/Space/Escape), expose accessible names/ARIA (removed on
  teardown without clobbering author `aria-*`), manage focus for popups via the
  shared popup chrome, and rely on **more than colour alone** for every signal
  (frozen edge, current find match, summary emphasis), verified in a monochrome
  simulation.
- **FR-019** (Bundle budget): The combined gzipped IIFE delta for all four
  features MUST stay within the constitutional budget, measured incrementally;
  any ceiling change MUST be recorded per the constitution and called out in the
  PR.

### Demo & documentation requirements

- **FR-020** (Demo pages): Each feature MUST ship a dedicated demo page under
  `public/demo/<feature>/index.html` showcasing it on a **realistic, large**
  table (US-relevant: e.g. a tall/wide scientific results table for
  `freeze-panes`, a column with missing values and a skewed distribution for
  `column-profile`, a filterable financial/measurement table for `summary-row`,
  and a dense lookup table for `find-in-table`), with brief instructions, a nav
  bar consistent with existing demos, and a `pageConfig.enrichments` that
  includes the feature's id. A demo card linking each page MUST be added to the
  landing page `public/index.html`. Each demo MUST be smoke-tested in a real
  browser.
- **FR-021** (Docs): The `docs/adding-an-enrichment.md` checklist MUST be pasted
  into the PR for each feature with every item ticked or marked `N/A`; quickstart
  / spec docs updated if behaviour diverges from the plan.

### Key Entities

- **Column profile**: a derived, transient summary of one column over the visible
  rows — {count, missing, distinct} plus, for numeric, {min, Q1, median, Q3, max,
  mean, σ, histogram bins}. Not persisted; recomputed on open.
- **Summary aggregate selection**: a per-(table, column) choice of aggregate
  function; persisted per page via the `gs:` scheme.
- **Find query state**: a transient search term, the ordered list of matched
  logical cells, and the current-match index. Not persisted.
- **Freeze state**: whether `freeze-panes` is active for a table (and which
  panes); derived from the enabled set, not a separate persisted entity beyond
  the enrichment toggle itself.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 600×30 table in a scroll container, a user can scroll to any
  cell and still see both its column header and its row's key column, with no
  misalignment between frozen and scrolling regions.
- **SC-002**: For any numeric column, the profile's count, missing %, distinct
  count, min/Q1/median/Q3/max, mean, and σ match an independent reference within
  display precision, computed over the visible rows.
- **SC-003**: After any filter/sort change, the summary footer and any open
  profile reflect the new visible row set within one animation frame, with no
  reload.
- **SC-004**: Find highlights 100% of matching visible cells, the counter equals
  the true match count, and Next/Previous reaches every match with wrap-around.
- **SC-005**: For each of the four enrichments, the **disable → enable**
  round-trip via the toggle panel restores the feature without a reload, and the
  disabled-state DOM is byte-identical to the pre-enrichment DOM (no leftover
  nodes/classes/attributes).
- **SC-006**: With Grid-Sight globally disabled, none of the four produce any
  DOM, lozenge, footer, frozen styling, or highlight.
- **SC-007**: Each feature has a dedicated demo page reachable from the landing
  page whose golden path works in a real browser, and the combined bundle delta
  stays within the recorded budget.
- **SC-008**: Full unit + Storybook + Playwright suites are green, including a
  test asserting the new shipped-enrichment ids/count and the demo
  `pageConfig.enrichments` subset relationship (drift fails CI).

## Assumptions

- The four features are delivered as **four independent enrichments**, each its
  own registry id and demo, so any subset can ship in priority order (P1→P4)
  while still being individually testable and toggleable. They are grouped in
  one spec because they share the "navigate/exploit a large table" goal and the
  same integration surfaces.
- The existing table-grid addressing layer (spec 013), visible-rows pipeline,
  numeric/categorical detector, statistics, frequency, and `gs:` persistence
  scheme are reused; no new runtime dependency is introduced.
- Freezing relies on the author (or Grid-Sight) placing the table in a scrollable
  region; `freeze-panes` does not itself create page-level scroll behaviour for a
  table that the author intends to render at full height.
- Histogram binning for `column-profile` uses a reasonable default bin count;
  exact binning strategy is a design (plan) decision, not a spec constraint.
- Glyphs suggested for each lozenge are indicative; final glyphs are a UI design
  decision consistent with the existing lozenge cluster.
- These additions remain within Grid-Sight's read-only posture: no source cell is
  mutated, no data is fetched, everything works offline and from `file://`.
