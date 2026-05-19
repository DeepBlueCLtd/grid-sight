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
`slider` (singular); the lozenge code (`src/ui/header-utils.ts`) uses `sliders`
(plural). The code wins because it's the existing surface; we'll note this in
the quickstart so authors copy the right spelling. The spec is not under SemVer
freeze (Development-Phase Posture) so no backwards-compat shim is required.

See **R-1.1** below for the second naming clash uncovered during review — the
parallel `EnrichmentType` vocabulary in `src/ui/enrichment-menu.ts`.

---

## R-1.1: Reconciling `EnrichmentType` in `src/ui/enrichment-menu.ts` (review fix 2A)

**Decision**: Rename the ids in the `EnrichmentType` union and the matching
`ENRICHMENT_ITEMS` entries so that there is exactly one identifier vocabulary
shared by:

- `src/ui/header-utils.ts` `LozengeSpec.id`
- `src/ui/enrichment-menu.ts` `EnrichmentType`
- The new `src/core/enrichment-registry.ts`

Mapping:

| Old id (menu)        | New id (registry-aligned) | Notes |
|----------------------|---------------------------|-------|
| `slider`             | `sliders`                 | Matches `header-utils.ts` and registry. |
| `threshold-slider`   | `slider-threshold`        | Matches `data-gs-slider-axis="threshold"` and registry. |
| `toggle-sliders`     | `sliders` (collapsed)     | Logical duplicate of per-axis `sliders`; one menu predicate covers both axes. |
| `zscore`             | (removed)                 | No handler in code, no demo, no spec. Treated as dead code; deletion documented. |
| `aggregate`          | (removed)                 | Same as `zscore`. If revived later, re-add to the registry first. |

Registry ids `heatmap`, `statistics`, `frequency`, `frequency-chart`, `sort`,
`filter` are already shared with `EnrichmentType` and need no rename.

**Rationale**: Without this rename, the plan's "MODIFIED — filter menu items by
effective enabled set" step in `src/ui/enrichment-menu.ts` would silently drop
every slider-family menu item because the registry doesn't recognise `slider` /
`threshold-slider` / `toggle-sliders`. That breaks FR-010 (disabled enrichments
absent from menus) in the inverse direction — *enabled* enrichments would also
disappear. Aligning ids is the only way the single set-membership filter works
correctly on both call sites.

**Backlog item raised**: `zscore` and `aggregate` are deleted on the assumption
that they are dead code; the BACKLOG.md entry "investigate `zscore`/`aggregate`
in `enrichment-menu.ts`" records the call so it can be reversed if either turns
out to be planned future work.

**Alternatives considered**:

- **Translation layer** (menu-id → registry-id map): rejected — extra layer to
  maintain, easy to drift, TypeScript can't enforce coverage.
- **Use menu ids in the registry instead** (rename `sliders` → `slider`): rejected
  — would also force a rename of the shipped `data-gs-lozenge-id="sliders"` DOM
  attribute and the `header-utils.ts` `LozengeSpec.id` literal type. More
  surface area to change for the same end state.

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

## R-4: Persistence of the visitor toggle set (revised, review fix 1A)

**Decision**: Reuse `src/utils/slider-persistence.ts` literally — not by copying
its idioms into a new module, but by refactoring its existing helpers to be
parameterised by the URL fragment key and storage-key suffix, then calling
them from the enrichment-persistence path. Concretely:

1. **Refactor `src/utils/slider-persistence.ts`** to expose a small generic
   layer:
   - Extract `urlStem()`, `readFromUrl(key, hash?)`, `writeUrlHash(key, entries, hash?)`,
     `readFromStorage(suffix, stem?)`, `writeToStorage(suffix, payload, stem?)` as
     reusable building blocks. Existing slider call sites pass `'gs.s'` /
     `'sliders'` and remain byte-identical in behaviour.
   - Keep the existing `PersistedState` versioned wrapper
     (`{ version: 1, entries: ... }`) as the storage payload shape. Sliders
     use `entries: Record<string, number>`; the enrichments use
     `entries: string[]` (the id list). Both are valid JSON values of the
     `entries` field; `isValidPersistedState` widens to accept either.
2. **Storage key**: `gs:<stem>:enrichments` (NOT `gridsight:...` — the existing
   slider precedent is `gs:<stem>:sliders`, so the prefix is `gs:`).
