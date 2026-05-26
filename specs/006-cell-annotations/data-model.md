# Phase 1 Data Model: Cell Annotations Enrichment

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

All shapes are in-memory TypeScript. The only durable form is the per-document
`localStorage` envelope defined in
[`contracts/localstorage-schema.md`](./contracts/localstorage-schema.md).

---

## Entity: `CellIdentity` (the identity triple)

The persistence key for an annotation, derived from the **load-time** source DOM
and stable across reorders (FR-010, FR-011, R-2).

```ts
interface CellIdentity {
  readonly tableKey: string;   // data-gs-key | id | slug(caption) | `t${index}`
  readonly rowKey: string;     // data-gs-row-key | slug(firstCellText) | `r${index}`
  readonly columnKey: string;  // colKey(header, columnIndex) from view-state-url.ts
}
```

**Derivation rules**

| Segment | Preference order | Fallback marker |
|---------|------------------|-----------------|
| `tableKey` | `data-gs-key` → `id` → slug(`<caption>`) → doc-order index | `t${n}` (triggers one-per-page console warning, FR-013) |
| `rowKey` | `data-gs-row-key` on `<tr>` → slug(first `<th scope=row>`/first `<td>` text) → load-time data-row index | `r${n}` |
| `columnKey` | `colKey(headerCell, columnIndex)` (existing helper) | `c${n}` |

**Validation**

- Each segment is slugified to `^[a-z0-9-]+$`; empty results fall back to the
  index marker.
- The triple is computed **once** per cell (memoised on the cell via a
  `WeakMap<HTMLTableCellElement, CellIdentity>`), so later sort/filter passes do
  not recompute it from shifted positions.
- A serialised string form `tableKey/rowKey/columnKey` is the canonical map key
  (`AnnotationKey`) and the value of the transient `#gs.annot=` navigation hint.

```ts
type AnnotationKey = string; // `${tableKey}/${rowKey}/${columnKey}`
```

---

## Entity: `Annotation`

A single note attached to one cell (spec Key Entities).

```ts
interface Annotation {
  readonly identity: CellIdentity;
  text: string;        // trimmed; 1..280 chars after clamp; never empty
  modifiedAt: number;  // epoch ms, set on every create/replace (FR-018)
}
```

**Rules**

- `text` MUST be 1–280 chars (FR-007). Input and paste are clamped to 280 at the
  textarea; a save of empty/whitespace-only text is treated as a **delete**.
- At most **one** `Annotation` per cell (spec edge case). Re-saving replaces the
  `text` in place **and** refreshes `modifiedAt`.

---

## Entity: `AnnotationStore` (in-memory active set for the current document)

The live set of annotations on the current document; the single source of truth
that the affordance/marker, popover, and persistence codec read and write.

```ts
type AnnotationStore = Map<AnnotationKey, Annotation>;
```

**Lifecycle**

- **Load**: hydrated from the document's `localStorage` envelope (R-3). Entries
  whose triple resolves to a missing table/row/column (FR-016) or to an opted-out
  target (`data-gs-ignore`/`data-gs-no-annotate`, FR-012) are **dropped** during
  hydration and never enter the store. If `localStorage` is unavailable the store
  simply starts empty and runs session-only (FR-017).
- **Mutate**: `save(identity, text)` upserts (and sets `modifiedAt = Date.now()`);
  `delete(identity)` removes. Every mutation re-writes the document envelope to
  `localStorage` in one step (FR-009), subject to the quota guard (R-1).
- **Teardown**: on Grid-Sight toggle-off the DOM is restored (markers/affordances/
  `aria-describedby` nodes removed) but the `localStorage` envelope is left intact
  so toggle-on re-hydrates (spec edge case "Disabling Grid-Sight").

**State transitions**

```text
(no note)  --save(text)-->            (annotated, modifiedAt=now)
(annotated) --save(newText)-->        (annotated, replaced, modifiedAt=now)
(annotated) --save("" / whitespace)-> (no note)                 # empty save == delete
(annotated) --delete-->               (no note)
(annotated) --save@quota-->           (annotated, unchanged) + inline error   # R-1 refuse-and-warn
```

