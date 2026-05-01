# Phase 1 Data Model: Dynamic Sliders

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-05-01

This document defines the in-memory entities Grid-Sight maintains while sliders are
active, plus the validation rules and state transitions that govern them. Storage
shapes (URL fragment, localStorage) are documented at the end.

---

## Entities

### `Slider`

A user-facing slider control bound to a single axis of a single table, OR to a
heatmap threshold.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Stable per (table, axis); used as the persistence key. |
| `tableId` | `string` | Reference to the host table (existing `data-gs-id`). |
| `kind` | `"axis" \| "threshold"` | Axis sliders interpolate; threshold sliders fade cells. |
| `axis` | `"row" \| "col" \| undefined` | Required when `kind === "axis"`; absent for threshold. |
| `min` | `number` | For axis: smallest header value. For threshold: min cell value. |
| `max` | `number` | For axis: largest header value. For threshold: max cell value. |
| `position` | `number` | Continuous in `[min, max]`. |
| `position01` | `number` | Cached `(position - min) / (max - min)` for persistence. |
| `syncKey` | `string \| null` | Auto-derived axis-header signature; null for threshold. |

**Validation rules**:
- `min < max`. Degenerate axes (single value) MUST NOT produce a slider (FR-001).
- `position` MUST be clamped to `[min, max]` on every update.
- `kind === "axis"` MUST have `axis` set; `kind === "threshold"` MUST NOT.
- `id` MUST be unique per page.

**State transitions**:
```
created  ──user moves──▶  dragging  ──drag end──▶  resting
created  ──user removes──▶ destroyed
dragging ──user removes──▶ destroyed   (cleanup safe mid-drag)
resting  ──URL change──▶ resting (position update only)
```

---

### `AxisBinding`

Connects an axis slider to the numeric headers on a table axis. Pure metadata —
the binding is computed once when the slider is created and cached.

| Field | Type | Notes |
|---|---|---|
| `axis` | `"row" \| "col"` | Which axis. |
| `headerValues` | `number[]` | Parsed numeric values, in document order. |
| `monotonicity` | `"increasing" \| "decreasing"` | Required; mixed → no binding (FR-001). |
| `unitSuffix` | `string \| null` | Stripped during parse, restored in readouts. |
| `cellMatrix` | `number[][]` | Numeric cell values for the table; sparse → `NaN`. |

**Validation rules**:
- `headerValues.length >= 2`.
- Sequence MUST be strictly monotonic (no equal adjacent values).
- `cellMatrix` rows match table rows; columns match table columns.

---

### `Readout`

A live-updating textual value derived from a slider's current position via either
data interpolation or a registered formula.

| Field | Type | Notes |
|---|---|---|
| `sliderId` | `string` | The driving slider. |
| `source` | `"interpolated" \| "equation"` | Labels the displayed value (FR-009). |
| `value` | `number \| null` | `null` when interpolation hits a missing cell. |
| `formattedValue` | `string` | `value` + axis unit suffix, or "—" when null. |
| `liveRegionPriority` | `"polite"` | `aria-live` value (FR-020). |

**Update rules**:
- Recomputed every animation frame during drag, but the AT live region is rate-limited
  to one announcement per 250 ms and one final announcement on drag-end (R-7).
- When `source === "equation"`, `value` is computed by calling a registered formula
  function with the slider's current position(s); if the formula throws, `value` is
  `null` and `formattedValue` is "—".

---

### `SyncKey`

A page-scoped identifier that groups axis sliders sharing a header signature.

| Field | Type | Notes |
|---|---|---|
| `key` | `string` | `JSON.stringify(parsedHeaderValues)` (R-4). |
| `members` | `Slider[]` | Every axis slider whose binding matches `key`. |
| `suppressed` | `boolean` | True if any member's host table has `data-gs-no-sync`. |

**Validation rules**:
- A slider is added to a sync group iff `kind === "axis"` AND its `AxisBinding`
  produces a matching `key`.
- When `suppressed` is true, the group exists but `members` operate independently.

**Sync transitions**:
```
1 member  ──new matching slider added──▶  N members (linked)
N members ──one slider position changes──▶ N positions updated atomically
N members ──data-gs-no-sync added at runtime──▶ N members (suppressed)
```

---

### `PersistedSliderState`

The serialisable slice of slider state written to the URL fragment and to
`localStorage`.

| Field | Type | Notes |
|---|---|---|
| `version` | `number` | Schema version (start at `1`). |
| `entries` | `Record<sliderId, position01>` | `position01` rounded to 5 decimals. |

**Resolution priority on load** (R-5):
1. URL fragment (`#gs.s=…`).
2. `localStorage[gs:<urlStem>:sliders]`.
3. Default = `0.5` (midpoint) for each registered slider.

**Write rules**:
- Every position change writes to BOTH the URL fragment (via `history.replaceState`)
  AND to `localStorage`. URL is the canonical surface; `localStorage` is the
  fallback for first-visit-after-share-of-stem-only.
- Removing a slider deletes its entry from both surfaces.

---

## Storage shapes

### URL fragment

```
#gs.s=<sliderId1>:<pos01>,<sliderId2>:<pos01>,...
```

- `sliderId` is URL-safe (`[a-zA-Z0-9_.-]+`); construction guarantees this.
- `pos01` is `0.00000`–`1.00000` with up to 5 decimals.
- Order is insertion order; reorder is non-semantic.
- A fragment containing only `gs.s=` clears all slider state.

### localStorage

```jsonc
// key: "gs:<urlStem>:sliders"
{
  "version": 1,
  "entries": {
    "tbl-atlantic#row": 0.42857,
    "tbl-atlantic#col": 0.10000,
    "tbl-pacific#row":  0.42857
  }
}
```

`urlStem` matches the existing GridSight per-page storage key (FR-014); we extend
its namespace with a new `:sliders` suffix to avoid collision with existing
enrichment state.

---

## Identity, equality, lifetime

- `Slider.id` is the public identity; equal-by-id sliders are the same slider.
- A slider's lifetime is bounded by its host table's lifetime in the DOM. If the
  table is removed, all its sliders are destroyed and their persisted entries are
  pruned on the next save.
- `AxisBinding` is recomputed if the table's headers mutate (rare); a binding
  recompute that yields a different `SyncKey` re-homes the slider into the
  appropriate sync group.

## Out of scope (deferred)

- Multi-formula readouts (more than two sources).
- Per-slider colour customisation.
- Animated playback ("play" button to sweep the slider) — flagged as a future
  enhancement; explicitly NOT in v1.
