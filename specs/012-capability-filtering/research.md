# Research: Per-Page Enrichment Capability Filtering

**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md) · **Date**: 2026-05-19

This document records every decision needed to take the spec from "what" to "how"
without introducing implementation details into the spec itself. Each entry lists
the decision, the rationale, and what was considered and rejected.

---

## R-1: Identifier scheme for enrichments

**Decision**: A single flat list of lowercase, hyphen-separated string ids, exactly
the ids already used by the in-tree `LozengeSpec.id` field in `src/ui/header-utils.ts`,
plus one id per future-only enrichment from specs 002–010:

| Id | Source | Status today |
|---|---|---|
| `heatmap` | existing lozenge | shipped |
| `sliders` | existing lozenge (axis sliders, table-wide) | shipped (spec 001) |
| `slider-threshold` | existing API (no lozenge yet) | shipped (spec 001) |
| `statistics` | existing lozenge | shipped |
| `frequency` | existing lozenge | shipped |
| `frequency-chart` | existing lozenge | shipped |
| `sort` | spec 002 | spec only |
| `filter` | spec 003 | spec only |
| `outlier` | spec 004 | spec only |
| `sparkline` | spec 005 | spec only |
| `annotations` | spec 006 | spec only |
| `units-toggle` | spec 007 | spec only |
| `cumulative` | spec 008 | spec only |
| `copy-as-csv` | spec 009 | spec only |
| `diff-compare` | spec 010 | spec only |

**Rationale**: The lozenge code already names these enrichments; reusing those
names avoids a second vocabulary and lets the filter be a one-line set membership
check in `header-utils.ts`. Future-only ids are registered now so demo pages can
list them defensively (FR-007 already guarantees unknown ids are ignored, so
adding them now is harmless; adding them now means demos don't need to be edited
again when those enrichments ship).

**Note on the spec → code naming reconciliation**: The spec FR-003 lists
`slider` (singular); the code uses `sliders` (plural). The code wins because it's
the existing surface; we'll note this in the quickstart so authors copy the right
spelling. The spec is not under SemVer freeze (Development-Phase Posture) so no
backwards-compat shim is required.

**Alternatives considered**:

- **Numeric or symbolic ids** (e.g. an enum): rejected — opaque in page source,
  forces an extra lookup step for authors.
- **Namespaced ids** (e.g. `gs.heatmap`, `gs.slider.axis`): rejected — adds noise
  for no gain; the registry is already scoped to Grid-Sight.
- **Class-name reuse** (e.g. `gs-lozenge[data-gs-lozenge-id="heatmap"]`):
  considered but the ids that land in the DOM are derived from the registry
  anyway; making the registry the canonical source keeps DOM ids stable and
  testable.

---

## R-2: Where does the page-level config live?

**Decision**: Two equally-supported entry points, read once at `init()` time:

1. **IIFE / no-build path**: A `<script>` block in the page **before** the
   Grid-Sight bundle sets `window.gridSight.pageConfig = { enrichments: [...],
   showToggleUi?: boolean }`. The init code reads this immediately after the
   bundle loads. If the bundle has already loaded, the snippet still works as
   long as it runs before `window.gridSight.init()`.
2. **ESM / build-system path**: `gridSight.init({ enrichments: [...],
   showToggleUi?: boolean })`. The same option names; the same parser.

The two paths share a single normalisation routine in `src/core/page-config.ts`.

**Rationale**: The IIFE path needs to work with **no** JS knowledge beyond
copy-pasting a snippet (the project's whole pitch — drop in one script tag, edit
one HTML file). A `<meta>` tag was tempting for being even more declarative, but:
- it forces a string-encoding for the list, which authors get wrong (commas vs
  spaces vs trailing commas);
- it can't carry the boolean `showToggleUi` flag without inventing a syntax;
- existing GS surface (`window.gridSight.init`, lozenges) is all JS-driven, so
  authors already know where to look.

The ESM `init()` path mirrors what build-system consumers already do for other
options, so it costs nothing extra.

**Alternatives considered**:

- **`<meta name="gs-enrichments" content="heatmap,sliders">`**: rejected as
  primary mechanism (see above); MAY be added later as a thin wrapper if author
  feedback demands it.
