# Data Model: Per-Page Enrichment Capability Filtering

**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md) · **Date**: 2026-05-19

Four entities. Three of them are pure data structures with no methods; the
fourth (`RuntimeTogglePanel`) is a small stateful UI component. All names are
TypeScript-style for clarity but the data could equally be expressed in any
language with a similar type system. None of this is wire-format; the only
externally-observable shape is the page-config (see `contracts/public-api.md`).

---

## EnrichmentRegistry

The single in-library record of every enrichment the build ships, keyed by
stable identifier.

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes | Lower-case, hyphen-separated. Stable identifier; never renamed without a registry-wide review (per Development-Phase Posture, free to evolve before the production cut). Matches the `data-gs-lozenge-id` attribute the DOM already exposes for shipped lozenges. |
| `label` | `string` | yes | Human-readable label used in the runtime toggle panel. May be localised in a future release; today, English only. |
| `defaultOn` | `boolean` | yes | Whether this enrichment is in the default enabled set when no page config or visitor override is present. Today every entry is `true` (FR-001 preserves pre-feature behaviour). |
| `tearDown` | `(table: HTMLTableElement) => void` | optional | Cleanup hook called when the enrichment transitions enabled → disabled while at least one of its instances is live on the page. Optional because some enrichments (e.g. `statistics` popup) clean up via a dismiss on `window._gs*Popup` rather than needing a hook. |

### Validation rules

- `id` MUST match `/^[a-z][a-z0-9-]*$/`. Validated at registry-construction time
  (compile-time error in TS; runtime assertion at boot).
- `id` MUST be unique within the registry.
- `label` MUST be non-empty.
- `tearDown` MUST NOT throw. It MAY be a no-op if the enrichment has nothing to
  clean up; it MUST handle the case where no instance of the enrichment is
  currently active on `table` (i.e. it must be idempotent).

### Lifecycle

- Constructed once at module load (`src/core/enrichment-registry.ts`).
- Frozen (`Object.freeze`) after construction; treated as read-only by everything
  downstream.
- Adding a new enrichment in future means **one edit** to the registry array.

### Initial contents

In display order (alphabetised among future-only ids):

```ts
[
  { id: 'heatmap',          label: 'Heatmap',          defaultOn: true, tearDown: removeAllHeatmaps },
  { id: 'sliders',          label: 'Sliders',          defaultOn: true, tearDown: removeAllAxisSliders },
  { id: 'slider-threshold', label: 'Threshold slider', defaultOn: true, tearDown: removeThresholdSliders },
  { id: 'statistics',       label: 'Statistics popup', defaultOn: true, tearDown: dismissStatisticsPopup },
  { id: 'frequency',        label: 'Frequency table',  defaultOn: true, tearDown: dismissFrequencyDialog },
  { id: 'frequency-chart',  label: 'Frequency chart',  defaultOn: true, tearDown: dismissFrequencyChartDialog },
  { id: 'annotations',      label: 'Cell annotations', defaultOn: true },   // spec 006 — no tearDown until shipped
  { id: 'copy-as-csv',      label: 'Copy as CSV',      defaultOn: true },   // spec 009
  { id: 'cumulative',       label: 'Cumulative col.',  defaultOn: true },   // spec 008
  { id: 'diff-compare',     label: 'Diff / compare',   defaultOn: true },   // spec 010
  { id: 'filter',           label: 'Column filter',    defaultOn: true },   // spec 003
  { id: 'outlier',          label: 'Outlier marker',   defaultOn: true },   // spec 004
  { id: 'sort',             label: 'Column sort',      defaultOn: true },   // spec 002
  { id: 'sparkline',        label: 'Row sparkline',    defaultOn: true },   // spec 005
  { id: 'units-toggle',     label: 'Units toggle',     defaultOn: true },   // spec 007
]
```

Spec-only entries register with no `tearDown` because they have no live
instances to clean up yet; each enrichment's implementation PR adds its own
`tearDown` to the registry entry as it lands.

---

## PageEnrichmentConfig

The author-supplied, page-scoped declaration of which enrichments are enabled
for one HTML page.

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `enrichments` | `string[]` | optional | The page-level enabled set. When present, replaces the library defaults entirely (FR-005). When absent, defaults apply. Empty array is a valid value (FR edge case: "no enrichments"). |
| `showToggleUi` | `boolean` | optional | When `true`, opt in to the runtime visitor toggle panel (FR-013). Default `false`. |

### Validation rules

- The whole config is optional. Absent → use defaults.
- `enrichments` MUST be an array if present. Non-array values trigger a single
  console warning and the entire config is rejected (FR-022).
- Entries within `enrichments` SHOULD be strings; non-string entries are dropped
  with a warning. The remaining valid entries are honoured.
- String entries are normalised: lower-cased and trimmed before lookup
  (FR Edge Case: case-insensitive, dedup). Unknown ids (after normalisation)
  are silently dropped (FR-007).
- `showToggleUi` MUST be a boolean if present. Non-booleans are coerced via
  `Boolean()` and emit a warning.

### Entry points

- `window.gridSight.pageConfig = { enrichments: [...], showToggleUi: true }` —
  IIFE / `<script>` path. Read at `init()` time.
