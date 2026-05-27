# Contract: Annotations Module API

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Owner modules**: `src/enrichments/annotations.ts`,
`annotation-identity.ts`, `annotation-persistence.ts`, `annotation-index.ts`;
`src/ui/annotation-affordance.ts`, `annotation-popover.ts`, `annotation-popup.ts`.

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
 *  `annotations` enrichment is in the effective enabled set. Idempotent.
 *  Hydrates the current document's store from localStorage on first call. */
export function applyAnnotations(table: HTMLTableElement): void;

/** Remove every annotation affordance, marker, aria-describedby node, open
 *  popover, and the relative-positioning shim from `table`. Restores
 *  byte-identical DOM. Does NOT clear localStorage. (Registry tearDown.) */
export function tearDownAnnotations(table: HTMLTableElement): void;

/** Upsert a note for `cell`. Empty/whitespace text deletes. Enforces the
 *  280-char clamp, sets modifiedAt, and writes the document envelope to
 *  localStorage. Returns the outcome so the popover can show the quota
 *  refuse-and-warn inline error. Re-renders the marker. */
export function saveAnnotation(
  cell: HTMLTableCellElement,
  text: string,
): { ok: true } | { ok: false; reason: 'quota' };

/** Delete the note for `cell` (if any): removes marker + aria-describedby,
 *  rewrites localStorage. No-op if the cell has no note. */
export function deleteAnnotation(cell: HTMLTableCellElement): void;

/** Current note text for a cell, or undefined. Used by the popover on open. */
export function getAnnotation(cell: HTMLTableCellElement): string | undefined;

/** Whether localStorage holds ≥ 1 annotation for the current origin — gates the
 *  "Show annotations" menu entry (FR-020). */
export function hasAnyAnnotationsForOrigin(): boolean;

/** Consume a transient `#gs.annot=<key>` navigation hint: resolve the cell,
 *  scroll it into view, pulse the marker, then clear the hint from the hash.
 *  No-op (and silent clear) when the hint is absent or unresolvable. Called
 *  once on load from index.ts. (FR-019, FR-021) */
export function consumeNavigationHint(): void;
```

**Behavioural guarantees**

- `applyAnnotations` renders surviving markers within one animation frame
  (SC-002, FR-015). When `localStorage` is unavailable it runs session-only and
  warns once per page (FR-017).
- A table/cell with `data-gs-ignore` or `data-gs-no-annotate` never receives an
  affordance, and any stored entry targeting it is dropped (FR-012).
- `saveAnnotation` performs close-popover + paint-marker + write-`localStorage`
  as a single user-visible step (FR-009); on `{ ok:false, reason:'quota' }` it
  leaves the prior stored value and store entry untouched (FR-017).

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

/** Canonical map-key string `${tableKey}/${rowKey}/${columnKey}` (also the
 *  value of the #gs.annot navigation hint). */
export function identityKey(id: CellIdentity): string;

/** Parse an identityKey string back into a CellIdentity (for the nav hint). */
export function parseIdentityKey(key: string): CellIdentity | null;

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

Schema and caps fixed by [`localstorage-schema.md`](./localstorage-schema.md).

```ts
interface StoredEntry { t: string; m: number; }

/** Read the current document's annotations from localStorage. Returns [] on
 *  missing/malformed/legacy envelopes or when storage is unavailable. Does NOT
 *  resolve against the DOM — caller drops missing/opted-out. */
export function readDocumentAnnotations(): Array<{ id: CellIdentity; text: string; modifiedAt: number }>;

/** Write the document's annotations to localStorage (version:1 envelope with
 *  document.title). Empty input removes the key. Returns the write outcome so
 *  callers can surface the quota refuse-and-warn (FR-017). */
export function writeDocumentAnnotations(
  entries: Array<{ id: CellIdentity; text: string; modifiedAt: number }>,
): { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

/** True when localStorage is readable/writable in this context. */
export function isStorageAvailable(): boolean;
```

Reuses `urlStem()` / `storageKeyFor()` from `src/utils/slider-persistence.ts`
(`suffix = 'annotations'`).

---

## `src/enrichments/annotation-index.ts` (cross-document)

```ts
interface CrossDocEntry {
  readonly key: string;            // AnnotationKey
  readonly documentUrl: string;
  readonly documentLabel: string;
  readonly isCurrentDocument: boolean;
  readonly columnLabel: string;
  readonly previewText: string;
  readonly modifiedAt: number;
}
type AnnotationPopupViewModel = ReadonlyArray<{
  documentUrl: string; documentLabel: string; entries: readonly CrossDocEntry[];
}>;

/** Scan localStorage for every `^gs:.*:annotations$` key on the current origin
 *  and build the popup view model, grouped by document (most-recently-modified
 *  first). Built on popup open, never on the load hot path. (R-8) */
export function buildCrossDocumentIndex(): AnnotationPopupViewModel;
```

---

## `src/ui/annotation-affordance.ts`

```ts
/** Reveal/manage the hover+focus pin affordance for a body cell, and render the
 *  persistent corner marker when the cell has a saved note. Wires the marker's
 *  accessible name and the cell's aria-describedby (FR-002,3,4,23,25). */
export function mountAffordance(cell: HTMLTableCellElement): void;

/** Show/refresh the persistent corner marker for a cell that has a note. */
export function renderMarker(cell: HTMLTableCellElement, text: string): void;

/** Remove marker + aria-describedby node from a cell. */
export function clearMarker(cell: HTMLTableCellElement): void;

/** Briefly pulse a cell's marker (popup scroll-target highlight, FR-021). */
export function pulseMarker(cell: HTMLTableCellElement): void;
```

---

## `src/ui/annotation-popover.ts`

```ts
/** Open the editor popover anchored to `cell`, pre-filled with any existing
 *  note. Focus lands in the textarea; Tab cycles Save/Delete; Escape closes
 *  without saving (FR-005,6). Delete disabled when no note exists (FR-008).
 *  Textarea clamps input + paste to 280 chars (FR-007). On Save, calls
 *  saveAnnotation and, on { ok:false }, shows the inline quota error and keeps
 *  the popover open (FR-017). Delegates focus-trap/Escape/outside-click to
 *  installPopupChrome. */
export function openAnnotationPopover(cell: HTMLTableCellElement): void;
```

---

## `src/ui/annotation-popup.ts` (P3)

```ts
/** Add the "Show annotations" entry to the GS surface; visible only when
 *  hasAnyAnnotationsForOrigin() is true (FR-020). */
export function registerAnnotationsMenuEntry(): void;

/** Open the cross-document popup from buildCrossDocumentIndex(): every note
 *  grouped by document with label, column/cell context, truncated text, and
 *  last-modified date. Arrow keys navigate, Enter activates, Escape closes
 *  (FR-020,21,22). Activating an entry: same document → scrollIntoView + pulse;
 *  other document (same origin) → navigate to documentUrl#gs.annot=key.
 *  Empty index → single empty-state message (US3 AC-4). */
export function openAnnotationsPopup(): void;
```

---

## `src/index.ts` wiring

- Call `applyAnnotations(table)` for each processed table when the `annotations`
  enrichment is in the effective enabled set (alongside the existing
  apply-per-enrichment flow in `processTable`).
- Register the menu entry once per page via `registerAnnotationsMenuEntry()`.
- Call `consumeNavigationHint()` once on load (after tables are processed) so a
  `#gs.annot=` deep-link from the popup scrolls to and pulses its cell.
- No change to `window.gridSight.init` / `processTable` / `isValidTable`
  signatures (the API surface in constitution §Performance & Distribution).
