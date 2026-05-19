# Quickstart: Configure Which Enrichments Show On Your Page

**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md) · **Date**: 2026-05-19

This walks a document author from "I want only heatmap + sliders on this page"
to a working page in under five minutes. Two paths are shown — declarative
HTML for the IIFE drop-in, and ESM for build-system consumers — followed by
the opt-in runtime toggle panel.

---

## Path A — `<script>` drop-in (no build step)

### Step 1 — include the bundle (unchanged)

```html
<script src="/path/to/grid-sight.iife.js"></script>
```

### Step 2 — declare the enrichments your page wants

Add a `<script>` block **before** the bundle (or anywhere before
`gridSight.init()` runs). The order doesn't matter as long as it executes
first.

```html
<script>
  window.gridSight = window.gridSight || {};
  window.gridSight.pageConfig = {
    enrichments: ['heatmap', 'sliders', 'statistics'],
  };
</script>
```

That's it. When `init()` runs, the lozenge cluster on every qualifying header
will show **only** the heatmap, slider, and statistics lozenges. The sort,
filter, frequency, outlier, sparkline, annotations, units-toggle, cumulative,
copy-as-csv, and diff-compare lozenges stay absent — no menu items, no DOM,
no overhead.

### Step 3 — verify

Load the page, click the **GS** master toggle on any table, and confirm the
lozenge cluster on each header contains exactly the three ids you listed.

### Common variations

**Show everything except one enrichment**: list the rest. The config replaces
the defaults; there's no subtractive shortcut by design (see FR-005 — the
intent is that "what's on this page" is immediately readable).

```html
<script>
  window.gridSight = { pageConfig: {
    enrichments: ['heatmap', 'sliders', 'slider-threshold', 'statistics',
                  'frequency', 'frequency-chart', 'sort', 'filter',
                  'outlier', 'sparkline', 'annotations', 'units-toggle',
                  'cumulative', 'copy-as-csv'],
  } };
</script>
```

**Strip every enrichment** (keep just the GS toggle):

```html
<script>
  window.gridSight = { pageConfig: { enrichments: [] } };
</script>
```

The master GS button still appears; clicking it does nothing visible because
no enrichment is registered to draw on the headers.

**Forward-compatible reference** to an enrichment your build doesn't have yet:

```html
<script>
  window.gridSight = { pageConfig: {
    enrichments: ['heatmap', 'sliders', 'future-thing-not-shipped-yet'],
  } };
</script>
```

The unknown id is ignored silently — the page works today, and the day the
new enrichment ships it picks up automatically without an HTML edit.

---

## Path B — npm / ESM consumers

```ts
import gridSight from '@deepbluec/grid-sight';

gridSight.init({
  enrichments: ['heatmap', 'sliders', 'statistics'],
  // …any other existing init options you already pass…
});
```

Both fields are optional; omit either and you get the default behaviour for
that field. If you also set `window.gridSight.pageConfig` in HTML, the values
you pass to `init()` win on a per-field basis.

---

## Path C — runtime visitor toggle panel (opt-in)

Want a panel where the visitor can flip enrichments on and off live? Two ways
to opt in:

### C1 — Flag in the page config

```html
<script>
  window.gridSight = { pageConfig: {
    enrichments: ['heatmap', 'sliders', 'sort'],
    showToggleUi: true,
  } };
</script>
```

The panel mounts top-right of the viewport. Tick / untick a row and the
lozenges on every table update within one animation frame. Toggling off an
enrichment that is currently in use (e.g. a heatmap painted on the table) also
cleans up that live instance — no orphan DOM.

### C2 — Declarative container

If you want to control where the panel renders, put an empty container
anywhere in your page:

```html
<aside>
  <h3>Live toolkit</h3>
  <div data-gs-toggle-panel></div>
</aside>
```

The presence of `[data-gs-toggle-panel]` is itself an opt-in — you don't need
`showToggleUi: true` if you've placed the container. The panel mounts into
your container at its natural flow position.

### What the visitor sees

```text
┌─ Grid-Sight enrichments ─────────────┐
│ [✓] Heatmap            (heatmap)     │
│ [✓] Sliders            (sliders)     │
│ [ ] Threshold slider   (slider-…)    │
│ [ ] Statistics popup   (statistics)  │
│ [ ] Frequency table    (frequency)   │
│ [ ] Sort               (sort)        │
│ …                                    │
└──────────────────────────────────────┘
```

- Every enrichment your build knows is listed (not just the ones currently
  enabled — the panel is the full menu).
- Checked rows are the current effective set.
- The visitor's choices persist for them on this page: the chosen set rides
  in the URL fragment (`#gs.e=...`) for bookmarking, and falls back to
  `localStorage` for next-visit-on-this-machine.

---

## What about per-table differences?

The config is **per-page**, not per-table. If two tables on one page need
different enrichment sets, you have two simple options:

1. Mark the table you want untouched with `data-gs-ignore` (existing
   attribute). It gets no GS toggle at all.
2. Split the tables across two pages, each with its own `pageConfig`.

A per-table override (e.g. `data-gs-enrichments` on `<table>`) is intentionally
out of scope for this feature.

---

## Cheat sheet — known enrichment ids

Copy from this list:

| Id | What it does |
|---|---|
| `heatmap` | Colour-codes cells by value |
| `sliders` | Interpolating row/column sliders |
| `slider-threshold` | Fade cells below a threshold on a heatmap |
| `statistics` | Per-column / per-row stats popup (numeric `#`) |
| `frequency` | Frequency table popup (categorical `#`) |
| `frequency-chart` | Frequency chart popup (categorical) |
| `sort` | Click-to-sort lozenge (spec 002 — shipping) |
| `filter` | Per-column filter (spec 003) |
| `outlier` | Outlier marker (spec 004) |
| `sparkline` | Row sparkline (spec 005) |
| `annotations` | Per-cell annotations (spec 006) |
| `units-toggle` | Unit conversion toggle (spec 007) |
| `cumulative` | Running-total column (spec 008) |
| `copy-as-csv` | Copy table as CSV/TSV/Markdown (spec 009) |
| `diff-compare` | Diff two rows or two columns (spec 010) |

For an always-current list at runtime:

```js
console.log(window.gridSight.enrichmentIds);
```

---

## Troubleshooting

**"I listed `sort` but the lozenge doesn't appear."** Either:

- The sort enrichment hasn't shipped yet (it's spec-only on this branch — the
  registry knows the id so your config is forward-compatible, but there's no
  implementation to show), or
- Your table has no qualifying column for sort. Like every existing
  enrichment, sort only shows on columns it can act on.

**"I see lozenges I didn't list."** Check that no parent script overwrites
`window.gridSight.pageConfig` after yours. The library reads it once, at init
time; the last write before init wins.

**"The toggle panel doesn't appear."** Confirm either:

- `pageConfig.showToggleUi === true`, **or**
- The page has a `[data-gs-toggle-panel]` element.

Either one opts in. If both are absent, the panel is intentionally suppressed.

**"My visitor's toggle choices stuck across pages."** Each page has its own
persisted set, keyed by `location.origin + location.pathname`. Two different
URLs are two different sets. Clear via `localStorage.removeItem(
'gridsight:<url-stem>:enrichments')` for that page if needed.

---

## What's next

- Read the **full spec** at [`./spec.md`](./spec.md) for the formal
  requirements, edge cases, and success criteria.
- See the **plan** at [`./plan.md`](./plan.md) for the implementation
  structure.
- See the **runtime-panel demo** at `public/demo/toggle/live-enrichments.html`
  (added by this feature) for a working example you can copy.
