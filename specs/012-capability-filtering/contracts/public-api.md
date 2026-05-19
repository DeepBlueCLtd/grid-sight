# Public API Contract: Per-Page Enrichment Capability Filtering

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Date**: 2026-05-19

This contract documents every addition to the `window.gridSight` global surface,
the `init()` options envelope, the host-page declarative surface (HTML
attributes), the URL fragment grammar, and the DOM the runtime panel injects.

Per the constitution Development-Phase Posture, names below are stable for this
release but MAY change before the production cut; the frozen `init()` signature
is preserved (the new options are additive).

The existing `init`, `processTable`, `isValidTable`, `addSlider`,
`addThresholdSlider`, `getSliders`, `removeAllSliders`, `registerFormula`, and
`clearFormula` exports are unchanged.

---

## TypeScript signatures (informative)

```ts
// New types on the public surface.

/** Stable identifier for one enrichment. Lowercase, hyphen-separated. */
export type EnrichmentId = string;

/** Page-level configuration object. Optional; absent means "use defaults". */
export interface PageEnrichmentConfig {
  /**
   * The set of enrichments enabled on this page. When present, REPLACES the
   * library default set (does not merge). Unknown ids are ignored.
   * Empty array means "no enrichments" (master GS toggle still appears).
   */
  enrichments?: readonly EnrichmentId[];

  /**
   * When true, render the runtime visitor toggle panel. When omitted or false,
   * no panel is rendered (unless the page contains a `[data-gs-toggle-panel]`
   * container, which is treated as an equivalent declarative opt-in).
   */
  showToggleUi?: boolean;
}

/** Options for `gridSight.init()`. Extends the existing options envelope. */
export interface InitOptions extends TableProcessorOptions {
  /** Same semantics as `PageEnrichmentConfig.enrichments`. */
  enrichments?: readonly EnrichmentId[];
  /** Same semantics as `PageEnrichmentConfig.showToggleUi`. */
  showToggleUi?: boolean;
}

declare global {
  interface Window {
    gridSight: {
      // existing — unchanged
      init(options?: InitOptions): typeof window.gridSight;
      processTable(table: HTMLTableElement, options?: TableProcessorOptions): HTMLTableElement;
      isValidTable(table: HTMLTableElement): boolean;

      addSlider(table: HTMLTableElement, axis: "row" | "col"): GridSightSlider;
      addThresholdSlider(table: HTMLTableElement): GridSightSlider;
      getSliders(table?: HTMLTableElement): GridSightSlider[];
      removeAllSliders(table?: HTMLTableElement): void;
      registerFormula(table: HTMLTableElement, fn: FormulaFn): void;
      clearFormula(table: HTMLTableElement): void;

      // NEW — page-level config (read at init() time)
      pageConfig?: PageEnrichmentConfig;

      // NEW — read-only view of the registry, for host inspection / debugging
      readonly enrichmentIds: readonly EnrichmentId[];

      // NEW — read-only view of the currently effective enabled set
      isEnrichmentEnabled(id: EnrichmentId): boolean;
    };
  }
}
```

---

## Behavioural contract

### `window.gridSight.pageConfig`

**Authoring contract**: The page author assigns this property **before** calling
`init()`. The assignment may live in a `<script>` tag in `<head>` or anywhere in
`<body>` that runs before init. Reading the property after init returns the
same value that was stored; mutating it post-init has no effect on the running
session (a future init() call would pick up the new value).

**Library contract**: At init, the library reads `pageConfig` once, normalises
it via `core/page-config.ts`, and caches the result. The original property is
left untouched (for debugging).

### `gridSight.init(options)`

When called with `options.enrichments` and/or `options.showToggleUi`, those
values take precedence over `window.gridSight.pageConfig` for the same fields.
Fields not present in `options` fall back to `pageConfig`; fields absent from
both fall back to defaults.

- **Pre**: `options` is omitted or an object. `options.enrichments` if present
  is an array. `options.showToggleUi` if present is a boolean.
- **Post**: The library is initialised; for every qualifying table, only the
  effective enabled set's lozenges are rendered. If `showToggleUi` resolves
  truthy (or a `[data-gs-toggle-panel]` element exists on the page), the
  runtime panel is mounted exactly once.
- **Errors**: Same as today (`Failed to inject UI elements` warnings on a
  per-table basis). Misshapen `enrichments` arrays do NOT throw — a single
  console warning is emitted and the field is ignored (FR-022).

### `window.gridSight.enrichmentIds`

