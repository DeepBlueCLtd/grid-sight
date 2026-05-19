# Internal Contracts: Scaffold ↔ Renderer ↔ Upstream Integrations

**Feature**: 012-virtual-columns | **Plan**: [../plan.md](../plan.md)

This document defines the **internal** (not in `window.gridSight`) TypeScript interfaces the scaffold exposes to per-feature renderers and the two thin local interfaces the scaffold uses to integrate with `002-003-row-visibility` and `009-copy-as-csv` while those upstream features are unimplemented.

These contracts are not under any backwards-compat freeze. They live in the in-tree TypeScript surface only.

---

## 1. Renderer registration

```ts
// src/enrichments/virtual-column.ts (excerpt)

export interface Renderer<D extends VirtualColumnDirective> {
  readonly kind: D['kind'];

  /** Header text for the appended <th>. Pure; cheap. */
  headerText(directive: D): string;

  /** Optional one-time check before activation. Returning false silently
   *  refuses activation (no error). Defaults to () => true. */
  canActivate?(directive: D, table: HTMLTableElement, numericColumns: ReadonlySet<string>): boolean;

  /** Build the per-row <td> contents. Called once per row at first render
   *  and again on visible-row pipeline events when the renderer opts into
   *  re-render via onPipelineChange. */
  renderCell(
    directive: D,
    td: HTMLTableCellElement,
    rowEl: HTMLTableRowElement,
    sequence: VisibleRowEntry[],
    rowIndex: number,
  ): void;

  /** React to a visible-row pipeline event. Most renderers will iterate
   *  record.bodyCells and patch in-place via renderCell, but some (e.g.
   *  shared-scale sparkline) need a pre-pass over the whole sequence first. */
  onPipelineChange(directive: D, record: AppendedColumnRecord, sequence: VisibleRowEntry[]): void;

  /** Optional cleanup hook. Called at detach (FR-VC-006). */
  onDetach?(directive: D, record: AppendedColumnRecord): void;

  /** Build a CSV/TSV exporter for the copy-as-CSV registry. */
  exporter(directive: D): VirtualColumnExport;
}

export function registerRenderer<D extends VirtualColumnDirective>(renderer: Renderer<D>): void;
```

Each renderer module calls `registerRenderer` exactly once at module load. The scaffold maintains a `Map<VirtualColumnKind, Renderer<any>>`; re-registration of the same kind logs a dev-time warning and replaces the entry (intended for hot-reload).

### Scaffold-owned guarantees

The scaffold (not the renderer) is responsible for:

1. Cell creation (`document.createElement('td')` / `'th'`) and placement at the canonical position (R-2).
2. `data-gs-virtual-column` and `data-gs-virtual-column-id` attributes on every appended cell.
3. `scope="col"` on every appended `<th>`.
4. Calling `renderCell` once per row in DOM order at first render, and once per row in `sequence` order on every pipeline event.
5. Calling `onPipelineChange` exactly once per pipeline event per renderer, in the dependency order: cumulative → compare → sparkline (R-9).
6. Wrapping the fan-out in a single `requestAnimationFrame` so all updates flush in the same paint.
7. Removing every appended cell on detach in reverse insertion order (R-12).
8. Registering and deregistering each directive's `VirtualColumnExport` with the copy-as-CSV registry around the activation lifecycle.

Renderers that violate these guarantees (e.g. by appending their own `<td>`s) are out-of-contract.

---

## 2. Visible Row Sequence interface

Defined in `src/utils/visible-rows.ts`. Ships in this feature as a passthrough stub; replaced in-place when `002-003-row-visibility` lands.

```ts
// src/utils/visible-rows.ts

export type RowState = 'visible' | 'dimmed' | 'hidden';

export interface VisibleRowEntry {
  rowEl: HTMLTableRowElement;
  state: RowState;
}

export interface VisibleRowSubscription {
  /** Snapshot of the current sequence. */
  current(): VisibleRowEntry[];
  /** Subscribe to change events. Returns an unsubscribe function. */
  subscribe(cb: (entries: VisibleRowEntry[]) => void): () => void;
}

/** Resolve the subscription for a given table. Implementations MUST return
 *  the same object on repeat calls with the same table (idempotent). */
export function getVisibleRows(table: HTMLTableElement): VisibleRowSubscription;
```

### Stub behaviour (v1, before 002-003 lands)

