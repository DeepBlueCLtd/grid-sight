# Contract: Annotations Module API

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Owner modules**: `src/enrichments/annotations.ts`,
`annotation-identity.ts`, `annotation-persistence.ts`;
`src/ui/annotation-affordance.ts`, `annotation-popover.ts`, `annotation-panel.ts`.

Internal library surface (not part of the frozen `window.gridSight.*` public
API). While the Development-Phase Posture is active these signatures MAY change.
The contract exists so downstream modules, tests, and the registry agree on the
shape.

---

## Registry wiring (`src/core/enrichment-registry.ts`)

The `annotations` entry already exists as spec-only. This feature changes it:

```diff
- { id: 'annotations', label: 'Cell annotations', defaultOn: true, shipped: false },  // spec 006
+ { id: 'annotations', label: 'Cell annotations', defaultOn: true, shipped: true,  tearDown: tearDownAnnotations },  // spec 006
```

- `tearDownAnnotations(table: HTMLTableElement): void` is imported from
  `../enrichments/annotations`.
- Boot-time validation already enforces "shipped ⇒ may have tearDown" and
  "spec-only ⇒ no tearDown"; flipping `shipped` and adding `tearDown` keeps it
  valid.

---

## `src/enrichments/annotations.ts` (orchestration)

```ts
/** Apply annotations to a table when Grid-Sight is enabled and the
 *  `annotations` enrichment is in the effective enabled set. Idempotent. */
export function applyAnnotations(table: HTMLTableElement): void;

/** Remove every annotation affordance, marker, aria-describedby node, open
 *  popover, and the relative-positioning shim from `table`. Restores
 *  byte-identical DOM. Does NOT clear the `gs.a` fragment. (Registry tearDown.) */
export function tearDownAnnotations(table: HTMLTableElement): void;

/** Upsert a note for `cell`. Empty/whitespace text deletes. Enforces 280-char
 *  clamp and the 8 KB URL cap (returns the outcome so the popover can show the
 *  refuse-and-warn inline error). Re-renders the marker and rewrites `gs.a`. */
export function saveAnnotation(
  cell: HTMLTableCellElement,
  text: string,
): { ok: true } | { ok: false; reason: 'url-full' };

/** Delete the note for `cell` (if any): removes marker + aria-describedby,
 *  rewrites `gs.a`. No-op if the cell has no note. */
export function deleteAnnotation(cell: HTMLTableCellElement): void;

/** Current note text for a cell, or undefined. Used by the popover on open. */
export function getAnnotation(cell: HTMLTableCellElement): string | undefined;

/** Whether the page currently has ≥ 1 annotation — gates the "Show
 *  annotations" menu entry (FR-019). */
export function hasAnyAnnotations(): boolean;
```

**Behavioural guarantees**

- `applyAnnotations` hydrates from `gs.a` on first call (per page) and renders
  surviving markers within one animation frame (SC-002, FR-015).
- A table/cell with `data-gs-ignore` or `data-gs-no-annotate` never receives an
  affordance, and any `gs.a` entry targeting it is dropped (FR-012).
- `saveAnnotation` performs the close-popover + paint-marker + write-`gs.a` as a
  single user-visible step (FR-009).

---

## `src/enrichments/annotation-identity.ts`

```ts
export interface CellIdentity {
  readonly tableKey: string;
  readonly rowKey: string;
  readonly columnKey: string;
}

/** Derive (and memoise via WeakMap) the load-time-stable identity triple for a
 *  body cell. Stable across sort/filter reorders (FR-010, FR-011). */
export function cellIdentity(cell: HTMLTableCellElement): CellIdentity;

/** Canonical map-key string `${tableKey}/${rowKey}/${columnKey}`. */
export function identityKey(id: CellIdentity): string;

/** True when the table or the cell opts out via data-gs-ignore /
 *  data-gs-no-annotate (FR-012). */
export function isOptedOut(cell: HTMLTableCellElement): boolean;

/** Resolve a live body cell for an identity triple, or null if the
 *  table/row/column no longer exists (FR-016). */
export function resolveCell(id: CellIdentity): HTMLTableCellElement | null;
```

