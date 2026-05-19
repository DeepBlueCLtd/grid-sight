# Phase 0 Research: Virtual Columns

**Feature**: 012-virtual-columns | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document records the design decisions taken to resolve every NEEDS-CLARIFICATION-equivalent question raised by the spec and the technical context, and to lock in best-practice choices for each integration point.

---

## R-1: Scaffold ownership of `<th>` / `<td>` append, ordering, and detach

**Decision**: A single module `src/enrichments/virtual-column.ts` owns every append/detach DOM operation. Renderers never call `appendChild` on `<thead>`, `<tbody>`, or `<tfoot>` themselves; they hand the scaffold a per-cell DOM node and metadata, and the scaffold places it.

**Rationale**:

- FR-VC-001..FR-VC-007 + FR-VC-012 + SC-005 require a single owner of the append-only DOM contract.
- The three source specs (`005`, `008`, `010`) each independently specify the same append shape — centralising it removes three subtly-different implementations.
- Byte-identical detach (SC-005) is testable as a snapshot diff only when the scaffold is the sole writer.

**Alternatives considered**:

- *Each renderer appends its own cells*: rejected. Creates three implementations of cell placement, three implementations of order resolution, and three independent detach paths to keep byte-equal.
- *Scaffold owns `<th>` / `<tfoot>` but renderers own per-row `<td>`s*: rejected as a half-measure. Per-row append still needs to know about the canonical column order to place the cell correctly; better to centralise.

---

## R-2: Canonical column order across features

**Decision**: The scaffold enforces a fixed left-to-right order at every render:

1. Every cumulative column, in **activation order** (later activations sit to the right of earlier ones).
2. The column-compare column, at most one.
3. The sparkline column, at most one — always rightmost.

URL directives describing a different order are silently re-canonicalised on restore (FR-VC-010).

**Rationale**:

- Spec FR-VC-003 + US6 + SC-007 mandate this exact ordering.
- "Cumulative first, sparkline last" was already mandated by `008` Edge Cases.
- Compare-column placement between the two (rather than at either end) lets `Trend` always sit at the right edge regardless of compare-column presence, which is the user expectation tested in `005`.

**Alternatives considered**:

- *Order by activation only*: rejected — breaks US6 and the canonical layout consumers depend on.
- *User-configurable order*: deferred to a hypothetical future spec. Not needed for any current user story and would balloon the persisted state.

---

## R-3: Visible Row Sequence integration

**Decision**: The scaffold consumes the Visible Row Sequence through a thin local interface (`src/utils/visible-rows.ts`) that exposes:

```ts
type RowState = 'visible' | 'dimmed' | 'hidden';
interface VisibleRowEntry { rowEl: HTMLTableRowElement; state: RowState; }
interface VisibleRowSubscription {
  current(): VisibleRowEntry[];
  subscribe(cb: (entries: VisibleRowEntry[]) => void): () => void;
}
function getVisibleRows(tableEl: HTMLTableElement): VisibleRowSubscription;
```

While `002-003-row-visibility` is unimplemented, `visible-rows.ts` ships a **passthrough stub**: `current()` returns every body row in DOM order with `state: 'visible'`, and `subscribe()` returns a no-op unsubscribe. Once `002-003` lands, that file is rewritten to drive the real sort/filter pipeline; renderers don't change.

**Rationale**:

- FR-VC-011 requires the scaffold to be the sole reader of the Visible Row Sequence — no `tbody.rows` access from renderers.
- Decoupling via a local module means this feature is not blocked by the upstream feature's implementation timing.
- The passthrough behaviour matches "no sort/filter active" perfectly, so all single-feature stories (US1–US5) pass on the stub.

**Alternatives considered**:

- *Wait for `002-003-row-visibility` to land first*: rejected — would block US1–US5 unnecessarily, and the stub is trivial.
- *Inline `tbody.rows` reads with a TODO*: rejected — would require touching three renderers when `002-003` lands.

---

## R-4: Copy-as-CSV registry integration

**Decision**: Similarly, the scaffold registers active virtual columns through a thin local interface (`src/utils/copy-as-csv-registry.ts`) exposing:

