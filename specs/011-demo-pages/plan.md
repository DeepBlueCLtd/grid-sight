# Implementation Plan: Demo Pages Expansion

**Branch**: `011-demo-pages` | **Date**: 2026-05-18 | **Status**: Draft

## Summary

Add five new demo pages under `public/demo/` that move Grid-Sight's showcase beyond
synthetic numeric grids. The set picks one real-world table, one mixed
categorical/numeric layout, a before/after walkthrough, a URL-preloaded scenario, and
a "retrofit" page styled as third-party docs. Together they cover the four story arcs
a first-time viewer needs to see — "this is for real data", "this handles non-numeric
columns too", "here is exactly what changes", "links are shareable", and "no source
change required". No new runtime code; all pages consume the existing
`grid-sight.iife.js` bundle.

## Goals

- **Real-world reference**: prove sliders + heatmap + statistics on a dataset a viewer
  recognises, not a placeholder grid.
- **Mixed page**: prove the lozenge set is content-aware — numeric `#` opens stats,
  categorical `#` opens a frequency table, on the same page side by side.
- **Before/after walkthrough**: prove the value-add visually, by rendering one table
  twice and annotating each affordance the GS-enabled copy unlocks.
- **Pre-loaded URL**: prove shareability concretely — the first paint already shows an
  interpolated state because the fragment carried slider positions.
- **Retrofit**: prove the "drop in one script tag, change no source" pitch by dropping
  the bundle into a page that looks nothing like the existing demos.

## Non-Goals

- No new enrichments, lozenges, or runtime APIs. Demos exercise what already ships.
- No telemetry, analytics, fingerprinting, or remote calls (constitution §VI).
- No build-step changes; pages are static HTML loading the existing IIFE.
- No third-party CSS frameworks or font CDNs. All assets are local.
- No screenshots, video, GIF, or image-based "tour" — callouts are HTML/CSS only.

## Demo Specifications

### 1. Real-world reference table

**Audience / problem**: A pilot, navigator, or engineer who arrives expecting Grid-Sight
to handle a *real* lookup table from their domain — not a 5×5 toy. Removes the "is this
just a demo trick?" objection.

**Dataset (recommended)**: **ICAO / NATO Standard Atmosphere** — geopotential altitude
(0 → 20 000 m, step 1 000 m) crossed with deviation from ISA (−30 °C → +30 °C, step
10 °C), tabulating density ratio σ. Recommended over ship-radar horizon (1-D — wastes
the bilinear slider story) and tide heights (time-of-day axis is non-monotonic across
the day in a way that confuses interpolation). The atmosphere table is genuinely
2-D, strictly monotonic on both axes, widely tabulated in public references, and the
output range (≈ 0.07 → 1.00) makes the heatmap visually striking.

**Enrichments exercised**: sliders (bilinear), heatmap, statistics popup (`#` on the
density-ratio column), URL persistence.

**Target file**: `public/demo/real-world/atmosphere.html`

**Acceptance criteria**:

- User can drag both sliders and read a density-ratio value at an arbitrary
  altitude / ISA-deviation pair, with the four bracketing cells highlit.
- User can toggle heatmap on the table header and see a smooth gradient down-and-right
  (monotonic decrease with altitude, increase with cold deviation).
- User can open the `#` popup on the row-axis numeric header and see min/max/mean of
  altitude bins; on a data column, the same popup over density ratios.
- Loading the page with GS disabled still shows the raw table — readable, with a
  source citation in a `<figcaption>`.
- Page fits the existing demo nav and links back to the demo home.

### 2. Mixed page (categorical + numeric)

**Audience / problem**: A viewer who has only seen numeric demos and assumes
Grid-Sight is "just for lookup tables". Demonstrates that the lozenge set adapts to
column type.

**Content sketch**: Two tables stacked on one page.

- **Table A — numeric lookup**: a compact 5×5 wind-chill table (air temp °C × wind
  speed km/h → apparent temp).
- **Table B — categorical roster**: a 12-row team / department / role / location
  table. No numeric monotonic axis.

Side-by-side layout on wide viewports; stacked on narrow.

**Enrichments exercised**: on Table A — sliders, heatmap, numeric `#` statistics
popup. On Table B — sort, filter (once shipped), categorical `#` frequency table.

**Target file**: `public/demo/mixed/categorical-and-numeric.html`

**Acceptance criteria**:

- User can click `GS`, then `#` on a numeric column of Table A and see a stats popup
  (min/max/mean/median).
- User can click `GS`, then `#` on a categorical column of Table B (e.g. *Department*)
  and see a frequency table (Engineering ×4, Sales ×2, …).
