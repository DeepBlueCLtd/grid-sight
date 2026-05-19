# Feature Specification: Per-Page Enrichment Capability Filtering

**Feature Branch**: `012-capability-filtering`
**Created**: 2026-05-19
**Status**: Draft
**Input**: User description: "We've created a collection of new specs, to support new features / capabilities. This will result in too many capabilities to show in one table. We need a way of configuring which capabilities are presented on a page. There can be a default set of config booleans in the JS source file. But, when they want to, document authors should be able to create an instance of this config parameter in the source for a page, and configure which 'enrichments' are displayed on a page. In our demo content we can configure the demos to show a particular set of enrichments that are relative to that demo. Plus a demo where the visitor toggles which enrichments are active on that page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Document author limits the enrichment set for a page (Priority: P1)

A document author embeds Grid-Sight on a page that contains a single lookup table for
which only sliders, heatmap, and the statistics popup are meaningful. The other
enrichments (sort, filter, frequency, outlier, sparkline, annotations, units toggle,
cumulative column, copy-as-CSV, diff/compare) would clutter the lozenge bar without
adding value. The author writes a small configuration object in the page source that
names the enrichments they want enabled, and Grid-Sight initialises showing only
those — every lozenge, menu item, and runtime affordance for the disabled
enrichments stays absent.

**Why this priority**: This is the central problem. Without a per-page filter, every
new enrichment shipped by the library grows the lozenge bar on every page that uses
Grid-Sight, eventually crowding out the affordances each individual page actually
needs. Solving this unlocks the rest of the roadmap (more enrichments can be added
without harming existing pages).

**Independent Test**: Take an existing demo page that currently shows all
enrichments. Add a page-level config naming a subset (e.g. `["heatmap", "slider",
"statistics"]`). Reload and verify the lozenge bar shows exactly those three
affordances, no others, on every qualifying table on the page.

**Acceptance Scenarios**:

1. **Given** a page with a Grid-Sight config that enables only `heatmap` and
   `slider`, **When** Grid-Sight initialises on the page, **Then** only the heatmap
   and slider lozenges are rendered on table headers; no sort, filter, frequency,
   stats, outlier, sparkline, annotation, units-toggle, cumulative, copy, or diff
   lozenges appear.
2. **Given** the same page with the same config, **When** the user opens any
   enrichment menu (e.g. the plus-icon menu on a header), **Then** menu items for
   disabled enrichments are absent (not greyed out — absent).
3. **Given** a page with **no** Grid-Sight config object, **When** Grid-Sight
   initialises, **Then** the library's built-in default set of enabled enrichments
   is used and the page behaves as it did before this feature shipped.
4. **Given** a page-level config that enables an enrichment the visitor's build does
   not include (e.g. a removed or renamed enrichment), **When** Grid-Sight
   initialises, **Then** the unknown name is ignored, the rest of the config is
   honoured, and no error is shown to the visitor.

---

### User Story 2 - Visitor toggles enrichments at runtime on a demo page (Priority: P2)

A visitor is exploring a Grid-Sight demo intended to showcase the configuration
mechanism itself. The page renders a panel listing every enrichment the library
ships, with a checkbox per entry reflecting the current enabled set. As the visitor
ticks or unticks a box, the corresponding lozenges appear or disappear on the page's
tables immediately, without a full reload. This lets a viewer feel the effect of the
config object directly, without editing HTML.

**Why this priority**: Document authors are persuaded by the static config
mechanism (Story 1), but reviewers, evaluators, and stakeholders persuade themselves
faster when they can flip a switch and watch the bar change. The runtime toggle is
also a debugging aid for authors choosing their own subset.

**Independent Test**: Open the dedicated toggle-demo page. Untick "heatmap" in the
toggle panel and confirm the heatmap lozenge disappears from every table on the
page, that any active heatmap is removed, and that ticking the box again restores
the lozenge (no reload). Repeat for two other enrichments to confirm the panel
controls work for every entry.

**Acceptance Scenarios**:

1. **Given** the toggle-demo page is loaded with all enrichments enabled, **When**
   the visitor unticks an enrichment in the panel, **Then** that enrichment's
   lozenge is removed from every qualifying header on the page within one animation
   frame and any active instance of that enrichment is cleaned up (no orphan DOM,
   no stuck overlays).