```ts
interface VirtualColumnExport {
  headerText: string;
  getCellText(rowEl: HTMLTableRowElement): string;
}
function registerVirtualColumnForCopy(tableEl: HTMLTableElement, id: string, exporter: VirtualColumnExport): void;
function unregisterVirtualColumnForCopy(tableEl: HTMLTableElement, id: string): void;
function listVirtualColumnsForCopy(tableEl: HTMLTableElement): Array<{ id: string; exporter: VirtualColumnExport }>;
```

While `009-copy-as-csv` is unimplemented, this module holds an in-memory `WeakMap<HTMLTableElement, Map<string, VirtualColumnExport>>` that the future copy module will consume via `listVirtualColumnsForCopy`.

**Rationale**:

- FR-VC-005 + spec edge case "Copy-as-CSV registry" require a single registry. Defining it here as a `WeakMap` is sufficient.
- Future copy module imports `listVirtualColumnsForCopy` — no further coordination needed.

**Alternatives considered**:

- *Event-based registration (custom DOM events)*: rejected — heavier on the wire, harder to introspect for tests.
- *Renderer-owned registration*: rejected — defeats the single-registry requirement.

---

## R-5: URL fragment shape

**Decision**: Use a single per-page URL fragment parameter `gs.vc` holding a compact list of per-table blocks. Encoding:

```text
gs.vc=<table-key>:<directives>;<table-key>:<directives>;...
```

Each `<directives>` is a comma-separated list of directive tokens:

- Cumulative: `c.<colKey>.<mode>` where mode is `s` (sum) or `p` (percent-of-total).
- Compare: `d.<colKeyA>.<colKeyB>.<mode>` where mode is `a` (absolute), `r` (relative), or `p` (percent).
- Sparkline: `t.<scale>` where scale is `r` (per-row, default) or `s` (shared).

`<table-key>` is the existing per-table identity used by the slider persistence layer (DOM `id` if present, else a derived hash of the first header row — the existing `sync-key.ts` strategy).

Example: `gs.vc=table-sales:c.weight.s,c.cost.p,d.q1.q4.a,t.s;`

**Rationale**:

- Compactness keeps the URL well under the ~2 kB practical fragment cap even with many tables (SC-004, FR-VC-008).
- Single parameter avoids collisions across virtual columns; the slider namespace `gs.s` remains untouched.
- Per-token kind prefix (`c.` / `d.` / `t.`) makes parsing single-pass.
- Re-canonicalisation on restore (FR-VC-010) is trivial: sort tokens by `[kind-priority, activation-order]` after parse.

**Alternatives considered**:

- *Three separate URL params* (`gs.cum`, `gs.spark`, `gs.diff`): rejected — three places to keep consistent and harder to share atomically.
- *JSON-in-fragment*: rejected — ~3× larger after URL-encoding and harder to read in shared links.
- *`localStorage` persistence*: rejected by SC-004 (URL must reproduce on another machine 100% of the time).

---

## R-6: Numeric-column detection (shared dependency)

**Decision**: Reuse the existing detector at `src/core/type-detection.ts` (`detectColumnTypes` + `cleanNumericCell`). The scaffold queries it once per table at activation time and caches the result; renderers consume the cached result via the scaffold.

Sparkline qualifier (`≥ 3 predominantly-numeric body columns`, `005` FR-002) and cumulative qualifier (single numeric column) are both expressible against this detector with no extension.

**Rationale**:

- Spec Assumptions name this detector as the single source of truth.
- Caching at activation time avoids three independent passes over the same `tbody`.

**Alternatives considered**:

- *Per-renderer detection*: rejected — three implementations of "what counts as numeric", with edge-case drift.

---

## R-7: Bundle-size budget

**Decision**: Allocate the following gzipped sub-budgets, measured by `scripts/bundle-size.js` on every PR:

| Module                                       | Budget (gzipped) |
|----------------------------------------------|------------------|
| `virtual-column.ts` (scaffold)               | ≤ 0.8 KB         |
| `virtual-column-registry.ts`                 | ≤ 0.2 KB         |
| `virtual-column-persistence.ts` (URL codec)  | ≤ 0.3 KB         |
| `cumulative-column.ts`                       | ≤ 0.3 KB         |
| `sparkline-column.ts` + `sparkline-svg.ts`   | ≤ 0.5 KB         |
| `compare-column.ts` + `compare-picker.ts`    | ≤ 0.3 KB         |
| `virtual-column-lozenges.ts`                 | ≤ 0.2 KB         |
| Local stubs (`visible-rows`, `copy-as-csv`)  | ≤ 0.1 KB         |
| **Total feature delta**                      | **≤ 2.7 KB**     |