- Slider lozenge `S` appears only on Table A's corner cell, never on Table B.
- Both tables remain individually opt-out-able via `data-gs-ignore` without affecting
  the other.
- Page passes keyboard-only navigation through both tables' lozenges.

### 3. Before/after walkthrough

**Audience / problem**: A viewer who clicked "what does Grid-Sight actually do?" and
needs a single screen that answers it without prose. Sells the toggle.

**Content sketch**: One small numeric table (~5×5, atmosphere or wind-chill, picked to
match demo 1 so cognitive load is low) rendered twice on the same page:

- **Left** copy: `<table data-gs-ignore>` — the raw "before".
- **Right** copy: identical markup, no opt-out — the "after".

Pure-CSS callout bubbles (absolutely positioned `<aside>` elements with thin leader
lines drawn via `border` or SVG `<line>`) point at: the `GS` toggle, an `S` corner
lozenge, an `H` heatmap lozenge, a `#` stats lozenge, and a column header showing the
`↕` sort lozenge. Each callout is 1–2 lines of text.

**Enrichments exercised**: visually labels sliders, heatmap, stats, sort. (Filter and
outlier are mentioned in a final caption but not visually called out, to avoid clutter.)

**Target file**: `public/demo/before-after/walkthrough.html`

**Acceptance criteria**:

- Both tables render the same numbers; only the right one shows GS affordances after
  the user clicks `GS`.
- Each callout's leader line visibly terminates at the lozenge it names (manual
  visual check; positions hard-coded against table layout).
- Callouts are pure HTML/CSS — no JS, no new runtime deps.
- Layout degrades gracefully on viewports < 700 px (callouts stack below the table
  rather than overlap it).
- Page is printable to a single page of A4 without callout clipping.

### 4. Pre-loaded URL

**Audience / problem**: A viewer who has just been told "slider state is in the URL —
shareable" and wants to see it actually happen. Removes the abstraction.

**Content sketch**: A synced-tables-style page (mirror of `synced-tables.html` — North
Atlantic / South Atlantic pair) where the demo-home link explicitly carries a non-
default slider position in the URL fragment. The first paint, before the user touches
anything, already has sliders attached, both tables synced, and an interpolated
readout displayed at the carried position. A small banner at the top reads "This
page was opened at a shared slider position — drag to change, then copy the URL".

**Enrichments exercised**: sliders, sync, URL persistence.

**Target file**: `public/demo/preloaded/scenario.html`

The demo home links to `demo/preloaded/scenario.html#sl_atlantic=27.5,8400`.

**Acceptance criteria**:

- Opening the link cold (no `localStorage`) places both sliders at the fragment
  position on first paint, with the four bracketing cells highlit.
- Dragging either slider updates the URL fragment in place.
- Opening the page *without* the fragment (`scenario.html`) falls back to the
  library's default position — no error, banner replaced with "Drag a slider, then
  copy the URL to share this view".
- Page works fully offline (`file://`).
- Reloading the page preserves the slider position via the fragment alone, even with
  `localStorage` cleared.

### 5. Retrofit demo

**Audience / problem**: An integrator who maintains an existing docs site and wants to
believe "really, just one script tag". The visual contrast with the other demos is the
whole point.

**Content sketch**: A page styled like a static Markdown-rendered API reference —
serif body font, narrow centred column, prose paragraphs, fenced code blocks with a
monospaced font and a tinted background, an inline table of contents. Topic:
a fictional **"HTTP status code reference"** with two tables:

