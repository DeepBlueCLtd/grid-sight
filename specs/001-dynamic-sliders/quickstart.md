# Quickstart: Dynamic Sliders in 5 Minutes

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

This guide shows a host page author how to wire dynamic sliders onto an existing
HTML table once Grid-Sight is loaded. No build step required.

---

## 1. Include Grid-Sight (offline-friendly)

Drop the IIFE bundle next to your HTML and reference it locally:

```html
<script src="grid-sight.iife.js"></script>
```

No network access is required — works from `file://` and from air-gapped servers
(constitution §VI).

## 2. Mark up a numeric lookup table

Sliders attach only to axes whose headers are all numeric and strictly monotonic:

```html
<table id="atlantic">
  <tr><th></th>  <th>10</th><th>20</th><th>30</th><th>40</th><th>50</th></tr>
  <tr><th>1000</th><td>4.2</td><td>5.1</td><td>5.9</td><td>6.4</td><td>6.7</td></tr>
  <tr><th>6000</th><td>3.6</td><td>4.4</td><td>5.0</td><td>5.5</td><td>5.8</td></tr>
  <tr><th>11000</th><td>3.0</td><td>3.7</td><td>4.2</td><td>4.6</td><td>4.9</td></tr>
</table>
```

## 3. Add a slider via the UI

1. Click the Grid-Sight toggle on the page.
2. Click the plus icon on the row-header axis.
3. Choose **Add slider**.

A continuous slider appears alongside the row axis. Drag it; the live readout
updates within one animation frame.

## 4. Or add a slider programmatically

```js
const tbl = document.getElementById('atlantic');
const rowSlider = window.gridSight.addSlider(tbl, 'row');
const colSlider = window.gridSight.addSlider(tbl, 'col');

console.log(rowSlider.position);  // continuous, e.g. 4123.7
rowSlider.setPosition(8500);       // moves DOM + readout + URL fragment
```

## 5. Sync sliders across tables (automatic)

Add a second table whose axis headers exactly match. Sliders on the matching axes
sync automatically — moving one moves the other:

```html
<table id="pacific">
  <tr><th></th>  <th>10</th><th>20</th><th>30</th><th>40</th><th>50</th></tr>
  <tr><th>1000</th> ... </tr>
  <tr><th>6000</th> ... </tr>
  <tr><th>11000</th> ... </tr>
</table>
```

To opt out of sync on a specific table:

```html
<table id="pacific" data-gs-no-sync>
  ...
</table>
```

## 6. Bookmark a state

Move the sliders. Notice the URL fragment update, e.g.
`page.html#gs.s=atlantic#row:0.42857,atlantic#col:0.20000`.

Copy the URL, paste it into a new tab — sliders restore to the same positions
(SC-003). No `localStorage` required for share-by-URL.

## 7. Show a formula alongside interpolation (Story 2)

Register a formula on a table. A second "From equation" readout appears
alongside "Interpolated":

```js
window.gridSight.registerFormula(tbl, (range, sl) => {
  // any pure JS function returning a number
  return 0.001 * range + 0.05 * sl;
});
```

To remove the formula:
```js
window.gridSight.clearFormula(tbl);
```

## 8. Heatmap interaction (Story 4)

If the table has heatmap colouring enabled (existing Grid-Sight feature) and you
add sliders to both axes, a marker overlay appears at the interpolated point and
moves with the sliders.

To add a threshold slider that fades cells below a chosen value:

```js
const t = window.gridSight.addThresholdSlider(tbl);
t.setPosition(4.0);  // fade cells whose value < 4.0
```

## 9. Remove all sliders

```js
window.gridSight.removeAllSliders(tbl);   // for one table
window.gridSight.removeAllSliders();       // for the whole page
```

The table returns to its original static appearance; persisted entries for the
removed sliders are pruned.

## 10. Keyboard operation

Sliders are fully keyboard-operable (constitution §III, FR-019):

| Key | Action |
|---|---|
| `←` / `→` | Step by 1% of range |
| `↓` / `↑` | Step by 1% of range |
| `Page Down` / `Page Up` | Step by 10% of range |
| `Home` / `End` | Jump to min / max |

Screen readers receive a polite live-region announcement on drag-end and (rate
limited) during continuous drag.

---

## Troubleshooting

- **"Add slider" not offered**: Headers on that axis are not all numeric, or the
  axis has only one value, or the headers are not monotonic. See FR-001.
- **Readout shows "—"**: Interpolation hit a missing or non-numeric cell. Fix the
  data or accept the gap; this is by design (edge case in spec).
- **Two tables not syncing**: Their axis headers do not match exactly (after
  number parsing) — or one of them carries `data-gs-no-sync`.
- **URL doesn't restore on bookmark**: Confirm the fragment (`#…`) is actually
  copied — many email clients strip fragments. The fragment is the source of
  truth; `localStorage` is the local fallback only.