3. **URL fragment key**: `gs.e=heatmap,sliders` (comma-separated ids,
   alphabetical for stable diff). Parsed alongside the existing `gs.s=` slider
   key by the same `readFromUrl(key)` helper; values are URL-decoded by the
   existing path.
4. **Payload shape on disk**:
   ```json
   { "version": 1, "entries": ["heatmap","sliders","statistics"] }
   ```
   `version: 1` initially; bumped if the shape ever needs to change. Unrecognised
   versions cause a fall-back to defaults rather than a throw (mirrors slider
   precedent).
5. **Load precedence on init**: URL fragment > localStorage > undefined
   (page config + defaults then take over). Identical to the slider precedent.

**Rationale**: This is the difference between "we use the same model" (the
original wording, which left two parallel implementations) and "we share the
helpers" (this revision). The latter satisfies DRY and Principle I (one
implementation to fit through the bundle budget) and ensures that a future
fix to the persistence layer fixes both feature surfaces at once.

**Alternatives considered**:

- **Parallel `utils/enrichment-persistence.ts`** that copies the slider idioms:
  rejected — silently invites divergence (different versioning, different key
  prefix, different malformed-input policy). Caught by review issue 1.
- **Cookie**: rejected — irrelevant for offline / `file://` pages; also leaks
  to the host page domain unnecessarily.
- **IndexedDB**: rejected — overkill for a 15-element string list.
- **Per-table persistence**: rejected by the "per-page not per-table" scope.

**Tests added by this revision**: the slider-persistence refactor is covered by
the existing `src/utils/__tests__/slider-persistence.test.ts` (which moves to
exercise the generic helpers via the existing call sites). One new unit test
file `src/utils/__tests__/slider-persistence.enrichments.test.ts` covers the
`gs.e` + `entries: string[]` round-trip path. No new module file is created.

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

**Container resilience (review failure-mode guard)**: before each panel refresh
(after `onCheckboxChange`), the panel checks `this.root.isConnected`. If the
host has removed the `[data-gs-toggle-panel]` container (or its descendant
`[data-gs-toggle-panel-root]`) from the document — a realistic SPA failure
mode — the panel detaches every listener it owns and stops refreshing. It does
**not** attempt to remount; the host has explicitly removed the surface, and
re-attaching could clobber whatever replaced it. A single console warning is
emitted (`[gridsight] toggle panel container detached; panel disabled until
next init()`).

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

**Safety wrap (review failure-mode guard)**: every `tearDown(table)` call from
the runtime refresh path is wrapped in `try { tearDown(table); } catch (e) {
console.warn('[gridsight] tearDown(' + id + ') threw; continuing', e); }`. A
buggy tearDown in a third-party-registered enrichment (future use case)
therefore degrades to a console warning, not a broken page where every
subsequent toggle stalls. Data-model still mandates "MUST NOT throw" — the
guard is defence-in-depth, not licence to throw.

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

## R-7: Bundle budget breakdown (revised after review)

**Decision**: Target ≤ 0.9 KB gzipped for the whole feature, under the SC-007
ceiling of 1 KB and within constitution §I's 10 KB total bundle ceiling.
Estimate revised upward from 0.7 KB after the panel's actual surface area was
audited during review.

Estimated gzipped contributions:

| Module | Estimate |
|---|---|
| `core/enrichment-registry.ts` (data only, 15 entries) | ~0.15 KB |
| `core/page-config.ts` (parser + normaliser) | ~0.12 KB |
| `core/effective-enabled-set.ts` (resolver) | ~0.08 KB |
| `core/column-types-cache.ts` (WeakMap helper, review fix 4A) | ~0.04 KB |
| Refactor of `utils/slider-persistence.ts` (parameterise key/suffix) + enrichment-specific glue | ~0.05 KB |
| `ui/toggle-panel.ts` (DOM + change handler + container.isConnected guard + tearDown try/catch) | ~0.40 KB |
| Filter hooks in `ui/header-utils.ts` + `ui/enrichment-menu.ts` | ~0.05 KB |
| **Total** | **~0.89 KB** |