- `tableKey` fallback to a document-order index emits **one** `console.warn` per
  page (FR-013), tracked by a module-level `Set`.
- `columnKey` reuses `colKey` from `src/utils/view-state-url.ts`.

---

## `src/enrichments/annotation-persistence.ts`

```ts
/** Parse the `gs.a` value into raw entries (triple + text), skipping malformed
 *  parts. Does NOT resolve against the DOM — caller drops missing/opted-out. */
export function decodeAnnotations(raw: string): Array<{ id: CellIdentity; text: string }>;

/** Serialise entries into a `gs.a` value (deterministic order). '' when empty. */
export function encodeAnnotations(entries: Array<{ id: CellIdentity; text: string }>): string;

/** Read `gs.a` from the current hash (or supplied hash). */
export function readAnnotationsFromUrl(hash?: string): Array<{ id: CellIdentity; text: string }>;

/** Write entries to `gs.a` in a new hash, preserving gs.s/gs.e/gs.v.
 *  Returns the new hash string. */
export function writeAnnotationsToUrl(
  entries: Array<{ id: CellIdentity; text: string }>,
  currentHash?: string,
): string;

/** Commit entries to location via history.replaceState (no history entry). */
export function commitAnnotationsToLocation(entries: Array<{ id: CellIdentity; text: string }>): void;

/** Encoded byte length of `gs.a` value for these entries — used for the 8 KB
 *  cap check before committing a growing save (FR-017). */
export function encodedByteLength(entries: Array<{ id: CellIdentity; text: string }>): number;
```

Schema and caps fixed by [`url-fragment-schema.md`](./url-fragment-schema.md).

---

## `src/ui/annotation-affordance.ts`

```ts
/** Reveal/manage the hover+focus pin affordance for a body cell, and render the
 *  persistent corner marker when the cell has a saved note. Wires the marker's
 *  accessible name and the cell's aria-describedby (FR-002,3,4,22,24). */
export function mountAffordance(cell: HTMLTableCellElement): void;

/** Show/refresh the persistent corner marker for a cell that has a note. */
export function renderMarker(cell: HTMLTableCellElement, text: string): void;

/** Remove marker + aria-describedby node from a cell. */
export function clearMarker(cell: HTMLTableCellElement): void;

/** Briefly pulse a cell's marker (panel scroll-target highlight, FR-020). */
export function pulseMarker(cell: HTMLTableCellElement): void;
```

---

## `src/ui/annotation-popover.ts`

```ts
/** Open the editor popover anchored to `cell`, pre-filled with any existing
 *  note. Focus lands in the textarea; Tab cycles Save/Delete; Escape closes
 *  without saving (FR-005,6). Delete disabled when no note exists (FR-008).
 *  Textarea clamps input + paste to 280 chars (FR-007). On Save, calls
 *  saveAnnotation and, on { ok:false }, shows the inline url-full error and
 *  keeps the popover open (FR-017). Delegates focus-trap/Escape/outside-click
 *  to installPopupChrome. */
export function openAnnotationPopover(cell: HTMLTableCellElement): void;
```

---

## `src/ui/annotation-panel.ts` (P3)

```ts
/** Add the "Show annotations" entry to the GS surface; visible only when
 *  hasAnyAnnotations() is true (FR-019). */
export function registerAnnotationsMenuEntry(): void;

/** Open the page-level panel listing every annotation grouped by table, with
 *  table + column context and truncated text. Arrow keys navigate, Enter
 *  scroll-targets + pulses the cell, Escape closes (FR-019,20,21). Empty store
 *  → single empty-state message (US3 AC-3). */
export function openAnnotationsPanel(): void;
```

---

## `src/index.ts` wiring

- Call `applyAnnotations(table)` for each processed table when the `annotations`
  enrichment is in the effective enabled set (alongside the existing
  apply-per-enrichment flow in `processTable`).
- Register the menu entry once per page via `registerAnnotationsMenuEntry()`.
- No change to `window.gridSight.init` / `processTable` / `isValidTable`
  signatures (the API surface in constitution §Performance & Distribution).