- **`data-gs-enrichments` on `<body>`**: same rejection reasons.
- **Per-table override via `data-gs-enrichments` on `<table>`**: explicitly out
  of scope per the spec's "per-page not per-table" assumption. Authors who need
  per-table control already have `data-gs-ignore` and the option to split pages.
- **Reading the config inside each table's processor**: rejected — every table
  on the page reads the same config, so resolving the effective set once at
  `init()` and caching it on the registry is simpler and faster.

---

## R-3: How does the effective enabled set get resolved?

**Decision**: A pure function `resolveEnabledSet(visitorOverride, pageConfig,
registry) → Set<string>` with this precedence:

1. **Visitor toggle persisted state** (from URL fragment or localStorage), if the
   page opted in to `showToggleUi`. If the persisted state exists, it wins
   completely — it replaces the page config, not merges with it.
2. **Page config `enrichments` array**, if present. Replaces defaults entirely
   (FR-005). An empty array is honoured as "no enrichments" (edge case).
3. **Library defaults** — the union of `registry.entries.filter(e =>
   e.defaultOn).map(e => e.id)`. Today all entries are `defaultOn: true` so this
   matches the pre-feature behaviour exactly (FR-001 + FR-008).

Unknown ids in the input are silently dropped. Case-insensitive matching;
duplicates collapse. Non-string entries trigger one console warning and the
input is rejected — falling back to the next precedence tier (FR-022).

**Rationale**: A pure function is trivially unit-testable, has no DOM
dependencies, and keeps the precedence order **explicit** in one place rather
than scattered across the lozenge code. Storing the result on a module-scoped
cache (rebuilt when `init()` or the toggle panel mutates the set) keeps the
lozenge-build path branchless.

**Alternatives considered**:

- **Merge instead of replace**: rejected by spec FR-005 — too easy to get
  surprised by "but I disabled sort and it still shows up because defaults
  include it".
- **Pre-compute a boolean per id at registry-construction time**: rejected —
  the visitor can flip ids at runtime, so the set must be re-derived on each
  toggle anyway. Storing it as a `Set` once per resolve is fine.

---

## R-4: Persistence of the visitor toggle set

**Decision**: Reuse the existing per-URL-stem `localStorage` model and the URL
fragment, with a new fragment key `gs.e` (for **e**nrichments):

- URL fragment: `#gs.e=heatmap,sliders` (comma-separated ids, alphabetical for
  stable diff). Parsed alongside the existing `gs.s=` slider key.
- localStorage fallback: key `gridsight:<url-stem>:enrichments` → JSON string
  array of ids.
- On load, URL wins if present; otherwise localStorage; otherwise no visitor
  override (page config + defaults take over).
- The toggle panel writes both on every change so that the bookmark and the
  next-session-on-this-page case both work.

**Rationale**: Sliders, sort (spec 002), and other URL-encoded state already use
this dual mechanism. Reusing it means one place to read the spec for how
state outlives a reload, and zero new storage surface.

**Alternatives considered**:

- **Cookie**: rejected — irrelevant for offline / `file://` pages; also leaks to
  the host page domain unnecessarily.
- **IndexedDB**: rejected — overkill for a 14-element string list.
- **Per-table persistence**: rejected by the "per-page not per-table" scope.

---

## R-5: Runtime toggle panel — UI shape

**Decision**: An opt-in panel placed inside a host-supplied container or, if none
provided, docked top-right of the viewport. Each registered enrichment is one row:

```text
[✓] Heatmap                (heatmap)
[✓] Sliders                (sliders)
[ ] Threshold slider       (slider-threshold)
[ ] Sort                   (sort)
...
```

Construction rules:
- Single `<fieldset>` with a `<legend>` ("Grid-Sight enrichments").
- One `<label><input type="checkbox"> Label <span class="id">(id)</span></label>`
  per registered id.
- `checked` reflects the current effective enabled set.
- `change` event → update visitor-persisted set → call internal `refresh()` →
  every table on the page re-evaluates its lozenges and tears down any
  newly-disabled enrichment.
- The panel itself is keyboard-operable for free (native checkboxes + native
  fieldset focus order).

