# Feature Specification: Welcome Page Redesign & Per-Table Options

**Feature Branch**: `claude/welcome-page-redesign-rVjHn`
**Created**: 2026-05-30
**Status**: Draft
**Input**: User description: "Redesign the Grid-Sight welcome page into a broad, warm-but-technical introduction for general first-time visitors, with alternating narrative + live interactive tables, a hero/principles intro, a retained-and-explained global on/off toggle, a live demonstration of a new start-state option (default off), and links to all existing demos — backed by a new per-table options capability that scopes enrichments (and start-state) to tables addressed by id or CSS selector."

## Overview

Grid-Sight's landing page (`public/index.html`) is today a **demo index for the
"Dynamic Sliders" feature**: it opens with a dense technical lede, a single
global on/off toggle, a grid of 12 demo-page links, and three sample tables. It
assumes the visitor already knows what Grid-Sight is.

This feature reframes that page as a **broad welcome** that orients a
general, first-time visitor — explaining *what Grid-Sight is and why it
matters* — and lets them **experiment with the real features inline** as they
scroll, with narrative on one side and a live interactive table on the other.

Delivering that experience requires a **platform capability** Grid-Sight does
not have today: the ability to configure **different tables on the same page
differently**. At present, configuration is strictly page-wide (one enrichment
list applies to every table; the only per-table control is `data-gs-ignore`,
which opts a table out entirely). This feature adds **per-table options**
addressed by **id or CSS selector**, including a **per-table start-state**
(begin enabled or disabled, default off) so each inline demo can showcase a
distinct, self-contained slice of functionality.

The two parts are intentionally bundled: the page is the motivating consumer of
the capability, and the capability is reusable by any host page beyond this one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time visitor understands what Grid-Sight is (Priority: P1)

A person who has never heard of Grid-Sight arrives at the welcome page. Within
the first screen they read a plain-language explanation of what it is (it
enriches ordinary HTML tables in place), the problem it solves (no rebuild, no
backend, works on the tables you already have), and the principles that make it
trustworthy (works offline / air-gapped, no runtime dependencies, enhances
progressively, accessible, and leaves the original table byte-identical when
turned off). They leave able to describe Grid-Sight in a sentence.