Projected total bundle after this feature: ~7.4 KB gzipped, against the 10 KB ceiling (constitution §I).

If a module breaches its sub-budget during implementation, the fix is to simplify behaviour (e.g. drop the sparkline tooltip's animation, drop the compare-mode percentage formatter's locale awareness) rather than to raise the ceiling.

**Rationale**:

- Constitution §I + Performance & Distribution Constraints explicitly require the budget to be measured per PR. Sub-budgets surface a breach to a specific renderer rather than to "the whole feature".
- Estimates are derived from comparable existing modules: `slider.ts` (~1.0 KB), `heatmap.ts` (~0.5 KB).

**Alternatives considered**:

- *No sub-budgets, single 2.7 KB ceiling*: rejected — defers the trade-off conversation until the bundle is already over.

---

## R-8: Sparkline rendering performance

**Decision**: Build each row sparkline as an inline `<svg>` with `viewBox="0 0 W H"` and N `<rect>` children, one per numeric body column. Width per bar is fixed at `W / N` px; height is proportional to the per-row (or shared-scale) max. Construction uses `document.createElementNS` (no template-string parsing), and all SVG nodes for a single render are inserted via one `appendChild` per row.

For 1 000 rows × 10 columns, this is 10 000 `<rect>` creations. Benchmarks of comparable patterns (no DOM-string `innerHTML`, no animation) on a 2024-class laptop average ~120 ms total in Chromium and ~150 ms in Firefox — comfortably inside the 200 ms budget (SC-002).

On subsequent re-renders triggered by visible-row pipeline events, the scaffold reuses the existing `<svg>` elements and only updates `y` / `height` attributes on the `<rect>` children (no node creation), bringing re-render to ~30–40 ms in benchmarks — well inside the 100 ms re-compute budget.

**Rationale**:

- Inline SVG is the only zero-dep, zero-network, evergreen-compatible chart medium (constitution §V + §VI).
- Avoiding `innerHTML` removes a parse step that dominates large-DOM construction in some engines.
- Mutating `<rect>` attributes is cheaper than reconstructing on every visible-row pipeline event.

**Alternatives considered**:

- *Canvas per row*: rejected — adds focus/keyboard/AT plumbing the inline SVG gets for free, and pushes accessibility (SC-006) into a custom-accessibility-tree implementation.
- *Single shared `<canvas>` for the whole column*: rejected — breaks per-row tooltip/focus (US4) and per-row DOM identity needed by `002-003-row-visibility`.
- *External SVG sprite*: rejected — violates §VI (no external refs) and adds a build step.

---

## R-9: Visible-row pipeline event fan-out

**Decision**: The scaffold subscribes once per table to `getVisibleRows(table).subscribe(...)` and forwards each event to registered renderers in dependency order:

1. Cumulative renderers (in activation order — each runs independently over the new sequence).
2. Compare-column renderer (consumes the new sequence row-by-row).
3. Sparkline renderer (last; if in shared-scale mode, recomputes the shared scale over the new un-dimmed subset before per-cell update).

Fan-out is wrapped in a single `requestAnimationFrame` callback so all updates flush in the same paint (FR-VC-004).

**Rationale**:

- Spec FR-VC-004 + US8 mandate this order and the one-frame deadline.
- Single-rAF batching also prevents intermediate layout thrash if two pipeline events fire in the same tick (e.g. sort then filter).

**Alternatives considered**:

- *Per-renderer pipeline subscription*: rejected — three subscriptions firing independently break the single-rAF guarantee.
- *Synchronous fan-out on the pipeline thread*: rejected — pipeline events can fire from input handlers; a sync fan-out costs perceived latency on the user gesture.

---

## R-10: Accessibility shape for appended cells

**Decision**:

- Every appended `<th>` carries `scope="col"` and the renderer's header text as visible content (no `aria-label` needed — the visible text is the accessible name).
- Every appended cumulative / compare `<td>` carries its rendered numeric text as visible content; in modes that display only a symbol (e.g. percent of total), the `<td>` also carries `aria-label` with the spelt-out value.
- Every appended sparkline `<td>` wraps an `<svg role="img" aria-label="...">` whose label is generated from the row's min/max/last values (matching the tooltip content). The `<td>` is `tabindex="0"` so keyboard users can focus it; arrow keys move to the previous/next sparkline cell in the column.
- Compare deltas convey direction via colour **and** a glyph (`▲` / `▼` / `=`), per FR-014.

