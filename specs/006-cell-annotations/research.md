# Phase 0 Research: Cell Annotations Enrichment

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Input**: [spec.md](./spec.md), [plan.md](./plan.md),
`.specify/memory/constitution.md` v1.1.0

This document resolves the one spec-level `NEEDS CLARIFICATION` (FR-017) and the
open design decisions implied by the spec but not pinned down (row-key
derivation, popover reuse, panel surface, styling, bundle budget). Each entry is
Decision / Rationale / Alternatives considered.

---

## R-1 — URL-overflow policy (resolves FR-017 NEEDS CLARIFICATION)

**Decision**: **Refuse-and-warn.** When persisting a new annotation would push
the `gs.a` fragment past **8 KB**, `annotations.ts` rejects the save, leaves the
popover open, and renders an inline error in the popover ("URL is full — delete
an existing note to add a new one"). Existing annotations are never dropped or
truncated. Edits that shrink or keep the payload the same size are always
allowed (so a user can shorten an existing note even at the cap).

**Rationale**: The spec's bracketed question asks whether "drop oldest" is
preferable. Silently dropping a colleague's earlier note to make room for a new
one is data loss the user didn't consent to, and annotations have no recency
ordering that makes "oldest" obviously the right victim. Refuse-and-warn keeps
the user in control and is trivially reversible (delete a note, then re-save).
The 8 KB cap is itself generous — ~50 notes of ~150 chars fit comfortably — so
hitting it is rare.

**Alternatives considered**:
- *Drop oldest automatically*: rejected — silent data loss, no stable notion of
  "oldest" since the set is a map, not a log.
- *No cap*: rejected — over-long fragments break in mail clients/chat and some
  browsers truncate the hash; the cap is what keeps shared URLs paste-able
  (spec Assumptions).

---

## R-2 — Cell identity triple, especially row-key derivation

**Decision**: Annotations are keyed by `(tableKey, rowKey, columnKey)` derived
from the **load-time source DOM**, never from post-sort visual position.

- **tableKey** (fixed by FR-010, in preference order): explicit `data-gs-key`
  → table `id` → trimmed `<caption>` text (slugified) → document-order table
  index `t{n}`.
- **columnKey**: reuse `colKey(header, columnIndex)` from
  `src/utils/view-state-url.ts` (slug of the header cell text, falling back to
  `c{index}`). No new code.
- **rowKey** (the gap the spec leaves to design): explicit `data-gs-row-key` on
  the `<tr>` → slug of the row's first cell (`<th scope="row">` or first
  `<td>`) text → document-order data-row index `r{n}` captured at load time.

All three segments are slugified to `[a-z0-9-]` and the whole triple is built
once per cell at first annotation and stored, so subsequent sort/filter passes
that reorder rendered rows do not change a note's key.

**Rationale**: FR-011/SC-004 demand that notes follow the source cell across
reorders. Visual `tBody.rows[i]` index is unstable under sort/filter, so it must
not be the key. The repo already captures a load-time snapshot
(`src/utils/original-order.ts`) and a column-key slugger; row-key mirrors the
column-key heuristic (prefer a meaningful header-ish value, fall back to index).
A text-derived row-key survives source row reordering in the *page source* (e.g.
the author edits the HTML and moves a row) better than a bare index, which is
why it is preferred over the index when available.

**Alternatives considered**:
- *Bare visual row index*: rejected — breaks under sort/filter (violates SC-004).
- *Whole-row content hash*: rejected — changes whenever any cell in the row is
  edited, orphaning the note on a trivial source change; heavier in bundle.
- *Require authors to add `data-gs-row-key`*: rejected as a hard requirement —
  violates Progressive Enhancement; instead it is the *preferred* source when
  present, with graceful fallbacks.

**Index-fallback fragility (FR-013)**: When `tableKey` falls back to the
document-order index (no `data-gs-key`/`id`/`caption`), Grid-Sight emits **one**
non-blocking `console.warn` per page noting that annotations on that table are
fragile under source edits. One warning per page (not per cell) — tracked by a
module-level `Set<tableKey>` of already-warned tables.

---

## R-3 — Persistence: new `gs.a` codec, URL-only

**Decision**: Add a dedicated `gs.a` fragment parameter with its own codec
(`src/enrichments/annotation-persistence.ts`), co-existing with `gs.s`/`gs.e`/
`gs.v`. Read/write use the same `&`-split, preserve-other-params,
`history.replaceState(... location.pathname + location.search + newHash)`
discipline as `slider-persistence.ts` and `view-state-url.ts`. **No**
`localStorage`/`sessionStorage`/cookies (FR-018).

Payload grammar (full schema in `contracts/url-fragment-schema.md`):
`gs.a=<tableKey>/<rowKey>/<colKey>:<encodeURIComponent(text)>` entries joined by
`,`. Decoding silently skips any entry whose triple resolves to a missing
table/row/column (FR-016) or to an opted-out target (FR-012).

**Rationale**: Annotations carry free-text values and an explicit no-`localStorage`
requirement, so overloading `slider-persistence.ts` (numeric positions, dual
URL+`localStorage` writes) would force awkward branching. A sibling codec keeps
each module simple and matches the precedent already set by `view-state-url.ts`
having its own `gs.v` codec separate from `gs.s`. The write-back helper pattern
(filter out the old `key=`, push the new one, rebuild `#a&b&c`) is copied so the
four parameters never clobber each other.

**Alternatives considered**:
- *Extend `slider-persistence.ts`*: rejected — different payload shape + the
  no-`localStorage` rule make it a poor fit; would complicate the shared helper.
- *Single combined `gs` blob*: rejected — would couple unrelated features and
  break the established one-param-per-concern convention.

