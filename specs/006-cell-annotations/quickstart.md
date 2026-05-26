# Quickstart: Cell Annotations

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Audience**: a contributor verifying the feature, or an author embedding
Grid-Sight who wants annotations to behave well on their tables.

Goal: annotate a cell, confirm the marker + popover + `aria-describedby`, and
prove the note round-trips through the URL on a clean profile — in under 5
minutes.

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

Expected: popover closes, a tinted corner triangle appears on the cell, and the
URL gains `#...gs.a=sales/acme/q3:check%20with%20finance`. Hover the marker → the
note shows in a tooltip (ellipsis-truncated if long).

Re-open by clicking the marker → textarea shows the saved text, **Delete**
enabled. Click **Delete** → marker and `aria-describedby` disappear, `gs.a` entry
removed.

---

## 3. Verify accessibility (constitution §III)

- The pin affordance is reachable by Tab and activates on Enter/Space.
- In the popover: focus lands in the textarea; Tab → Save → Delete; **Escape**
  closes without saving.
- On an annotated cell: `cell.getAttribute('aria-describedby')` references a node
  whose text is the note (FR-022). Confirm in DevTools / a screen reader.
- The corner triangle is a **shape**, not just a colour — visible in a
  monochrome/grayscale simulation (FR-024).

---

## 4. Share via URL on a clean profile (US2 — SC-003)

1. Annotate 3 cells. Copy the full URL (including the `#...gs.a=...`).
2. Open it in a **private/incognito** window.

Expected: all 3 markers render in the same cells within one frame, popover
content matches — and **no `localStorage` value was read or written** (FR-018,
SC-003). Verify with `Object.keys(localStorage).filter(k => k.startsWith('gs:'))`
showing no annotations key, and DevTools → Application → Storage being empty for
the origin on first paint.

A `gs.a` entry pointing at a row/column that no longer exists is silently
dropped — the page still loads cleanly (US2 AC-2).

---

## 5. Survive sort / filter (SC-004)

1. Annotate `Acme · Q3`.
2. Sort the Q3 column descending so rows reorder.

Expected: the marker stays on the **Acme** cell (its source cell), not on
whatever row is now in Acme's old position. Annotations are keyed by the
`(table-key, row-key, column-key)` identity triple, never by visual position.

---

## 6. Annotations panel (US3 — P3)

1. Annotate cells in 2–3 tables on a long page.
2. Open **Show annotations** from the GS menu (entry appears only when ≥ 1 note
   exists).

Expected: every note is listed with `Table › Column — text` and truncated
preview. Click an entry → the page scrolls the cell into view and its marker
pulses briefly. Arrow keys move between entries, Enter activates, Escape closes.
With no notes, the menu entry is absent; opening an empty panel (if forced) shows
a single empty-state message.

---

## 7. Author opt-out

Add `data-gs-no-annotate` to a `<table>` or a `<td>`/`<th>` to suppress the
affordance there; any `gs.a` entry targeting it is ignored. `data-gs-ignore`
(the existing whole-table opt-out) has the same effect.

Tables without an `id`, `<caption>`, or `data-gs-key` still work but fall back to
an index-based table key — Grid-Sight logs **one** console warning per page
noting those annotations are fragile if the source HTML is later edited. Add a
`data-gs-key` (and optionally `data-gs-row-key` on rows) to make them robust.

---

## Test entry points (for contributors)

- `yarn test` — Vitest: identity triple, `gs.a` codec, 280-char clamp, 8 KB cap,
  opt-out/orphan drops.
- `yarn test:storybook` — affordance reveal, popover keyboard contract, marker,
  panel navigation.
- `yarn test:e2e` — `annotations.spec.ts`, `annotations-url.spec.ts` (clean
  profile), `annotations-reorder.spec.ts`, `annotations-panel.spec.ts`.
- `yarn build` — `scripts/bundle-size.js` checks the IIFE stays ≤ 10 KB gzipped;
  this feature's net delta target is ≤ 2 KB (SC-005).