2. **Given** an enrichment has been toggled off, **When** the visitor ticks it back
   on, **Then** the lozenge re-appears in the same place with no page reload and
   the enrichment is operable again.
3. **Given** the toggle panel reflects the current set, **When** the visitor reloads
   the page, **Then** the visitor's last-chosen set is restored from the page's
   per-URL persistence (same model used by sliders / sort).

---

### User Story 3 - Demo pages showcase enrichment subsets relevant to each demo (Priority: P2)

The existing demo pages (`public/demo/...`) each tell a focused story — atmosphere
lookup, mixed categorical / numeric, before / after, URL-preloaded, retrofit, etc.
With every enrichment shipped on every demo, the off-topic lozenges distract from
the point of each page. Each demo declares a config that exposes only the
enrichments relevant to that demo's narrative; visitors arriving at the atmosphere
page see slider + heatmap + statistics; visitors arriving at the categorical roster
see sort + filter + frequency; and so on.

**Why this priority**: The demos are the primary sales surface for the library; an
uncluttered demo converts better than a cluttered one. This story is what proves the
feature is "for real" rather than a theoretical knob.

**Independent Test**: Walk each demo page and verify the lozenge bar on each
qualifying table contains exactly the enrichments named in that page's demo brief
(documented in `specs/011-demo-pages/plan.md`), with no extras.

**Acceptance Scenarios**:

1. **Given** the atmosphere demo page, **When** Grid-Sight is enabled, **Then** only
   slider, heatmap, and statistics affordances appear on the density-ratio table.
2. **Given** the categorical-and-numeric mixed demo, **When** Grid-Sight is enabled,
   **Then** Table A (numeric) shows slider + heatmap + numeric stats; Table B
   (categorical) shows sort + filter + frequency; neither table shows the other's
   enrichments.
3. **Given** any demo with a configured subset, **When** the page is rebuilt or
   re-deployed, **Then** no manual editing of the library bundle is required — the
   subset is declared in the demo page's own source.

---

### Edge Cases

- **Empty config (`enrichments: []`)**: MUST produce a clean Grid-Sight page with the
  master GS toggle still visible but no enrichment lozenges. The page MUST NOT
  fall back to defaults — an explicit empty list is an explicit choice.
- **Config declared after Grid-Sight has already initialised**: The config MUST be
  consulted at init time only; a config object inserted later in the page lifecycle
  is out of scope and MUST NOT cause errors if present.
- **Config naming an enrichment that exists in the library but is incompatible with
  every table on the page** (e.g. `slider` on a page with only categorical tables):
  No error; the lozenge simply does not appear because no table qualifies. This is
  identical to today's "qualification" behaviour and is not a new concern.
- **Config naming the same enrichment twice or in mixed case**: Duplicates and case
  variants MUST resolve to the same enrichment and MUST NOT cause duplicate
  lozenges or errors. Names are case-insensitive in the config.
- **Runtime toggle panel on a page where the author also declared a static config**:
  The runtime panel (Story 2) is opt-in per page — it MUST NOT appear on pages that
  did not request it, even when those pages declare a config object. When both are
  present on the same demo, runtime changes override the static config for that
  visitor's session.
- **Disabling an enrichment that is currently in use** (e.g. visitor turns off
  "slider" while a slider is bound to a header): The enrichment MUST be cleaned up
  fully — any DOM it injected, any state it persists, any event listeners it
  attached — leaving the page indistinguishable from one where the enrichment was
  never used.
- **Re-enabling an enrichment that was previously cleaned up**: The lozenge MUST
  re-appear in its default idle state. Visitor-created instances (e.g. a slider that
  was bound to a header before the toggle) are NOT restored automatically.
- **Tables with `data-gs-ignore`**: Continue to be untouched by Grid-Sight
  regardless of config; the config controls which enrichments are *available*, not
  whether Grid-Sight runs at all.

## Requirements *(mandatory)*

### Functional Requirements

**Default configuration (library)**