Host opt-in:
- `window.gridSight.pageConfig.showToggleUi = true` — auto-create panel and
  append to a `<div data-gs-toggle-panel>` if present, else `<body>`.
- Alternatively: an empty `<div data-gs-toggle-panel></div>` on the page is
  interpreted as opt-in even without the flag (declarative HTML-only opt-in).

**Rationale**: Native form controls are accessible by default and add almost no
bytes (vs a custom switch widget). Using the same opt-in marker (`data-gs-...`)
as elsewhere in the project keeps the surface vocabulary consistent. Panel docked
top-right by default keeps it out of the way of the tables it controls; host
authors who want a different position pre-place the container themselves.

**Alternatives considered**:

- **Inline panel above each table**: rejected — panel scope is per-page, not
  per-table; one panel suffices.
- **Floating button that expands**: rejected — extra interaction, more code,
  more accessibility surface. The fieldset is already the smallest correct UI.
- **Auto-show panel on every page**: rejected — most production pages won't
  want it; opt-in matches FR-013.

---

## R-6: Tearing down a live enrichment when toggled off

**Decision**: Each registry entry MAY declare a `tearDown(table) → void` hook.
When the effective enabled set transitions an id from "enabled" to "disabled",
the resolver calls `tearDown(table)` for every registered table.

Tearndown definitions for currently-shipped enrichments:

| Id | tearDown action |
|---|---|
| `heatmap` | call existing `removeHeatmap(table)` (no-args removes all) |
| `sliders` | call existing `removeAllSliders(table)`; this destroys all axis sliders for the table including their persistence entries |
| `slider-threshold` | iterate `getSliders(table)`, call `.destroy()` on every `kind === "threshold"` slider |
| `statistics` | dismiss `window._gsStatisticsPopup` if open |
| `frequency` | dismiss `window._gsFrequencyDialog` if open |
| `frequency-chart` | dismiss `window._gsFrequencyChartDialog` if open |

After tearDown, the lozenge cluster on every header is rebuilt via the existing
`injectPlusIcons(table, columnTypes)` path with the new effective set in force.
Toggling ON simply rebuilds; no setup hook is needed because the user has to
click the lozenge to activate the enrichment in the first place — re-enabling
restores the **availability**, not the prior **activation**.

**Rationale**: tearDown is the only direction with side effects to clean up.
Keeping it in the registry colocates each enrichment's "I exist, here's how to
dismiss me" knowledge, so adding a new enrichment in future is one registry
edit + one tearDown function.

**Alternatives considered**:

- **Universal "destroy this enrichment on this table" event** that each
  enrichment subscribes to: rejected — over-abstracted for 6 hand-counted cases;
  tearDown functions are trivially traceable in code.
- **Don't tear down — just hide the lozenge**: rejected — FR-015 specifically
  requires that the active instance is cleaned up (no orphan DOM, no stuck
  overlays); a visitor toggling off "sliders" while a slider is on screen
  needs the slider to disappear, not just its launcher.

---

## R-7: Bundle budget breakdown

**Decision**: Target ≤ 0.7 KB gzipped for the whole feature, well under the SC-007
ceiling of 1 KB and within constitution §I's 10 KB total bundle ceiling.

Estimated gzipped contributions:

| Module | Estimate |
|---|---|
| `core/enrichment-registry.ts` (data only, 14 entries) | ~0.15 KB |
| `core/page-config.ts` (parser + normaliser) | ~0.12 KB |
| `core/effective-enabled-set.ts` (resolver) | ~0.08 KB |
| `utils/enrichment-persistence.ts` (URL + localStorage) | ~0.10 KB |
| `ui/toggle-panel.ts` (DOM + change handler) | ~0.20 KB |
| Filter hooks in `ui/header-utils.ts` + `ui/enrichment-menu.ts` | ~0.05 KB |
| **Total** | **~0.70 KB** |

**Rationale**: Native checkboxes carry zero bytes (browser-supplied); the
registry is a single literal; the resolver is one function. Most of the cost is
the panel's DOM-creation code.

**Mitigations if budget is exceeded**:

- Compress the registry from object literals to two parallel arrays (ids, labels,
  defaultOn bitmask).