- `gridSight.init({ enrichments: [...], showToggleUi: true })` — ESM path.
  The options shape extends the existing `TableProcessorOptions` envelope.

Whichever path is used, the parser produces the same internal normalised shape:
`{ enrichments: Set<string> | undefined, showToggleUi: boolean }`. `enrichments`
is `undefined` when the field was absent and an empty `Set` when the field was
present but empty (the two cases mean different things — see FR Edge Case).

---

## EffectiveEnabledSet

The resolved set of enrichment ids active for a given page-visit. Computed once
at `init()` and re-computed on every visitor toggle.

### Shape

`Set<string>` — a JS `Set` of normalised ids.

### Inputs

1. `visitorOverride: Set<string> | undefined` — from the visitor's persisted
   toggle state (URL fragment > localStorage). `undefined` means no visitor
   override (the panel hasn't been used, or the page didn't opt in to it).
2. `pageConfig: { enrichments: Set<string> | undefined, ... }` — normalised
   page-config from above.
3. `registry: EnrichmentRegistry[]` — for default resolution and id validity.

### Resolution algorithm

```text
if visitorOverride is defined:
    return new Set(visitorOverride ∩ knownIds)
if pageConfig.enrichments is defined:
    return new Set(pageConfig.enrichments ∩ knownIds)
return new Set(registry.filter(e => e.defaultOn).map(e => e.id))
```

`knownIds` is derived from the registry; intersection guarantees unknown ids
are dropped before any downstream consumer sees them. The result is always a
fresh `Set` — no aliasing of input collections.

### Where it lives

- Held in a module-scoped variable in `src/core/effective-enabled-set.ts`.
- Re-derived by `init()` and by the toggle panel's `change` handler.
- Read by:
  - `src/ui/header-utils.ts` — filters `LozengeSpec[]` before lozenge construction.
  - `src/ui/enrichment-menu.ts` — filters menu items.
  - Persistence loaders — skip URL-encoded state for disabled enrichments
    (FR-011).
  - Each enrichment's "register" point at table-processing time, if present.

---

## RuntimeTogglePanel

An opt-in UI component that lists every registered enrichment and lets the
visitor flip each on or off.

### State

| Field | Type | Notes |
|---|---|---|
| `root` | `HTMLFieldSetElement` | The panel's DOM root. One per page. |
| `checkboxes` | `Map<string, HTMLInputElement>` | id → checkbox, for fast state mirroring. |
| `mounted` | `boolean` | True after `mount()` has run; idempotent. |

### Operations

| Operation | Purpose |
|---|---|
| `mount(container?)` | Build DOM, append to `container` (or `[data-gs-toggle-panel]`, or `<body>`). Read current effective set, set each checkbox accordingly. Wire `change` listeners. Idempotent. |
| `refresh()` | Set each checkbox `checked` to match the current effective set. Called after any external mutation (today: never, but kept for future symmetry). |
| `onCheckboxChange(id, checked)` | Mutate the visitor-persisted set: add or remove `id`. Re-derive the effective set. Run tearDowns for any id that just went off. Call the global lozenge rebuild for every registered table. |

### Lifecycle

- Created only when `pageConfig.showToggleUi === true` **or** the page contains
  a `<* data-gs-toggle-panel>` element (FR-013 + R-5).
- Never unmounted during a page's lifetime; reload destroys it along with the
  rest of the page.

### Accessibility

See research entry R-9. The panel uses native `<fieldset>`, `<legend>`,
`<label>`, and `<input type="checkbox">`; no custom ARIA roles.

---

## Relationships

```text
EnrichmentRegistry (read-only, module scope)
        ▲
        │ knownIds, defaults
        │
        ▼
EffectiveEnabledSet ◀──── PageEnrichmentConfig (parsed once)
        ▲
        │ writes by user action
        │
RuntimeTogglePanel ────── reads visitor persisted state
                          (URL fragment + localStorage)
```

Every downstream consumer (lozenge builder, menu builder, URL-state loader)
reads from `EffectiveEnabledSet`. Nothing reads the registry directly except
the resolver and the toggle panel.

---

## Persistence shape

URL fragment key (consistent with existing `gs.s`):

```text
#gs.e=heatmap,sliders,statistics
```

- Ids comma-separated.
- No spaces.
- Alphabetical order on write (stable bookmark diff).
- Unknown ids and malformed entries are ignored on read (FR-007 / FR-022).

`localStorage` key:

```text
gridsight:<url-stem>:enrichments  →  ["heatmap","sliders","statistics"]
```

`<url-stem>` is the existing stem used by sliders — typically
`location.origin + location.pathname` (no query, no fragment), matching the
project's per-URL persistence model.

---

## Out of scope (documented for future readers)

- **Per-table override**: not in this feature. If demanded later, the natural
  extension is `data-gs-enrichments="..."` on `<table>` that produces a
  per-table `EffectiveEnabledSet`.
- **Localised labels**: registry `label` is English-only today. Future
  feature: `labels: { en: '...', fr: '...' }`.
- **Programmatic toggling from host JS** (e.g. `gridSight.setEnabled('sort',
  true)`): not exposed yet. Trivially implementable on top of the resolver if
  needed; intentionally absent from this feature's public API to keep the
  surface narrow.