- **FR-001**: Grid-Sight MUST ship a single, canonical default enabled-enrichment
  set defined in one place in the source. The default set MUST be the list of
  enrichments the library currently exposes (i.e. everything shipped to date is
  enabled by default) so that adopting this feature does not regress any existing
  page.
- **FR-002**: The default set MUST be a structured collection (one entry per known
  enrichment) so that adding a new enrichment to the library requires registering
  it in exactly one place, and the default-on / default-off choice for each new
  enrichment is explicit.
- **FR-003**: Each enrichment MUST be referenced by a stable, lower-case, hyphenated
  identifier (e.g. `heatmap`, `slider`, `slider-threshold`, `sort`, `filter`,
  `outlier`, `sparkline`, `frequency`, `statistics`, `annotations`, `units-toggle`,
  `cumulative`, `copy-as-csv`, `diff-compare`). Identifiers MUST be the contract
  between page-level config and the library.

**Page-level override**

- **FR-004**: A document author MUST be able to declare, in the source of an
  individual HTML page, which enrichments are enabled for that page. This
  declaration MUST be readable by Grid-Sight before any lozenge is rendered.
- **FR-005**: A page-level declaration MUST replace the library default for that
  page — it MUST NOT merge with the default. (An author who wants "defaults plus
  one extra" lists the defaults plus one extra explicitly.) This keeps the per-page
  enabled set immediately obvious from one read of the page source.
- **FR-006**: A page-level declaration MUST be expressed as a list (or equivalent
  collection) of the enrichment identifiers from FR-003. The shape MUST be simple
  enough to write by hand without consulting documentation; it MUST NOT require
  knowledge of internal library structures.
- **FR-007**: A page-level declaration MAY include identifiers the running build
  does not recognise (e.g. forward-compatible references to future enrichments).
  Unknown identifiers MUST be silently ignored; known identifiers in the same list
  MUST still be honoured.
- **FR-008**: When no page-level declaration is present, Grid-Sight MUST use the
  library default set (FR-001) unchanged.

**Effect on the UI**

- **FR-009**: For any enrichment not in the effective enabled set, Grid-Sight MUST
  NOT render the enrichment's lozenge on any header.
- **FR-010**: For any enrichment not in the effective enabled set, Grid-Sight MUST
  NOT add the enrichment's entry to any menu (e.g. the plus-icon menu). Disabled
  enrichments MUST be absent, not greyed out.
- **FR-011**: For any enrichment not in the effective enabled set, any URL-encoded
  state for that enrichment MUST be ignored on page load (the page MUST NOT
  spontaneously activate a disabled enrichment because of a bookmarked URL).
- **FR-012**: Disabling an enrichment via config MUST NOT prevent the master
  Grid-Sight toggle from appearing or operating; the page MUST still be
  enrichable in principle, just with a narrower toolkit.

**Runtime visitor toggle (opt-in per page)**

- **FR-013**: A page MUST be able to opt in to a runtime toggle panel that lets the
  visitor enable or disable each enrichment without a page reload. Opting in MUST
  be a single, declarative choice in the page source.
- **FR-014**: The toggle panel MUST list every enrichment known to the running
  build (not only those enabled by default or by the page config). Each entry MUST
  show the enrichment's identifier and a short, human-readable label.
- **FR-015**: Toggling an enrichment off in the panel MUST remove its lozenge from
  every qualifying header on the page within one animation frame AND clean up any
  currently active instance of that enrichment (DOM nodes, overlays, persisted
  state for that visit) without leaving residue.
- **FR-016**: Toggling an enrichment on in the panel MUST restore its lozenge to
  every qualifying header within one animation frame.
- **FR-017**: The visitor's chosen set MUST persist for that visitor on that page
  using the same per-URL persistence model the rest of Grid-Sight already uses
  (URL + localStorage fallback). Reloading the page MUST restore the last set.
- **FR-018**: When both a static page config (FR-004) and the runtime panel
  (FR-013) are present on the same page, the runtime panel's persisted state MUST
  take precedence for that visitor; absence of persisted state MUST fall back to
  the static page config; absence of both MUST fall back to the library defaults.

**Demo content**

- **FR-019**: Every demo page that currently exists MUST declare an explicit
  page-level enrichment set so that no demo grows new lozenges automatically as
  future enrichments are added. The chosen subset MUST match the enrichments the
  demo's narrative exercises.
- **FR-020**: One demo page MUST exist whose purpose is to demonstrate the runtime
  toggle panel (Story 2). This demo MUST use a table on which several enrichments
  qualify, so that the visitor sees lozenges actually appear and disappear as
  they toggle.

**Accessibility, error handling, observability**

- **FR-021**: The runtime toggle panel MUST be operable by keyboard alone (focus,
  tab order, space/enter to toggle) and MUST expose each control's state to
  assistive technology.
- **FR-022**: Errors in interpreting a page-level config (e.g. wrong shape,
  non-string entries) MUST NOT prevent Grid-Sight from initialising; the library
  MUST fall back to the default set and emit a single console warning describing
  what was wrong.

### Key Entities *(include if feature involves data)*

- **EnrichmentRegistry**: The single in-library record of every enrichment the
  build ships, keyed by stable identifier. Holds the default-on flag for each
  entry and the human-readable label used in the runtime toggle panel.
- **PageEnrichmentConfig**: The author-supplied, page-scoped declaration of which
  enrichments are enabled for one HTML page. Optional. When absent, the registry
  defaults apply.
- **EffectiveEnabledSet**: The resolved set of enrichment identifiers active for a
  given page-visit, computed from (in order of precedence): the visitor's runtime
  toggle choices, the page config, the library defaults.
- **RuntimeTogglePanel**: An opt-in UI surface that lists every registered
  enrichment and lets the visitor flip each on or off. Its state is the source of
  the persisted user choice referenced by EffectiveEnabledSet.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A document author can change which enrichments appear on a page in
  under 60 seconds, editing only that page's source (no rebuild of the library, no
  change to any other page).
