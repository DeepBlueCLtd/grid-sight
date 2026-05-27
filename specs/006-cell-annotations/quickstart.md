# Quickstart: Cell Annotations

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Audience**: a contributor verifying the feature, or an author embedding
Grid-Sight who wants annotations to behave well on their tables.

Goal: annotate a cell, confirm the marker + popover + `aria-describedby`, prove
the note survives a reload via `localStorage`, and jump to it from the
cross-document popup — in under 5 minutes.

---

## 1. Embed Grid-Sight (no build step)

```html
<script src="grid-sight.iife.js"></script>
<table id="sales">
  <caption>Sales</caption>
  <thead><tr><th>Region</th><th>Q3</th></tr></thead>
  <tbody>
    <tr><th scope="row">Acme</th><td>1200</td></tr>
    <tr><th scope="row">Globex</th><td>980</td></tr>
  </tbody>
</table>
<script>window.gridSight.init();</script>
```

`annotations` is on by default (`defaultOn: true`). Nothing else to configure.

---

## 2. Annotate a cell (US1, ≤ 3 interactions — SC-001)

1. Toggle Grid-Sight **on**.
2. Hover (or Tab to) a body cell — a pin affordance appears in a corner.
3. Click the pin → popover opens with an empty textarea, **Save**, **Delete**
   (Delete disabled, no note yet).
4. Type `check with finance`, click **Save**.

Expected: popover closes and a tinted corner triangle appears on the cell. Hover
the marker → the note shows in a tooltip (ellipsis-truncated if long).

Re-open by clicking the marker → textarea shows the saved text, **Delete**
enabled. Click **Delete** → marker and `aria-describedby` disappear.

---

## 3. Verify accessibility (constitution §III)

- The pin affordance is reachable by Tab and activates on Enter/Space.
- In the popover: focus lands in the textarea; Tab → Save → Delete; **Escape**
  closes without saving.
- On an annotated cell: `cell.getAttribute('aria-describedby')` references a node
  whose text is the note (FR-023). Confirm in DevTools / a screen reader.
- The corner triangle is a **shape**, not just a colour — visible in a
  monochrome/grayscale simulation (FR-025).

---

## 4. Persist across reload and session (US2 — SC-003)

1. Annotate 3 cells. **Reload** the page.

Expected: all 3 markers reappear on the same cells within one frame, popover
content matches (FR-015, SC-002). Persistence is `localStorage`, per document:

```js
// key scheme: gs:${origin+pathname}:annotations
Object.keys(localStorage).filter(k => k.endsWith(':annotations'))
// => ["gs:https://example.com/report:annotations"]
JSON.parse(localStorage.getItem('gs:https://example.com/report:annotations'))
// => { version:1, title:"…", entries:{ "sales/acme/q3": { t:"…", m: 17694… } } }
```

No network request is made on the persistence path (SC-003). A stored entry
pointing at a row/column that no longer exists is silently dropped on load — the
page still loads cleanly (US2 AC-2).

If `localStorage` is unavailable (private mode, some `file://` contexts),
annotating still works for the session and a single console warning notes that
notes won't persist (FR-017).

---

## 5. Survive sort / filter (SC-004)

1. Annotate `Acme · Q3`.
2. Sort the Q3 column descending so rows reorder.

Expected: the marker stays on the **Acme** cell (its source cell), not on
whatever row is now in Acme's old position. Annotations are keyed by the
`(table-key, row-key, column-key)` identity triple, never by visual position.

---

## 6. Cross-document annotations popup (US3 — P3)

1. Annotate a cell on `…/report-a` and another on `…/report-b` (same origin).
2. On either page, open **Show annotations** from the GS menu (the entry appears
   only when the origin has ≥ 1 annotation).

Expected: the popup lists notes from **both** documents, grouped by document,
each entry showing the document label, the column/cell context, the truncated
note text, and the **last-modified date**.

- Click an entry for the **current** document → the cell scrolls into view and
  its marker pulses briefly.
- Click an entry for the **other** document → the browser navigates to
  `…/report-b#gs.annot=<triple>`, and on load the target cell scrolls into view
  and pulses; the `#gs.annot` hint is then cleared from the URL (FR-021, SC-006).

Arrow keys move between entries, Enter activates, Escape closes. With no notes on
the origin, the menu entry is absent; an empty popup (if forced) shows a single
empty-state message.

Note: `localStorage` is per-origin, so the popup only ever lists annotations for
the **current site**; cross-origin notes are not visible (by design).

---

## 7. Author opt-out & robustness

Add `data-gs-no-annotate` to a `<table>` or a `<td>`/`<th>` to suppress the
affordance there; any stored note targeting it is ignored. `data-gs-ignore` (the
existing whole-table opt-out) has the same effect.

Tables without an `id`, `<caption>`, or `data-gs-key` still work but fall back to
an index-based table key — Grid-Sight logs **one** console warning per page
noting those annotations are fragile if the source HTML is later edited. Add a
`data-gs-key` (and optionally `data-gs-row-key` on rows) to make them robust.

---

## Test entry points (for contributors)

- `yarn test` — Vitest: identity triple, `localStorage` codec (envelope,
  round-trip, orphan/opt-out drops, quota-refuse, timestamp, session-only
  fallback), cross-document index, 280-char clamp.
- `yarn test:storybook` — affordance reveal, popover keyboard contract, marker,
  popup navigation (same-doc vs cross-doc).
- `yarn test:e2e` — `annotations.spec.ts`, `annotations-persist.spec.ts` (reload
  survives via `localStorage`), `annotations-reorder.spec.ts`,
  `annotations-popup.spec.ts` (cross-document navigate + scroll).
- `yarn build` — `scripts/bundle-size.js` checks the IIFE stays ≤ 10 KB gzipped;
  this feature's net delta target is ≤ 2 KB (SC-005).