- Inline `effective-enabled-set` into `page-config` (saves one function boundary).
- Make the panel module lazily-imported in ESM consumers (no gain for IIFE, but
  some for build-system consumers).

---

## R-8: Demo subset choices

**Decision**: Each existing demo page declares an explicit `enrichments` list
that matches the enrichments its narrative exercises, per `specs/011-demo-pages/`.
The new live-toggle demo declares the full set and opts in to the panel.

Initial subsets (the registry-friendly ids in each):

| Demo page | Subset |
|---|---|
| `public/demo/sliders/interpolation.html` | `heatmap`, `sliders`, `statistics` |
| `public/demo/sliders/alternate-calc-models.html` | `sliders`, `statistics` |
| `public/demo/sliders/synced-tables.html` | `sliders` |
| `public/demo/sliders/heatmap.html` | `heatmap`, `sliders`, `slider-threshold` |
| `public/demo/real-world/atmosphere.html` (spec 011) | `heatmap`, `sliders`, `statistics` |
| `public/demo/mixed/categorical-and-numeric.html` (spec 011) | `heatmap`, `sliders`, `statistics`, `sort`, `filter`, `frequency`, `frequency-chart` |
| `public/demo/before-after/*.html` (spec 011) | full default set (the demo's whole point is "here's what GS adds") |
| `public/demo/retrofit/*.html` (spec 011) | `heatmap`, `statistics` (minimal, to look unobtrusive) |
| `public/demo/toggle/live-enrichments.html` (NEW) | full set + `showToggleUi: true` |

**Rationale**: Each subset is the smallest set that still tells the demo's story.
The exact subsets are recorded here so reviewers can match them against the demo
acceptance criteria in story 3 of the spec.

**Alternatives considered**:

- **Move every demo to the full default set**: rejected — defeats the purpose of
  the feature.
- **Leave existing demos un-configured and only configure the new demo**:
  rejected — fails FR-019 (every demo must declare an explicit set so future
  enrichments don't auto-appear).

---

## R-9: Accessibility specifics for the toggle panel

**Decision**:

- The panel uses one `<fieldset>` with `<legend>` so screen readers announce its
  scope.
- Each checkbox is wrapped in a `<label>` element (clickable label text included
  in the focusable area).
- Tab order is sequential top-to-bottom, matching the registry's display order
  (today: heatmap, sliders, slider-threshold, statistics, frequency,
  frequency-chart, then alphabetised future ids).
- Space and Enter both toggle the focused checkbox (native browser behaviour).
- No `aria-live` region is needed: the visible result of toggling (lozenge
  appears / disappears) is itself an announcement of state for sighted users;
  for AT users the checkbox itself announces its new state.
- Focus is preserved on the checkbox after toggle (the panel is not re-rendered
  whole — only the targeted control's `checked` is updated and the side effect
  runs on the table side).

**Rationale**: Native form controls satisfy constitution §III's hard minimums
without custom ARIA. Keeping the panel persistent (not re-rendered on every
change) avoids focus loss.

**Alternatives considered**:

- **Custom switch role** (`role="switch"` on a button): rejected — same
  affordance as a checkbox at higher complexity cost, and checkboxes are the
  semantically correct control for a multi-toggle list.
- **`aria-live` announcement of "Heatmap enabled / disabled"**: rejected as
  noisy; AT already announces the checkbox state change.

---

## Open questions resolved during research

- **"Does the registry need to know default-off entries?"** Yes — FR-002 says
  the default-on/off choice is explicit per entry. Today every entry is
  `defaultOn: true`, but the registry field exists from day one so future
  experimental enrichments can ship default-off without a schema change.
- **"Should the runtime panel honour `data-gs-ignore` tables?"** Yes —
  `data-gs-ignore` is upstream of every Grid-Sight effect including the panel's
  refresh loop. Confirmed in FR + Edge Cases.
- **"What does the panel do for unrecognised ids in the persisted set?"**
  Drops them silently on read (FR-007 applies to all input sources, including
  storage that may have been written by a previous build that registered ids
  this build no longer knows about).

---

**Status**: All NEEDS CLARIFICATION resolved. Phase 0 complete; Phase 1 may proceed.
