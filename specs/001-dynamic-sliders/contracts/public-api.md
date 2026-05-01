# Public API Contract: Dynamic Sliders

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Date**: 2026-05-01

This contract documents every addition to the `window.gridSight` global surface and
to the npm/ESM exports. All names are stable for v1; per the constitution
Development-Phase Posture they MAY change before the production cut, but not
silently — any rename ships in the same PR that announces it.

The existing `init`, `processTable`, and `isValidTable` exports are unchanged.

---

## TypeScript signatures (informative)

```ts
// New top-level exports on window.gridSight (and same names from src/index.ts)

interface GridSightSlider {
  /** Stable id. Equal-id sliders are the same slider. */
  readonly id: string;
  /** "axis" sliders interpolate; "threshold" sliders fade heatmap cells. */
  readonly kind: "axis" | "threshold";
  /** Current continuous position in [min, max]. */
  readonly position: number;
  /** Normalised 0–1 position. */
  readonly position01: number;
  /** Move the slider programmatically. Clamped to [min, max]. */
  setPosition(value: number): void;
  /** Remove the slider, cleaning DOM, listeners, and persistence entry. */
  destroy(): void;
}

type FormulaFn = (rowValue: number, colValue: number) => number;

declare global {
  interface Window {
    gridSight: {
      // existing
      init(): void;
      processTable(table: HTMLTableElement, options?: ProcessOptions): HTMLTableElement;
      isValidTable(table: HTMLTableElement): boolean;

      // NEW — slider management
      addSlider(table: HTMLTableElement, axis: "row" | "col"): GridSightSlider;
      addThresholdSlider(table: HTMLTableElement): GridSightSlider;
      getSliders(table?: HTMLTableElement): GridSightSlider[];
      removeAllSliders(table?: HTMLTableElement): void;

      // NEW — equation registration (Story 2)
      registerFormula(table: HTMLTableElement, fn: FormulaFn): void;
      clearFormula(table: HTMLTableElement): void;
    };
  }
}
```

---

## Behavioural contract

### `addSlider(table, axis)`

- **Pre**: `table` is a valid Grid-Sight table whose `axis` headers are all numeric
  and strictly monotonic (FR-001).
- **Post**: A slider DOM is rendered alongside `axis`; an entry is added to the
  page's `SyncKey` group; persisted state is loaded (URL → localStorage → midpoint).
  The returned `GridSightSlider` is alive until `.destroy()` or `removeAllSliders()`.
- **Errors**: Throws `Error("Axis not numeric")` if the axis fails the type
  detection check. Throws `Error("Slider already exists")` if a slider for the same
  (table, axis) already exists; callers should call `getSliders()` first if unsure.

### `addThresholdSlider(table)`

- **Pre**: `table` has heatmap colouring enabled (existing `enrichments/heatmap.ts`
  output present). At most one threshold slider per table.
- **Post**: A threshold slider is rendered above the table; cells whose underlying
  numeric value is below the slider's current value are CSS-faded
  (R-6 — single class + custom property update).
- **Errors**: Throws `Error("Heatmap not enabled")` if the table has no heatmap.

### `getSliders(table?)`

Returns all live sliders, or just those belonging to `table` if provided. Order is
insertion order. Pure; safe to call from outside the library.

### `removeAllSliders(table?)`

Destroys every live slider (or those for `table`) and prunes their persisted
entries. Equivalent to looping `.destroy()` over `getSliders(table)`. No-op if
none exist.

### `registerFormula(table, fn)`

- **Pre**: `fn` is a function. `table` is a valid Grid-Sight table.
- **Post**: When axis sliders are added to `table`, a second readout labelled
  "From equation" appears alongside the "Interpolated" readout; its value is
  `fn(rowSliderPosition, colSliderPosition)` — using the table's row/col axes
  even if only one axis slider is present (the other defaults to its midpoint).
- **Errors**: If `fn` throws during evaluation, the readout shows "—" and the
  error is logged via the existing GridSight diagnostic channel; the slider
  itself remains usable.

### `clearFormula(table)`

Removes the registered formula. The "From equation" readout disappears on the
next slider update. No-op if no formula is registered.

---

## DOM contract (host-page facing)

The following selectors are stable parts of the contract and may be relied upon by
host CSS (per the existing GridSight model where injected DOM is part of the
public surface).

| Selector | Purpose |
|---|---|
| `[data-gs-slider]` | Wrapper element containing the slider input + readouts. |
| `[data-gs-slider-axis="row" \| "col" \| "threshold"]` | Disambiguates by kind. |
| `[data-gs-slider-readout="interpolated" \| "equation"]` | Live readout span. |
| `[data-gs-marker]` | Heatmap position marker overlay (Story 4). |
| `[data-gs-no-sync]` | (host-set) Suppresses cross-table sync for this table. |

CSS variables exposed:

| Variable | Scope | Meaning |
|---|---|---|
| `--gs-slider-thumb-color` | `:root` or per-table | Override slider thumb colour. |
| `--gs-cell-fade` | per-table | Threshold-driven cell fade ratio (0–1). |

---

## URL contract

`#gs.s=<sliderId>:<pos01>[,<sliderId>:<pos01>]*`

- `sliderId` matches `[a-zA-Z0-9_.-]+`.
- `pos01` matches `0(\.\d{1,5})?` or `1(\.0{1,5})?`.
- Unknown ids on load are ignored (forward-compat with future slider variants).
- Malformed fragments are ignored as a whole; falls back to localStorage.

---

## Versioning note

Per the constitution Development-Phase Posture, none of the symbols above are
under SemVer freeze yet. The frozen contract today is only `init`. Once the
production cut happens, this surface (or whatever it has evolved into) will be
amended into the constitution's "Public API surface" list and frozen.