- A table of HTTP status codes (code, class, name, retryable boolean).
- A table of recommended client backoff timings (attempt # × base delay → wait in ms),
  numeric, monotonic, suitable for sliders.

The IIFE is loaded by a single `<script>` tag in `<head>`; no other change to the
page. A faint banner at the bottom reads "Grid-Sight added by one script tag — view
source".

**Enrichments exercised**: sort and categorical `#` on the status-code table; sliders
and heatmap on the backoff table.

**Target file**: `public/demo/retrofit/docs-page.html`

**Acceptance criteria**:

- Page visually reads as third-party docs, not as a Grid-Sight demo (different font
  stack, different colour palette, narrow column).
- Both tables auto-detect correctly: status-code table gets sort + categorical stats;
  backoff table gets sliders + heatmap.
- Removing the single `<script src="…/grid-sight.iife.js">` line leaves an entirely
  valid, readable docs page.
- No layout breakage from injected lozenges (corner cells, header heights) at
  viewport widths 360 / 768 / 1280 px.
- Page contains no analytics, fonts-CDN, or remote asset.

## Demo-home updates (`public/index.html`)

**Existing cards** — keep all three slider cards (Interpolation, Alternate calc
models, Persistent URL). The third card's link is unchanged, but its blurb is
shortened to make room.

**New cards to add** (in this order, after the existing three):

1. **Real-world: standard atmosphere** — "Bilinear interpolation, heatmap and stats
   on the ICAO standard atmosphere table."
   → `demo/real-world/atmosphere.html`
2. **Mixed: categorical + numeric** — "One page, two tables. See how the `#` lozenge
   becomes stats on numeric columns and a frequency table on categorical ones."
   → `demo/mixed/categorical-and-numeric.html`
3. **Before / after** — "The same table, twice. Callouts label every affordance
   Grid-Sight adds."
   → `demo/before-after/walkthrough.html`
4. **Pre-loaded URL** — "Open this link and the slider is already in position. Drag
   it, copy the URL, share."
   → `demo/preloaded/scenario.html#sl_atlantic=27.5,8400`
5. **Retrofit into docs** — "Drop the script tag into a third-party-looking docs
   page. No other change."
   → `demo/retrofit/docs-page.html`

**Suggested ordering of the demo grid**: 1 Real-world → 2 Before/after → 3 Mixed →
4 Pre-loaded URL → 5 Retrofit → then the three slider deep-dives. Rationale:
real-world and before/after are the most persuasive "first click" demos; the slider
deep-dives are reference material for someone who has already decided to look closer.

The on-page three-table comparison ("Tables on this page") stays as is — it remains
the fastest way to A/B Grid-Sight on the landing page itself.

## Shared infrastructure

Add `public/demo/_shared/`:

- `nav.html` — a fragment containing the cross-demo nav, included by each new page
  via a small inline `<script>` `fetch()`-then-inject pattern *only* when the page is
  served over `http(s)://`; under `file://` each page falls back to a hard-coded
  inline nav (constitution §VI — offline-first). Simpler alternative: copy-paste the
  nav into each page. **Recommendation**: copy-paste. The inclusion machinery is not
  worth a runtime branch; five pages of duplicated `<nav>` markup is cheaper to
  maintain than a fetch fallback.
- `demo.css` — shared styles: `.demo-nav`, `.callout`, `.callout-leader`, `.banner`,
  `.docs-page` (the retrofit page's serif palette is scoped here so it does not leak).
  Linked by `<link rel="stylesheet">` from each new page; the retrofit page also
  adds its own override block.
- `data/` — optional. If the atmosphere table is hand-typed into the HTML it stays
  in the page; if it grows past ~30 rows it moves to `data/atmosphere.json` and is
  hydrated by a tiny inline `<script>` *for the http(s) case only*, with the JSON
  also inlined into a `<script type="application/json">` for the `file://` case.
  **Recommendation**: inline directly into the HTML. Avoids the dual-load branch.

Net new shared files: `public/demo/_shared/demo.css` only.

## Out-of-scope / future

- Telemetry, A/B testing, page-view counters.
- Image, GIF, or video tours.
- A "playground" page where the viewer pastes their own HTML table.
- A Storybook-hosted version of these demos. The Storybook stories already cover
  individual components; the demos are intentionally raw HTML.
- Multi-language / i18n versions of the demos.
- A "compare two Grid-Sight versions" page (would belong under a future
  `diff-compare` spec).

## Open questions

1. **Sort and filter lozenges are referenced in the before/after callouts and in the
   mixed demo, but only `002-sort` exists as a spec — `003-filter` is an empty
   directory and the user message references specs through `010-diff-compare` that
   are not in the tree.** If filter is not implemented by the time these demos ship,
   the mixed demo's Table B should drop the filter callout and rely on sort +
   categorical `#` only. Which features can we assume are live on the demo branch at
   merge time?
2. **Frequency-table popup on categorical `#`** — confirmed in the user message and
   in the README story, but I did not find a dedicated spec for it. Is it part of
   `006-cell-annotations`, a sub-feature of statistics, or unscoped?
3. **URL fragment format for the pre-loaded demo** — the user message proposes
   `#sl_atlantic=27.5,8400`. Is `sl_<tableId>=<col>,<row>` the canonical encoding
   from `specs/001-dynamic-sliders/contracts/public-api.md`, or should the demo use
   whatever format ships? If the format changes, the demo-home link must change in
   lockstep.
4. **Atmosphere-table source citation** — public-domain tables exist (ICAO 1993,
   NASA TM-X-74335), but should we cite a specific edition in the `<figcaption>` to
   pre-empt "where did these numbers come from"?
5. **Retrofit demo topic** — HTTP status codes is recommended above because it is
   universally legible and contains both categorical and numeric tables naturally.
   Alternative: a "PostgreSQL configuration parameter" reference. Preference?