**Rationale**: Native checkboxes carry zero bytes (browser-supplied); the
registry is a single literal; the resolver is one function. The panel revised
upward from 0.2 → 0.4 KB after counting: fieldset/legend/label scaffolding,
~15 checkbox rows wired to listeners, the change handler with persistence
write, the diff between old/new effective set, the per-table refresh loop,
the container-resilience guard, and the tearDown try/catch wrap. Sharing the
persistence helpers (review fix 1A) saves ~0.05 KB vs the parallel module
originally planned.

**Mitigations if measured delta exceeds budget**:

- Compress the registry from object literals to two parallel arrays (ids, labels,
  defaultOn bitmask). Buys ~0.05 KB.
- Inline `effective-enabled-set` into `page-config` (saves one function boundary).
  Buys ~0.02 KB.
- Make the panel module lazily-imported in ESM consumers (no gain for IIFE, but
  some for build-system consumers).
- Inline the column-types-cache into `core/table-processor` if the standalone
  module's bytes outweigh its testability benefit.

**Measurement**: see R-11 for how the bundle ceiling is enforced at build
time.

---

## R-10: Column-types cache to keep toggle latency under one frame (review fix 4A)

**Decision**: Introduce `src/core/column-types-cache.ts` exporting a
module-scoped `WeakMap<HTMLTableElement, ColumnType[]>` plus three thin
helpers:

```ts
function getColumnTypes(table: HTMLTableElement): ColumnType[];
function setColumnTypes(table: HTMLTableElement, types: ColumnType[]): void;
function clearColumnTypes(table: HTMLTableElement): void;
```

`processTable` (the only function that legitimately changes a table's
detected column types) calls `setColumnTypes` after running
`detectColumnTypes`. `injectPlusIcons` on the runtime refresh path calls
`getColumnTypes` instead of re-running `inferHeaderColumnType` per header.
`clearColumnTypes(table)` is called from `disable()` so a re-init starts
fresh.

**Rationale**: Without the cache, every checkbox flip triggers a full
column-type re-walk of every table on the page (R-6's `injectPlusIcons` path
ends in `inferHeaderColumnType` which `cleanNumericCell`-walks the body
cells). On a 10-table page averaging 25 headers, that's ~250 re-walks per
toggle, plus the same `cleanNumericCell` work the original `processTable`
already did. With the cache, the refresh path becomes "remove old lozenges,
re-add filtered lozenges using cached types" — pure DOM work, bounded by the
number of headers, not by cell count.

A `WeakMap` is correct here because the table element's lifetime is the
authoritative anchor for cache validity — when the host removes the table
from the DOM and drops references, the cache entry is collected automatically.
No manual eviction beyond `disable()` is required.

**Tests added**:

- `src/core/__tests__/column-types-cache.test.ts` — set/get/clear and WeakMap
  semantics (verify identity behaviour, not GC timing).
- `src/ui/__tests__/header-utils.refresh.test.ts` — assert that a synthesised
  refresh path calls `getColumnTypes` (spy) without invoking
  `inferHeaderColumnType` for already-known tables.

**Alternatives considered**:

- **Cache on the table element itself** (`table._gsColumnTypes`): rejected —
  mutates host DOM, harder to unit-test, leaks into the DOM contract.
- **Recompute lazily inside `inferHeaderColumnType`** with an instance check:
  rejected — keeps the per-header overhead, only saves the cleanNumericCell
  walk; the simpler full-table cache is both cheaper and more predictable.
- **Do nothing** (Issue 4C in review): rejected — already measured 250
  re-walks per toggle on a realistic demo size; SC-004's one-frame budget is
  not credible without it.

---

## R-11: Bundle-size enforcement — reconcile constitution and existing script

**Discovery**: `scripts/bundle-size.js` (wired into the `yarn build` pipeline
via `package.json`) was previously hardened to fail builds above 10 KB
gzipped but is currently **informational only** — its leading comment reads
"Bundle size is informational only — Grid-Sight typically runs on a LAN or
locally on a PC, so the bundle ceiling has been relaxed." This is in tension
with constitution v1.1.0 §I and §Performance & Distribution Constraints,
both of which still mandate the 10 KB gzipped ceiling and that increases
above it "MUST be rejected or accompanied by an explicit budget-raise
amendment to this constitution."