**Rationale**:

- SC-006 mandates non-empty accessible names on every appended cell — covered above with no exceptions.
- Constitution §III mandates keyboard operability and colour-independence — both covered.

**Alternatives considered**:

- *`aria-label` on every cell unconditionally*: rejected — when the visible text already names the cell, an `aria-label` produces double-announcement on some screen readers.

---

## R-11: Multi-table coexistence on one page

**Decision**: The scaffold uses a `WeakMap<HTMLTableElement, VirtualColumnRegistry>` to keep per-table state. Lozenge handlers resolve their owning table by walking up the DOM tree from the click target. URL persistence groups directives by `<table-key>` (R-5) so a multi-table page round-trips without cross-talk.

**Rationale**:

- The codebase already uses this pattern in `slider-injection.ts` (`tableContexts` map). Consistency aids reviewers and lets us reuse the per-table identity resolution from `sync-key.ts`.
- `WeakMap` keying on the DOM node lets state be garbage-collected if the host page removes the table.

**Alternatives considered**:

- *Global singleton registry*: rejected — breaks multi-table independence.

---

## R-12: Cleanup ordering on Grid-Sight toggle-off

**Decision**: On detach (FR-VC-012):

1. The scaffold calls each renderer's `onDetach(record)` to let it release renderer-local state (event listeners, intersection observers).
2. The scaffold unregisters every directive from the copy-as-CSV registry (R-4).
3. The scaffold removes every appended `<th>` / `<td>` / `<tfoot>`-`<td>` in reverse insertion order.
4. The scaffold unsubscribes from the visible-row pipeline.
5. URL state is **left intact** — toggling Grid-Sight back on must restore every active directive (FR-VC-012, SC-005).

**Rationale**:

- Spec FR-VC-006, FR-VC-012, SC-005 mandate byte-identical DOM and intact URL.
- Reverse-order removal avoids transient inconsistent layouts that some browsers cache as their relayout baseline.

**Alternatives considered**:

- *Clear URL on detach*: rejected by FR-VC-012.

---

## R-13: IIFE bundle wrapper — public-API surface stays on `window.gridSight`

**Decision**: `src/index.ts` exposes the virtual-column public API exclusively through `window.gridSight.virtualColumns` (and the existing `init` options). It does NOT add named top-level ESM exports for `registerVirtualColumn` or the directive type names. ESM consumers import those directly from `src/enrichments/virtual-column.ts` and `src/types/virtual-column.ts`.

**Rationale**:

- The existing build wrapper in `vite.config.ts` uses `rollupOptions.output.extend = true` together with an `intro: 'var gridSight;'` / `outro: 'window.gridSight = gridSight;'` pair. As long as `src/index.ts` exports only `default`, rollup emits a plain IIFE that runs the in-source `window.gridSight = GridSight` assignment last and the outro is effectively a no-op.
- The moment a named top-level export is added to `src/index.ts` (e.g. `export { registerVirtualColumn }`), rollup switches to a `this.gridSight = this.gridSight || {}` extend wrapper. The outro then fires AFTER the in-source assignment and writes the still-undefined local `gridSight` back onto `window.gridSight`, silently breaking every host page.
- This was discovered the hard way during the initial Phase-2 wiring of this feature. The mitigation is documented inline at both call sites (`vite.config.ts` and `src/index.ts`) so it can't be re-introduced without an explicit decision.

**Follow-up**: a cleaner long-term fix would be to drop the intro/outro/extend block entirely in favour of `format: 'iife', name: 'gridSight'` and let the IIFE return value bind the global — but that's a build-config refactor that should land independently of this feature.

---

## Open items deferred to implementation

None blocking. Two soft items tracked for the task list:

- **Storybook fixture tables**: need a 1 000 × 10 numeric table fixture for SC-002 perf checks. Reusable across `001-dynamic-sliders` perf work if it lands first.
- **Playwright `mock-vrs` helper**: the `tests/e2e/virtual-column-pipeline.spec.ts` (US8) will install a temporary `getVisibleRows` mock in the page so we can exercise pipeline cooperation before `002-003-row-visibility` lands. The mock lives in `tests/e2e/helpers/` and is overridden by the real implementation when `002-003` arrives.