---

## Entity: `PerDocumentAnnotationSet` (durable form)

The serialisation of every active annotation on one document into its
`localStorage` envelope (full grammar in `contracts/localstorage-schema.md`). Not
a separate runtime object — it is the read/write of `AnnotationStore`:

```jsonc
// localStorage key: gs:${origin+pathname}:annotations
{ "version": 1,
  "title": "<document.title at write time>",
  "entries": { "<AnnotationKey>": { "t": "<text>", "m": <epochMs> } } }
```

- `write(store)` — serialise non-empty store; an empty store **removes** the key.
- `read()` — parse + version-check; malformed/legacy envelopes yield an empty
  set. Caller applies the missing-target / opt-out drops against the live DOM.
- **Quota**: if `setItem` throws (quota), the write is refused (R-1); the prior
  stored value is retained.

---

## Entity: `CrossDocumentIndex` + `AnnotationPopupViewModel` (P3)

The aggregate over **all** annotation keys for the current origin, backing the
cross-document popup (spec Key Entities, FR-020/FR-021, research R-8).

```ts
interface CrossDocEntry {
  readonly key: AnnotationKey;
  readonly documentUrl: string;          // reconstructed from the localStorage key stem
  readonly documentLabel: string;        // envelope.title || pathname
  readonly isCurrentDocument: boolean;   // documentUrl stem === current stem
  readonly columnLabel: string;          // columnKey (humanised where possible)
  readonly previewText: string;          // full note; CSS-truncated at one line
  readonly modifiedAt: number;           // epoch ms, for the displayed date
}

// grouped by document, documents in most-recently-modified order,
// entries within a document by modifiedAt desc
type AnnotationPopupViewModel = ReadonlyArray<{
  readonly documentUrl: string;
  readonly documentLabel: string;
  readonly entries: readonly CrossDocEntry[];
}>;
```

**Rules**

- Built **on popup open** by scanning `localStorage` for `^gs:.*:annotations$`
  keys (R-8); never on the page-load hot path.
- For the **current** document, `isCurrentDocument` entries resolve a live cell
  for in-place scroll; for other documents, activation navigates to
  `documentUrl + '#gs.annot=' + key`.
- Empty aggregate → empty view model → popup renders a single empty-state message
  (US3 AC-4).

---

## Transient: `NavigationHint`

Not persisted. When the popup navigates to another document it appends
`#gs.annot=<AnnotationKey>` to the target URL. On load, `index.ts` reads it,
resolves the cell, scrolls + pulses the marker, then clears the hint with
`history.replaceState` (FR-019, FR-021). If the hint's cell cannot be resolved,
it is cleared silently with no error.

---

## Relationships

```text
CellIdentity 1───1 Annotation              (identity is the Annotation's key)
AnnotationStore 1───* Annotation           (current document, keyed by AnnotationKey)
AnnotationStore ───read/write─── PerDocumentAnnotationSet (localStorage envelope)
localStorage (gs:*:annotations) ───scan─── CrossDocumentIndex ───project─── AnnotationPopupViewModel
Annotation ───aria-describedby─── HTMLTableCellElement (live cell, FR-023)
AnnotationPopupViewModel ───navigate via #gs.annot─── target document
```

## Invariants

1. One annotation per cell; `AnnotationKey` is unique within a document's store.
2. `text` length ∈ [1, 280] for every stored annotation (empty == not stored).
3. `modifiedAt` is set on every create/replace.
4. The store never holds an entry targeting an opted-out or missing cell.
5. `localStorage` (per-document `gs:…:annotations` key) is the only durable form;
   the URL fragment is never a persistence channel (FR-019).
6. Toggle-off leaves the `localStorage` envelope untouched; the DOM is restored
   byte-identical.
7. The cross-document index reflects only the current origin (per-origin
   `localStorage`).