- **SC-002**: On a page that disables every enrichment except one, the lozenge bar
  on any qualifying header contains exactly one lozenge — verified by automated
  end-to-end test on every shipped demo subset.
- **SC-003**: Adding a new enrichment to the library in the future requires editing
  the enrichment registry in exactly one place; no demo page picks up the new
  enrichment unless the demo's own config is also edited.
- **SC-004**: A visitor on the runtime-toggle demo can see a lozenge appear or
  disappear within one animation frame of clicking its checkbox, on a mid-range
  laptop, with no perceptible flicker on other lozenges.
- **SC-005**: Reloading a page after the visitor has changed the runtime toggles
  restores the same enabled set with no flash of an unwanted lozenge beyond one
  animation frame.
- **SC-006**: No existing demo page that previously displayed an enrichment loses
  that enrichment after this feature ships (regression guard: existing visible
  enrichments stay visible because each demo's explicit config lists them).
- **SC-007**: The library's published bundle size grows by no more than 1 KB
  gzipped to accommodate the registry + page-config + runtime-toggle code paths
  (the runtime-toggle panel itself MAY be opt-in to keep pages that don't use it
  smaller).

## Assumptions

- The list of enrichments referenced by identifier in FR-003 reflects the
  enrichments currently spec'd (specs 001–010) plus the existing heatmap,
  statistics, and frequency affordances. Any enrichment added after this spec is
  drafted will be registered using the same identifier pattern when it ships.
- "On a page" means per-HTML-document. There is no requirement to vary the enabled
  set per table within a single page; if two tables on one page need different
  enrichments, the author either uses `data-gs-ignore` on one or splits them
  across two pages. Per-table override is out of scope for this feature.
- The runtime toggle panel is a separate, opt-in surface. Most production pages
  will not show it; it exists primarily for the dedicated demo and as a
  debugging aid for authors. Its visual treatment can reuse existing Grid-Sight
  UI primitives.
- Persistence reuses the same per-URL model already shared by sliders, sort, and
  other URL-encoded state — no new storage mechanism is introduced.
- All operation remains fully offline (constitution §VI). Reading the page config
  and rendering the toggle panel happen entirely in the browser with no remote
  calls.
- Backwards compatibility: pages that exist today and do not declare a config
  continue to behave exactly as they do today (FR-001 / FR-008 together preserve
  this).
