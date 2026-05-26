# Phase 0 Research: Cell Annotations Enrichment

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Input**: [spec.md](./spec.md), [plan.md](./plan.md),
`.specify/memory/constitution.md` v1.1.0

This document records the design decisions implied by the spec but not pinned
down: persistence model (now `localStorage`, not URL), row-key derivation,
popover reuse, marker styling, the cross-document popup + deep-link mechanism,
and the bundle budget. Each entry is Decision / Rationale / Alternatives
considered.

> **Direction change (2026-05-26)**: An earlier draft of this feature persisted
> annotations in the URL fragment (`gs.a`) for shareability. That was reversed by
> product decision: annotations now persist in `localStorage` only, and a new
> cross-document popup (with last-modified dates and click-to-open) replaces the
> earlier per-page panel. R-1, R-3, and R-6 below reflect the new model; the
> superseded `gs.a` URL codec is **not** built.

---

## R-1 — Persistence failure handling (`localStorage` unavailable / quota)

**Decision**: All `localStorage` access is wrapped in `try/catch`.

- **Unavailable** (private-mode block, `file://` null-origin quirk, disabled
  storage): annotating still works for the session (the in-memory
  `AnnotationStore`), nothing throws into the host page, and **one** non-blocking
  `console.warn` per page notes that annotations will not persist (FR-017,
  constitution §IV).