A frozen, read-only array of every registered enrichment id, in registry
display order. Useful for host pages that want to render their own enrichment
chooser (rare, but supported).

### `window.gridSight.isEnrichmentEnabled(id)`

Returns `true` if `id` is in the current effective enabled set, otherwise
`false` (including for ids the registry does not know).

- **Pre**: `id` is a string.
- **Post**: Pure read. Safe to call from outside the library, including from
  inside `tearDown` hooks.

---

## HTML declarative surface (host-page facing)

| Selector / attribute | Purpose |
|---|---|
| `[data-gs-toggle-panel]` | Container element into which the runtime toggle panel mounts. Existence of this element opts in to the panel even without `showToggleUi: true`. |
| `[data-gs-ignore]` (existing) | Unchanged. A table marked thus is untouched by Grid-Sight regardless of `enrichments` config. |

The panel itself injects this DOM:

```html
<fieldset data-gs-toggle-panel-root>
  <legend>Grid-Sight enrichments</legend>
  <label data-gs-enrichment-toggle="heatmap">
    <input type="checkbox" /> Heatmap <span class="gs-id-hint">(heatmap)</span>
  </label>
  <label data-gs-enrichment-toggle="sliders">
    <input type="checkbox" /> Sliders <span class="gs-id-hint">(sliders)</span>
  </label>
  <!-- one row per registered id -->
</fieldset>
```

| Selector | Purpose |
|---|---|
| `[data-gs-toggle-panel-root]` | The panel's root fieldset. Stable selector for host CSS. |
| `[data-gs-enrichment-toggle="<id>"]` | One label per registered enrichment. The attribute carries the id for inspection / e2e selectors. |
| `.gs-id-hint` | The small `(id)` annotation after the label. Host CSS can hide it. |

CSS variables exposed:

| Variable | Scope | Meaning |
|---|---|---|
| `--gs-toggle-panel-bg` | `[data-gs-toggle-panel-root]` | Override background. |
| `--gs-toggle-panel-border` | `[data-gs-toggle-panel-root]` | Override border colour. |

The panel's own positional CSS (top-right dock when no container is supplied)
is applied via the same `data-gs-toggle-panel-root` selector with `position:
fixed` defaults that can be overridden by host CSS.

---

## URL contract

`#gs.e=<id>[,<id>]*`

- `id` matches `/^[a-z][a-z0-9-]*$/`.
- Multiple ids comma-separated, written in alphabetical order on persist.
- Unknown ids on load are silently ignored (forward-compat for older bookmarks
  pointing at enrichments this build no longer ships).
- Malformed fragments are ignored as a whole; falls back to localStorage.
- The `gs.e` segment is independent of the existing `gs.s` slider segment;
  they can appear together: `#gs.s=...&gs.e=...` (the `&` separator is the
  same as the slider key already uses).

---

## localStorage contract

| Key | Value | Notes |
|---|---|---|
| `gridsight:<url-stem>:enrichments` | JSON array of ids | Written every time the toggle panel changes. Read once at init if the URL fragment did not supply a value. |

`<url-stem>` is identical to the stem used by the existing slider persistence
(today: `location.origin + location.pathname`). Sharing the stem means clearing
one page's GS state clears it for all features.

---

## Diagnostics / console output

The library emits at most these warnings, each at most once per init:

| Condition | Console message |
|---|---|
| `pageConfig.enrichments` is not an array | `[gridsight] pageConfig.enrichments must be an array; ignoring.` |
| `pageConfig.enrichments` contains non-string entries | `[gridsight] pageConfig.enrichments contains non-string entries; dropping.` |
| `pageConfig.showToggleUi` is not a boolean | `[gridsight] pageConfig.showToggleUi must be a boolean; coercing.` |
| `pageConfig` is the wrong shape entirely | `[gridsight] pageConfig must be an object; ignoring.` |

No errors are thrown for these cases; the library falls back to defaults.

Unknown ids inside an otherwise-valid array are NOT warned about (this is the
defined forward-compat path; warning would be noisy for legitimate use cases).

---

## Versioning note

Per the constitution Development-Phase Posture, none of the symbols above
(`pageConfig`, `enrichmentIds`, `isEnrichmentEnabled`, `data-gs-toggle-panel*`,
the `gs.e` URL key) are under SemVer freeze. The frozen public contract is
still only `init`'s signature, which this feature extends additively (new
optional fields on the options envelope — no breakage). Once the production
cut happens, this surface (or whatever it has evolved into) will be amended
into the constitution's "Public API surface" list and frozen.