**Why this priority**: This is the core goal of the redesign — the page exists
to make a cold visitor *get it*. Without this, the inline demos have no framing.
It delivers value even if no other story ships (the intro alone is a better
welcome than today's page).

**Independent Test**: Load the welcome page with Grid-Sight disabled; confirm
the hero and principles section communicates purpose and principles in
plain language without requiring the reader to interact with any table.

**Acceptance Scenarios**:

1. **Given** a visitor who has never used Grid-Sight, **When** they load the
   welcome page, **Then** the first section states what Grid-Sight is, the
   problem it solves, and its guiding principles in plain language before any
   feature demo.
2. **Given** the welcome page, **When** the visitor reads the intro, **Then**
   the principles (offline/air-gapped, zero runtime dependencies, progressive
   enhancement, accessibility, read-only/byte-identical teardown) are each
   stated in terms a non-specialist can understand.
3. **Given** the welcome page loaded from a `file://` URL with no network,
   **When** it renders, **Then** the intro and all assets display fully (no
   broken or network-dependent content).

---

### User Story 2 - Visitor experiments with features inline while scrolling (Priority: P1)

As the visitor scrolls past the intro, they encounter a sequence of feature
sections, one per feature area. Each section presents narrative on one side and
a **live, interactive sample table** on the other, with the side that holds the
narrative **alternating** down the page. The visitor can directly operate the
feature in each table (move a slider, click a heatmap lozenge, sort/filter,
search, add a virtual column, annotate a cell, etc.) without leaving the page.
On a narrow screen the two columns stack vertically. Each section links out to
the related full demo pages for deeper exploration.

**Why this priority**: This is the second half of the core experience — letting
visitors *feel* the value, not just read about it. It depends on the per-table
options capability (Story 4) to show distinct features side-by-side.

**Independent Test**: Scroll through the page and operate each section's table;
confirm the feature works live inline and the layout alternates on wide screens
and stacks on narrow screens.

**Acceptance Scenarios**:

1. **Given** the welcome page on a wide screen, **When** the visitor scrolls
   through the feature sections, **Then** each section shows narrative beside a
   live interactive table, and the narrative/table sides alternate between
   consecutive sections.
2. **Given** the welcome page on a narrow (mobile-width) screen, **When** a
   feature section renders, **Then** the narrative and table stack into a single
   readable column.
3. **Given** any feature section's inline table, **When** the visitor operates
   that feature (per the feature's normal interaction), **Then** the feature
   responds live in place, exactly as it would on its dedicated demo page.
4. **Given** a feature section, **When** the visitor wants to explore more,
   **Then** the section provides links to the related existing demo page(s) for
   that feature area.
5. **Given** the welcome page, **When** the visitor reaches the four areas,
   **Then** all four are represented: (a) sliders & interpolation, (b) visual
   analysis (heatmap, outlier marker, statistics popup, summary row), (c)
   navigation & search (sort, filter, find-in-table, freeze panes), and (d)
   derived data & notes (virtual columns Σ/⌇/Δ, cell annotations).

---

### User Story 3 - Visitor sees the on/off and start-state behaviour explained and demonstrated (Priority: P2)

The page keeps a global "Grid-Sight enabled" control and the raw-vs-enriched
contrast, but instead of a bare checkbox it is **woven into the narrative** so
the visitor understands *why* it exists: Grid-Sight is a non-destructive overlay
that can be turned off to reveal the untouched table. Separately, the page
**demonstrates the new start-state option**: at least one inline table is
configured to begin in the raw, un-enriched state (default off) and the visitor
can enable it on demand, seeing the before/after transition for themselves.

**Why this priority**: Reinforces the "progressive, non-destructive" principle
viscerally and exercises the new start-state capability in front of the visitor.
Valuable but secondary to having the intro and inline demos at all.

**Independent Test**: Toggle the global control and observe the whole page move
between raw and enriched; separately, find the start-disabled table, confirm it
begins raw, enable it, and confirm it enriches without a page reload.

**Acceptance Scenarios**:

1. **Given** the welcome page, **When** the visitor reads the section
   containing the global enable/disable control, **Then** the narrative explains
   that Grid-Sight is a non-destructive overlay and that turning it off restores
   the original table.
2. **Given** the global control is enabled, **When** the visitor turns it off,
   **Then** every Grid-Sight-managed table on the page returns to its raw
   appearance; turning it back on restores the enrichments.
3. **Given** a table configured to start disabled (default off), **When** the
   page first loads, **Then** that table is shown raw (no lozenges/enrichment)
   while other tables configured to start enabled are already enriched.
4. **Given** a start-disabled table, **When** the visitor enables it (via the
   provided control/affordance), **Then** it becomes enriched in place without a
   full page reload.

---

### User Story 4 - Host author configures different tables differently on one page (Priority: P1)

An author embedding Grid-Sight (the welcome page is the first such author, but
this applies to any host) needs different tables on the same page to expose
different feature sets — and some to start enabled while others start disabled.
The author declares per-table options by **id or CSS selector**, listing the
enrichments each matched table should offer and whether it starts enabled. A
table not matched by any per-table entry continues to behave exactly as it does
today under the page-level configuration.

**Why this priority**: This is the enabling capability for Story 2's
side-by-side inline demos. It is foundational: without it, every table on a page
shows the same features and the same start-state. It is independently testable
and independently valuable to any Grid-Sight consumer.

**Independent Test**: On a test page, declare per-table options for two tables
by id and by CSS selector with different enrichment lists and start-states;
confirm each matched table offers only its declared enrichments and honours its
declared start-state, while an unmatched table follows the page-level config.

**Acceptance Scenarios**:

1. **Given** a page declaring per-table options that match a table by its `id`,
   **When** Grid-Sight initialises, **Then** that table offers exactly the
   enrichments declared for it (intersected with the enrichments Grid-Sight
   knows about), independent of other tables.
2. **Given** a page declaring per-table options that match tables by a CSS
   selector, **When** Grid-Sight initialises, **Then** every table matching the
   selector receives those options.
3. **Given** a table matched by a per-table entry **and** a page-level
   configuration **and** a visitor override, **When** the enabled set is
   resolved, **Then** precedence is: visitor override > per-table > page-level >
   library defaults.
4. **Given** a per-table entry referencing an unknown enrichment id, **When**
   options are resolved, **Then** the unknown id is dropped (consistent with
   existing resolution behaviour) and no error is surfaced to the host page.
5. **Given** a table not matched by any per-table entry, **When** Grid-Sight
   initialises, **Then** it behaves exactly as under the current page-level
   configuration (no regression).
6. **Given** a per-table entry that sets start-state, **When** the page loads,
   **Then** the matched table begins enabled or disabled as declared, defaulting
   to disabled when the per-table entry specifies start-state without an
   explicit value.
7. **Given** two per-table entries whose selectors both match the same table,
   **When** options are resolved, **Then** resolution is deterministic and
   documented (see Assumptions), with no ambiguity in the resulting option set.

---

### User Story 5 - Visitor can still reach every existing demo (Priority: P3)

A visitor who wants the full catalogue can still find links to all existing demo
pages from the welcome page — both contextually (within each feature section)
and collectively (a consolidated "more demos" index, e.g. near the bottom).

**Why this priority**: Preserves existing navigation value so nothing currently
reachable from the landing page is lost. Lowest priority because it is
preservation rather than new value.

**Independent Test**: From the welcome page, confirm every existing demo page is
reachable via a working link.

**Acceptance Scenarios**:

1. **Given** the redesigned welcome page, **When** the visitor looks for more
   examples, **Then** all existing demo pages remain reachable via working links
   (no demo page becomes orphaned).
2. **Given** a feature section, **When** the visitor wants more of that feature
   type, **Then** that section links to the corresponding demo page(s).

---

### Edge Cases

- **No matching tables for a selector**: a per-table entry whose selector
  matches nothing is a no-op (no error, no effect on other tables).
- **Selector matches an opted-out table**: a table marked `data-gs-ignore`
  remains fully opted out even if a per-table selector also matches it
  (explicit opt-out wins; see Assumptions).
- **Empty enrichment list for a table**: a matched table declared with an empty
  enrichment list offers no enrichments (a valid, distinct state from "not
  matched").
- **Start-disabled then global-disable then global-enable**: a table that began
  disabled and was individually enabled should follow the page-wide enable/
  disable thereafter without losing its identity; the resulting state must be
  unambiguous (see Assumptions).
- **Global toggle while a start-disabled table is still raw**: turning the
  global control on must not force-enable tables that are configured to start
  (and remain) disabled unless the visitor enabled them — the interaction
  between the global control and per-table start-state must be unambiguous (see
  Assumptions).
- **Offline / `file://` load**: the entire page, including every inline demo,
  must function with no network access.
- **Teardown identity**: turning any enrichment or the whole page off must
  restore the affected tables to byte-identical original markup.
- **Selector specificity collisions**: overlapping selectors matching the same
  table must resolve deterministically (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

#### Welcome page experience

- **FR-001**: The welcome page MUST open with an introductory section that
  states, in plain language for a non-specialist, what Grid-Sight is and the
  problem it solves (enriching existing HTML tables in place without a rebuild).
- **FR-002**: The introductory section MUST communicate Grid-Sight's guiding
  principles: works offline / air-gapped, no runtime dependencies, progressive
  enhancement, accessibility by default, and read-only / byte-identical
  teardown.
- **FR-003**: The page MUST present feature sections covering all four areas:
  (a) sliders & interpolation, (b) visual analysis (heatmap, outlier marker,
  statistics popup, summary row), (c) navigation & search (sort, filter,
  find-in-table, freeze panes), and (d) derived data & notes (virtual columns
  cumulative/sparkline/compare, cell annotations).
- **FR-004**: Each feature section MUST place explanatory narrative alongside a
  live, interactive sample table, and the side holding the narrative MUST
  alternate between consecutive sections on wide screens.
- **FR-005**: On narrow (mobile-width) screens, each feature section's narrative
  and table MUST stack into a single readable column.
- **FR-006**: Each inline sample table MUST let the visitor operate the
  feature(s) that section showcases, behaving as it would on the feature's
  dedicated demo page.
- **FR-007**: A section MAY contain more than one sample table when that helps
  illustrate the feature area.
- **FR-008**: Each feature section MUST link to the related existing demo
  page(s) for that feature area.
- **FR-009**: The page MUST retain a global enable/disable control for
  Grid-Sight and MUST explain within the narrative that Grid-Sight is a
  non-destructive overlay that can be switched off to reveal the original
  tables.
- **FR-010**: Toggling the global control off MUST return all Grid-Sight-managed
  tables on the page to their raw appearance, and toggling it on MUST restore
  the enrichments — without a full page reload.
- **FR-011**: The page MUST demonstrate the new start-state option live: at
  least one inline table MUST begin in the raw (disabled) state and offer the
  visitor a way to enable it in place.
- **FR-012**: All existing demo pages MUST remain reachable from the welcome
  page via working links, including a consolidated index of all demos.
- **FR-013**: The welcome page MUST render and function fully when loaded
  offline, including from a `file://` URL, with no network requests at runtime.

#### Per-table options capability

- **FR-014**: Grid-Sight MUST allow a host page to declare options that apply to
  specific tables, with each table addressed by its `id` or by a CSS selector.
- **FR-015**: Per-table options MUST be able to specify the set of enrichments a
  matched table offers, independently of the page-level enrichment set.
- **FR-016**: When resolving the enrichments offered by a table, Grid-Sight MUST
  apply precedence: visitor override > per-table options > page-level
  configuration > library defaults.
- **FR-017**: Unknown enrichment ids in per-table options MUST be dropped during
  resolution (consistent with existing page-level resolution), without throwing
  into the host page.
- **FR-018**: A table not matched by any per-table entry MUST behave exactly as
  it does under the current page-level configuration (no regression).
- **FR-019**: A table explicitly opted out via `data-gs-ignore` MUST remain
  opted out regardless of any per-table selector that also matches it.
- **FR-020**: Per-table options MUST be able to specify whether a matched table
  starts enabled or disabled, defaulting to **disabled** when start-state is
  specified without an explicit value.
- **FR-021**: A table configured to start disabled MUST load in its raw,
  un-enriched state, and MUST be able to become enriched in place (without a
  full page reload) when subsequently enabled.
- **FR-022**: Introducing per-table start-state MUST NOT change Grid-Sight's
  existing default behaviour for tables/pages that do not use the option
  (existing consumers' tables continue to enrich on load as they do today).
- **FR-023**: Resolution MUST be deterministic when multiple per-table entries
  match the same table; the resolution rule MUST be documented.
- **FR-024**: Enabling or disabling any table (individually or via the global
  control) MUST restore byte-identical original markup for the affected table
  when it returns to the raw state.

### Key Entities

- **Per-table option entry**: An author-declared association between a table
  matcher (an `id` or CSS selector) and the options that apply to matched
  tables. Key attributes: the matcher, the enrichment set offered, and the
  start-state (enabled/disabled, default disabled).
- **Resolved table configuration**: The effective set of enrichments and the
  start-state for a single table, after combining visitor override, per-table
  options, page-level configuration, and library defaults by precedence.
- **Feature section** (welcome page): A unit of the welcome page pairing
  narrative with one or more live sample tables for a feature area, plus links
  to related demo pages.
- **Global enable/disable state**: The page-wide on/off condition for
  Grid-Sight, presented with explanatory narrative and reflecting the
  non-destructive overlay model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can state what Grid-Sight is and one reason
  it matters after reading only the first (intro) section, without interacting
  with any table.
- **SC-002**: All four feature areas are represented by at least one live,
  operable inline table on the welcome page, and a visitor can operate each one
  without navigating away.
- **SC-003**: On a wide screen, narrative and table sides alternate across
  consecutive feature sections; on a narrow screen, every section stacks to a
  single column with no horizontal overflow.
- **SC-004**: At least one inline table demonstrably starts in the raw state and
  becomes enriched in place when the visitor enables it, with no full page
  reload.
- **SC-005**: Two or more tables on the same page simultaneously expose
  different enrichment sets driven solely by per-table options.
- **SC-006**: Every existing demo page reachable from today's landing page
  remains reachable from the redesigned page (zero orphaned demos).
- **SC-007**: The welcome page loads and every inline demo functions with no
  network access (verified from a `file://` load).
- **SC-008**: Turning Grid-Sight off (globally or per table) restores affected
  tables to byte-identical original markup.
- **SC-009**: Existing pages that do not use per-table options exhibit no change
  in behaviour (all existing automated suites remain green).
- **SC-010**: Resolution precedence (visitor > per-table > page > defaults) and
  start-state default (off) hold for every combination exercised in tests.

## Assumptions

- **Spec directory vs. branch**: Development proceeds on the pre-assigned
  session branch `claude/welcome-page-redesign-rVjHn` rather than a newly
  created numbered branch; the spec directory is numbered `015` purely for
  sequential cataloguing.
- **Library default unchanged**: The existing global default (Grid-Sight
  enriches detected tables on load) is preserved for any page/table that does
  not opt into per-table start-state. "Default off" applies specifically to the
  new per-table start-state option, not to Grid-Sight as a whole.
- **Explicit opt-out wins**: `data-gs-ignore` continues to be an absolute
  opt-out and takes precedence over any per-table selector match.
- **Deterministic multi-match resolution**: When multiple per-table entries
  match one table, later entries override earlier ones on a per-field basis
  (last-match-wins), mirroring familiar cascade semantics; this will be stated
  in the capability's documentation.
- **Global control and start-state interaction**: The page-wide enable control
  reflects and drives the overall enabled state; a table configured to start
  disabled stays raw until individually enabled or until the visitor uses the
  global control to enable the page. The precise interaction will be pinned down
  during planning, but the visible behaviour must remain unambiguous and match
  the demonstrated narrative.
- **Selector matching scope**: CSS selectors are matched against table elements
  in the host document at initialisation; selectors that match non-table
  elements are ignored for table-option purposes.
- **Curated inline demos**: The welcome page reuses the existing sample data and
  feature behaviours; this feature does not introduce new enrichment types, only
  a new way to scope existing ones per table plus the page redesign.
- **Tone and audience**: Content targets general/mixed first-time visitors in a
  technical-but-warm voice; exact copy is a content task within this feature, not
  a separate one.
- **No new runtime dependencies**: The redesign and capability use only existing
  Grid-Sight primitives and ship within the enforced bundle ceiling; the page
  works with the standalone IIFE bundle offline.