- **Quota exceeded** on save: the save is **refused** — popover stays open, an
  inline error renders ("Storage is full — delete an existing note to add a new
  one"), and the previously stored value is left untouched (FR-017). Saves that
  shrink or keep the payload (shortening/replacing/deleting) are always allowed.

**Rationale**: Progressive Enhancement (§IV) forbids breaking the host page when
an optional capability is missing. Refuse-and-warn keeps the user in control and
never silently destroys a colleague's earlier note. `localStorage` quota
(typically ~5 MB/origin) is far larger than any realistic annotation set, so the
quota path is a rare safety net rather than a routine concern.

**Alternatives considered**:

- *Throw on unavailable storage*: rejected — violates §IV.
- *Drop oldest to make room*: rejected — silent data loss with no meaningful
  "oldest" ordering.

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

All three segments are slugified to `[a-z0-9-]` and the triple is built once per
cell (memoised via a `WeakMap<HTMLTableCellElement, CellIdentity>`), so later
sort/filter passes that reorder rendered rows never change a note's key.

**Rationale**: FR-011/SC-004 demand notes follow the source cell across reorders,
so the visual `tBody.rows[i]` index must not be the key. The repo already
captures a load-time snapshot (`src/utils/original-order.ts`) and a column-key
slugger; the row-key mirrors the column-key heuristic (prefer a meaningful
header-ish value, fall back to index). A text-derived row-key also survives the
author moving a row in the page source better than a bare index.

**Alternatives considered**:

- *Bare visual row index*: rejected — breaks under sort/filter (violates SC-004).
- *Whole-row content hash*: rejected — changes on any cell edit, orphaning the
  note; heavier in bundle.
- *Require `data-gs-row-key`*: rejected as a hard requirement (violates §IV); it
  is the preferred source when present, with graceful fallbacks.

**Index-fallback fragility (FR-013)**: when `tableKey` falls back to the
document-order index, emit **one** `console.warn` per page (tracked by a
module-level `Set<string>` of warned tables).

---

## R-3 — Persistence: per-document `localStorage`, URL-free

**Decision**: Annotations persist to `localStorage` only. One key per document:

```text
gs:${origin + pathname}:annotations
```

reusing the `gs:` prefix and the per-URL-stem `urlStem()` / `storageKeyFor()`
derivation already in `src/utils/slider-persistence.ts` (export them if not
already exported). The value is a versioned envelope (full shape in
[`contracts/localstorage-schema.md`](./contracts/localstorage-schema.md)):

```jsonc
{ "version": 1, "title": "<document.title>", "entries": {
    "<tableKey>/<rowKey>/<columnKey>": { "t": "<text>", "m": <epochMs> } } }
```

`title` is stored so the cross-document popup can show a friendly document label
(falling back to the pathname). The URL fragment is **not** a persistence channel
(FR-019).

**Rationale**: A dedicated `annotations` suffix + envelope keeps the slider codec
(numeric positions, dual URL+`localStorage`) untouched while reusing its proven
stem/key helpers, so the two stores coexist under one consistent `gs:` scheme.
Per-document keying makes the cross-document scan (R-8) a simple key-prefix
enumeration. Storing the timestamp inline satisfies FR-018 with no extra
bookkeeping.

**Alternatives considered**:

- *Extend `slider-persistence.ts`*: rejected — different payload + the timestamp
  and URL-free rules make it a poor fit; would complicate the shared helper.
- *One global key for all documents*: rejected — couples unrelated pages, bloats
  every write, and complicates per-document load; per-document keys are the
  natural unit and make orphan cleanup local.

---

## R-4 — Popover editor reuses `installPopupChrome`

**Decision**: The annotation editor (`src/ui/annotation-popover.ts`) builds its
DOM (textarea + Save + Delete + inline-error region) and delegates focus trap,
Escape-to-close, outside-click dismiss, and positioning to the existing
`installPopupChrome(popup, anchorEl, focusables, onClose)` in
`src/ui/popup-chrome.ts` — the same helper used by `statistics-popup.ts` and the
filter popups. `focusables` is `[textarea, saveBtn, deleteBtn]`; focus lands in
the textarea on open (FR-006). Escape closes **without** saving. The anchor is
the cell, so block-level cell content still anchors correctly (spec edge case).

**Rationale**: Reusing the chrome guarantees the keyboard contract (FR-006) is
identical to the rest of the library, costs ~0 bundle, and avoids re-deriving a
focus trap.

**Alternatives considered**:

- *Native `<dialog>`*: rejected — modal semantics wrong for a cell-anchored inline
  editor; anchored positioning is manual anyway.
- *Bespoke popover*: rejected — duplicates `popup-chrome.ts`, risk of diverging
  keyboard behaviour.

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
distinguishable in monochrome (FR-025, §III). The cell gets `position: relative`
only while Grid-Sight is enabled, restored on `tearDown`.

**Rationale**: JS-injected styles are mandatory because `src/style.css` is not
shipped in the IIFE. A pure-CSS triangle keeps bundle and DOM minimal and needs
no external icon (§VI). Shape-not-just-colour satisfies the accessibility hard
minimum.

**Alternatives considered**:

- *SVG icon node per cell*: rejected — heavier DOM at 50+ markers; CSS triangle is
  free and scales.
- *Inline-styling each cell*: rejected — harder to tear down cleanly (residue),
  violates the byte-identical-toggle-off constraint.

---

## R-6 — Cross-document annotations popup (P3, replaces the per-page panel)

**Decision**: The "Show annotations" entry is added to the existing GS surface
and appears **only when ≥ 1 annotation exists for the current origin** (FR-020).
Selecting it opens a popup (`src/ui/annotation-popup.ts`) backed by the
cross-document index (R-8): every note grouped by document, each entry showing
the document label (`title` || pathname), the column/cell context, truncated note
text, and the last-modified date. Activating an entry (click / Enter):

- **Same document** → `cell.scrollIntoView({ block: 'center' })`, then toggle a
  short-lived `gs-annotation-marker--pulse` class for ≥ 1 animation frame
  (FR-021).
- **Different document, same origin** → navigate to that document's URL with a
  transient `#gs.annot=<triple>` fragment hint; on load the annotations module
  reads the hint, resolves the cell, scrolls + pulses, then **clears** the hint
  via `history.replaceState` so it does not persist (FR-019, FR-021, SC-006).

Arrow keys move between entries, Enter activates, Escape closes (FR-022). Empty
index → single empty-state message, no list items (US3 AC-4).

**Rationale**: The product decision is a site-wide discovery view, not just the
current page. Reusing the GS surface honours the "no new top-level chrome"
assumption. The transient fragment hint is the minimal cross-document deep-link
mechanism that needs no persistence and no server.

**Alternatives considered**:

- *Per-page-only panel (the earlier design)*: superseded — does not satisfy the
  "see annotations across documents" requirement.
- *Encode the target cell in `localStorage` "pending navigation"*: rejected — a
  URL hint is simpler, self-clearing, and survives the navigation naturally.
- *Always-visible menu entry*: rejected — FR-020 gates visibility on existence.

---

## R-7 — Bundle budget feasibility (SC-005 ≤ 2 KB gzipped)

**Decision**: Treat ≤ 2 KB gzipped net delta as a hard gate, measured each PR by
`scripts/bundle-size.js`. Rough breakdown: identity ~0.3 KB, `localStorage` codec
~0.4 KB, cross-document index ~0.3 KB, affordance+marker+styles ~0.6 KB, popover
(chrome reused) ~0.4 KB, popup ~0.5 KB — tight but feasible by reusing
`installPopupChrome`, `colKey`, `storageKeyFor`, and the style-injection helpers.

**Rationale**: The 002-003 feature landed sort+filter+pipeline+codec inside a
2 KB net budget by reusing shared chrome; this feature reuses comparably. If a
draft exceeds it, the popup (P3) is the first candidate to trim/defer.

**Alternatives considered**:

- *No explicit budget*: rejected — §I requires the ≤ 10 KB ceiling be defended per
  PR; a per-feature sub-budget surfaces regressions early.

---

## R-8 — Cross-document index from a `localStorage` key scan

**Decision**: `src/enrichments/annotation-index.ts` builds the popup's view model
by enumerating `localStorage` (`localStorage.length` + `localStorage.key(i)`),
selecting keys matching `^gs:.*:annotations$`, parsing each versioned envelope,
and flattening to a list grouped by document. Each entry retains the document URL
(reconstructed from the key's stem), the identity triple, the text, and the
timestamp. Malformed/legacy envelopes are skipped. The build is on-demand (popup
open), so it never runs on the hot load path.

**Rationale**: Per-document keys (R-3) make this a cheap prefix scan with no
global index to keep in sync. Doing it lazily on popup-open keeps SC-002 (load
paint) unaffected. The key embeds `origin + pathname`, so the document URL for
navigation is recoverable directly from the key — no extra stored URL needed
(though `title` is stored for a friendly label).

**Constraint surfaced**: `localStorage` is **per-origin**, so the index only ever
sees the current origin's annotations (spec edge case "Cross-origin scope");
cross-origin aggregation is impossible without a server and is out of scope.

**Alternatives considered**:

- *Maintain a separate global manifest key*: rejected — extra write on every
  save, risk of drift vs. the per-document keys; the scan is simpler and correct
  by construction.

---

## Resolved unknowns summary

| Item | Status |
|------|--------|
| Persistence model | ✅ Resolved (R-3: per-document `localStorage`, URL-free) |
| Storage failure / quota handling | ✅ Resolved (R-1: graceful degrade + refuse-and-warn) |
| Row-key derivation (spec left open) | ✅ Resolved (R-2) |
| Popover implementation | ✅ Resolved (R-4: reuse `installPopupChrome`) |
| Marker/affordance styling + a11y | ✅ Resolved (R-5) |
| Cross-document popup + deep-link | ✅ Resolved (R-6, R-8) |
| Bundle budget | ✅ Resolved (R-7: ≤ 2 KB gzipped gate) |

No remaining `NEEDS CLARIFICATION`. Cleared to proceed to Phase 1.