- `current()` enumerates `table.tBodies[0].rows` in DOM order, each tagged `state: 'visible'`.
- `subscribe(cb)` stores `cb` in a per-table list but never invokes it; returns a no-op unsubscribe.

### Real behaviour (after 002-003 lands)

- `current()` reflects the latest sort + filter result with the correct `state` per row (dimmed rows surface for cumulative exclusion; hidden rows omitted entirely).
- `subscribe(cb)` invokes `cb` once per pipeline event (sort, filter, or composed). Multiple events in the same animation frame are coalesced into one `cb` call carrying the final state.

### Stability across the transition

The interface is the contract. When `002-003-row-visibility` replaces the stub, no scaffold or renderer code changes. The Playwright e2e test for US8 uses a test-time helper to install a mock that simulates real behaviour against the stub interface.

---

## 3. Copy-as-CSV registry interface

Defined in `src/utils/copy-as-csv-registry.ts`. Ships in this feature as a fully-working in-memory registry; consumed by `009-copy-as-csv` when that feature lands.

```ts
// src/utils/copy-as-csv-registry.ts

export interface VirtualColumnExport {
  /** Header text matching the appended <th>. */
  headerText: string;
  /** CSV/TSV text for a given source row. May return '' for placeholder cells. */
  getCellText(rowEl: HTMLTableRowElement): string;
}

export function registerVirtualColumnForCopy(
  table: HTMLTableElement,
  directiveId: string,
  exporter: VirtualColumnExport,
): void;

export function unregisterVirtualColumnForCopy(
  table: HTMLTableElement,
  directiveId: string,
): void;

/** Read-only enumeration. Intended for the copy-as-CSV implementation; not
 *  exposed on window.gridSight. Order matches the canonical column order
 *  (R-2). */
export function listVirtualColumnsForCopy(
  table: HTMLTableElement,
): ReadonlyArray<{ id: string; exporter: VirtualColumnExport }>;
```

### v1 behaviour (this feature)

- Backed by `WeakMap<HTMLTableElement, Map<string, VirtualColumnExport>>` (R-4, R-11).
- The order of `listVirtualColumnsForCopy` MUST equal the order of `registry.directives` — the scaffold guarantees this by registering in canonical order.

### Consumer (after 009 lands)

`009-copy-as-csv` will call `listVirtualColumnsForCopy(table)` when the user has the "include GS virtual columns" toggle on, append each `headerText` to the CSV header row, and call `getCellText(rowEl)` per row to fill the body. No scaffold changes are required when 009 lands.

---

## 4. Scaffold ↔ lozenge UI contract

The lozenge modules (`src/ui/virtual-column-lozenges.ts`, `src/ui/compare-picker.ts`) drive directives via the scaffold's directive-mutation API:

```ts
// src/enrichments/virtual-column.ts (excerpt)

export function activateDirective(directive: VirtualColumnDirective): AppendedColumnRecord | null;
export function mutateDirective(directiveId: string, patch: Partial<VirtualColumnDirective>): void;
export function removeDirective(directiveId: string): void;
```

- `activateDirective` runs the renderer's `canActivate` guard, places the directive at the canonical position, builds the `AppendedColumnRecord`, registers with the copy-as-CSV registry, persists to URL, and returns the record. Returns `null` if `canActivate` refuses or cardinality constraints would be violated.
- `mutateDirective` applies a partial patch (e.g. cycling `cumulative.mode`), re-renders only the affected record, and updates the URL fragment.
- `removeDirective` deregisters from copy-as-CSV, detaches the record's DOM, removes the directive from the registry, and updates the URL fragment.

Lozenges MUST NOT touch `AppendedColumnRecord` fields directly.

---

## 5. Test-time contracts

Two extension points exist for tests only (no production callers):

- **`__gridSightSetVisibleRowsImpl(impl)`** — installed by the Playwright helper at `tests/e2e/helpers/mock-vrs.ts`. Replaces the `getVisibleRows` factory for the duration of a test so US8 can be exercised against a deterministic mock pipeline. Removed when `002-003-row-visibility` lands.
- **`__gridSightFlushVirtualColumnFrame()`** — exposed in non-production builds; runs the `requestAnimationFrame` callback synchronously so unit tests don't need to `await new Promise(rAF)` between mutation and assertion.

Both are guarded by `if (import.meta.env.MODE !== 'production')` in `virtual-column.ts` so they're tree-shaken out of the IIFE.