**Decision for this feature's implementation**: re-enable enforcement in
`scripts/bundle-size.js`. Specifically:

- Replace the "informational only" comment with a one-paragraph
  justification block citing constitution §I.
- After computing `gzKB`, compare against a constant `MAX_GZ_KB = 10` and
  `process.exit(1)` with a clear message if exceeded.
- Add a `--soft` flag that preserves the existing warn-only behaviour for
  pre-PR local builds where the author wants the number but not the fail.
- Do not invent a new script (`scripts/check-bundle-size.mjs` from the
  review's option 3A wording) — the existing `bundle-size.js` already runs
  in the right place. Editing it is the minimal diff.

**Open question for /speckit-tasks or implementation**: if the current
bundle is already above 10 KB at the moment enforcement is re-enabled, the
correct response is **not** to weaken the threshold silently — it is to
either land a bundle-cut PR first or amend the constitution with a recorded
budget-raise. The task that flips enforcement on MUST measure the current
size and pick one of those two paths before merging.

**Rationale**: 3A in the review explicitly committed to "scripts/check-bundle-size.mjs
invoked by yarn build, failing >10 KB gzipped." The existing
`scripts/bundle-size.js` is the path already wired in; re-enabling it
fulfils the same goal with one fewer file. The "relaxed" comment is itself
a constitution violation that pre-dates this feature; surfacing it here
makes the violation resolvable in the same PR cycle rather than letting it
ossify.

**Alternatives considered**:

- **Add a separate `.mjs` script and leave `bundle-size.js` informational**:
  rejected — two scripts measuring the same bundle is a DRY violation, and
  the existing script being informational while a new one fails is just
  confusing.
- **Amend the constitution to relax the ceiling**: out of scope for a
  feature PR; would need a separate constitution amendment PR with the
  Sync Impact Report bump per constitution Governance.
- **Track delta-per-feature instead of absolute ceiling**: rejected —
  constitution speaks in absolutes; per-feature deltas are useful as
  reviewer aids but not as the gate.

---

## R-8: Demo subset choices (narrowed after review)

**Decision**: Each demo page that **exists today** declares an explicit
`enrichments` list that matches the enrichments its narrative exercises. The
new live-toggle demo declares the full set and opts in to the panel. Demo
pages from spec 011 (`real-world/atmosphere`, `mixed/categorical-and-numeric`,
`before-after/*`, `retrofit/*`) are **not** in scope for this feature — they
do not exist yet; their `pageConfig` declarations land in the spec-011
implementation PR alongside the demo HTML itself.

Initial subsets (the registry-friendly ids in each), covering only the five
real files today:

| Demo page | Subset |
|---|---|
| `public/demo/index.html` | `heatmap`, `sliders`, `slider-threshold`, `statistics`, `frequency`, `frequency-chart` (demo hub — keeps every shipped affordance available) |
| `public/demo/sliders/interpolation.html` | `heatmap`, `sliders`, `statistics` |
| `public/demo/sliders/alternate-calc-models.html` | `sliders`, `statistics` |
| `public/demo/sliders/synced-tables.html` | `sliders` |
| `public/demo/sliders/heatmap.html` | `heatmap`, `sliders`, `slider-threshold` |
| `public/demo/toggle/live-enrichments.html` (NEW) | full set + `showToggleUi: true` |

**Rationale**: Each subset is the smallest set that still tells the demo's
story. Narrowing the list to existing files prevents the implementation task
from either fabricating placeholder demos or skipping FR-019 silently. The
spec-011 demos pick up their `pageConfig` declarations in their own PR — the
registry-and-filter mechanism shipped here works fine for them because
unknown ids and missing pages have no failure surface.

**FR-019 reading under this scope**: "Every demo page that currently exists"
literally means the five files in the table above plus the new live-toggle
demo. The spec-011 demo PR is responsible for adding `pageConfig` to its own
files when it lands.

**Alternatives considered**:

- **Move every demo to the full default set**: rejected — defeats the purpose
  of the feature.
- **Leave existing demos un-configured and only configure the new demo**:
  rejected — fails FR-019 for the demos that *do* exist.
- **Configure the spec-011 demos preemptively** (the pre-review wording):
  rejected — the files don't exist, so the configuration cannot be checked in
  or tested. Belongs to the spec-011 implementation PR.

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