---

## R-4 — Popover editor reuses `installPopupChrome`

**Decision**: The annotation editor (`src/ui/annotation-popover.ts`) builds its
DOM (textarea + Save + Delete + inline-error region) and delegates focus trap,
Escape-to-close, outside-click dismiss, and positioning to the existing
`installPopupChrome(popup, anchorEl, focusables, onClose)` in
`src/ui/popup-chrome.ts` — the same helper used by `statistics-popup.ts` and the
filter popups. `focusables` is `[textarea, saveBtn, deleteBtn]`; focus lands in
the textarea on open (FR-006). Escape closes **without** saving.

**Rationale**: Reusing the chrome guarantees the keyboard contract (FR-006) is
identical to the rest of the library, costs ~0 bundle, and avoids re-deriving a
focus trap. The anchor is the cell (`<td>`/`<th>`), not the inner content, so
block-level cell content (lists/images) still anchors correctly (spec edge case).

**Alternatives considered**:
- *Native `<dialog>`*: rejected — modal semantics are wrong for a cell-anchored
  inline editor, and positioning relative to an anchor is manual anyway.
- *Bespoke popover*: rejected — duplicates `popup-chrome.ts`, more bundle, risk
  of diverging keyboard behaviour.

---

## R-5 — Affordance + marker as injected CSS, distinct in monochrome

**Decision**: Inject one `<style data-gs-annotation-styles>` block via an
idempotent `ensureAnnotationStyles()` (the repo convention from
`row-visibility-styles.ts`/`slider-styles.ts`). The hover/focus **affordance** is
a small corner pin `<button>` revealed by `:hover`/`:focus-within` on the cell;
the persistent **marker** is a CSS corner triangle (`::after` on the cell, or a
small absolutely-positioned glyph element) shown whenever the cell has a saved
note, independent of hover. The marker carries a discernible accessible name
("Annotated cell — click to view note") and a non-colour shape so it is
distinguishable in monochrome (FR-024, §III). The cell gets `position: relative`
only while Grid-Sight is enabled, restored on `tearDown`.

**Rationale**: JS-injected styles are mandatory because `src/style.css` is not
shipped in the IIFE (only the dev entry loads it). A pure-CSS triangle keeps
bundle and DOM minimal and needs no external icon (§VI). Shape-not-just-colour
satisfies the accessibility hard minimum.

**Alternatives considered**:
- *SVG icon node per cell*: rejected — heavier DOM at 50+ markers, marginal
  bundle cost; CSS triangle is free and scales.
- *Inline-styling each cell*: rejected — harder to tear down cleanly (residue),
  violates the byte-identical-toggle-off constraint.

---

## R-6 — Annotations panel reuses the GS surface (P3)

**Decision**: The "Show annotations" entry is added to the existing GS
menu/lozenge surface and appears **only when ≥ 1 annotation exists on the page**
(FR-019). Selecting it opens a single page-level panel
(`src/ui/annotation-panel.ts`) listing every note grouped by table, each entry
showing table identifier + column header + truncated note text. Clicking/Enter
on an entry calls `cell.scrollIntoView({block:'center'})` then toggles a
short-lived `gs-annotation-marker--pulse` class for ≥ 1 animation frame (FR-020).
Arrow keys move between entries, Enter activates, Escape closes (FR-021). Empty
state shows one message, no list items (US3 AC-3).

**Rationale**: The spec mandates reuse of the existing GS surface and no new
top-level chrome (Assumptions). Gating visibility on note-count keeps the menu
uncluttered when the feature is unused. The panel is a pure read/navigate view
over the same in-memory store the affordance/popover mutate, so it needs no
separate state.

**Alternatives considered**:
- *Always-visible panel entry*: rejected — clutters the menu when no notes
  exist; FR-019 explicitly gates on existence.
- *Separate floating toolbar*: rejected — introduces new top-level UI chrome the
  Assumptions forbid.

---

## R-7 — Bundle budget feasibility (SC-005 ≤ 2 KB gzipped)

**Decision**: Treat ≤ 2 KB gzipped net delta as a hard gate, measured each PR by
`scripts/bundle-size.js`. Estimated breakdown: identity+codec ~0.5 KB, affordance
+marker+styles ~0.6 KB, popover (chrome reused) ~0.4 KB, panel ~0.5 KB. Reusing
`installPopupChrome`, `colKey`, and the style-injection helpers is what keeps it
inside budget.

**Rationale**: The 002-003 feature (sort+filter+pipeline+codec) landed inside a
2 KB net budget by reusing shared chrome; this feature is smaller in surface and
reuses more, so 2 KB is realistic. If a draft exceeds it, the panel (P3) is the
first candidate to trim/defer since it is the lowest-priority layer.

**Alternatives considered**:
- *No explicit budget*: rejected — constitution §I requires the ≤ 10 KB ceiling
  be defended per PR; a per-feature sub-budget makes regressions visible early.

---

## Resolved unknowns summary

| Item | Status |
|------|--------|
| FR-017 URL-overflow policy | ✅ Resolved (R-1: refuse-and-warn) |
| Row-key derivation (spec left open) | ✅ Resolved (R-2) |
| Persistence module shape | ✅ Resolved (R-3: dedicated `gs.a` codec, URL-only) |
| Popover implementation | ✅ Resolved (R-4: reuse `installPopupChrome`) |
| Marker/affordance styling + a11y | ✅ Resolved (R-5) |
| Panel surface + behaviour | ✅ Resolved (R-6) |
| Bundle budget | ✅ Resolved (R-7: ≤ 2 KB gzipped gate) |

No remaining `NEEDS CLARIFICATION`. Cleared to proceed to Phase 1.
