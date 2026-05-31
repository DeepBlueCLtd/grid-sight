# Contract — Welcome Page (`public/index.html`)

Structure and behaviour the rewritten welcome page MUST satisfy. This is a
content/markup contract (no bundled runtime surface). Verified by Playwright
(`e2e/welcome-per-table.spec.ts`) and by manual review.

## Page order (top → bottom)

1. **Hero + principles** (FR-001, FR-002)
   - One-sentence plain-language statement of what Grid-Sight is.
   - The problem it solves: enrich existing HTML tables in place, no rebuild.
   - Principles, each in plain language: offline / air-gapped · zero runtime
     dependencies · progressive enhancement · accessibility by default ·
     read-only / byte-identical teardown.
   - Readable with Grid-Sight disabled (the intro does not depend on any table).

2. **Four feature sections** (FR-003, FR-004, FR-005, FR-006, FR-007, FR-008)
   Each section:
   - Heading + narrative explaining the feature area in warm, technical-but-plain
     language.
   - ≥ 1 **live** sample table addressed by `id` and configured via
     `pageConfig.tables` to offer that area's enrichment(s).
   - DOM order is **narrative then table**; visual side **alternates** between
     consecutive sections via CSS only (tab/read order stays logical).
   - Collapses to a single column under a mobile-width `@media` breakpoint with
     no horizontal overflow.
   - Links to the related existing demo page(s) for that area.
   Areas: (a) Sliders & interpolation; (b) Visual analysis — heatmap, outlier,
   statistics, summary row; (c) Navigation & search — sort, filter, find,
   freeze panes; (d) Derived data & notes — virtual columns Σ/⌇/Δ, annotations.

3. **Global toggle, explained** (FR-009, FR-010)
   - Retains the "Grid-Sight enabled on this page" control.
   - Narrative frames it as a non-destructive overlay: off ⇒ original tables
     restored; on ⇒ re-enriched. Toggling does not reload the page.

4. **Start-state demonstration** (FR-011)
   - At least one inline table loads with its GS toggle **active** (enrichments
     revealed) and at least one loads **inactive** (default), shown so the
     contrast is visible; the visitor can flip either in place.

5. **All-demos index** (FR-012)
   - Links to all 12 existing demo pages; none orphaned.

## Behavioural requirements

- **Offline (FR-013, SC-007)**: page + IIFE + every inline demo function from a
  `file://` load; no network requests at runtime (no fetched fonts/icons).
- **Distinct sets co-resident (SC-005)**: at least two inline tables
  simultaneously expose **different** enrichment sets, driven solely by
  `pageConfig.tables`.
- **Reference "before" table**: a plain table marked `data-gs-ignore` remains
  raw regardless of any selector (illustrates opt-out; INV-5).
- **Slider formula**: the sliders demo registers its formula once the IIFE loads
  (as the current page does).

## Accessibility (constitution §III)

- Sections use semantic headings/landmarks; alternation is CSS `order` only so
  the accessibility tree follows DOM order.
- The GS toggle stays a keyboard-operable `<button>` with correct `aria-expanded`
  in both start-states.
- No colour-only signals introduced by the page chrome.

## Out of scope

- No new enrichment types; no scrollytelling/sticky JS (alternating rows chosen).
- No change to the existing demo pages themselves (only linked).
