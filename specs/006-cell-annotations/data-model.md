# Phase 1 Data Model: Cell Annotations Enrichment

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Input**: [spec.md](./spec.md) Key Entities, [research.md](./research.md)

All shapes are in-memory TypeScript (no DB, no `localStorage`). The only durable
form is the `gs.a` URL fragment serialisation defined in
[`contracts/url-fragment-schema.md`](./contracts/url-fragment-schema.md).

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
  (`AnnotationKey`).

```ts
type AnnotationKey = string; // `${tableKey}/${rowKey}/${columnKey}`
```

---

## Entity: `Annotation`

A single note attached to one cell (spec Key Entities).

```ts
interface Annotation {
  readonly identity: CellIdentity;
  text: string;                // trimmed; 1..280 chars after clamp; never empty
}
```

**Rules**

- `text` MUST be 1–280 chars (FR-007). Input and paste are clamped to 280 at the
  textarea; a save of empty/whitespace-only text is treated as a **delete**.
- At most **one** `Annotation` per cell (spec edge case). Re-saving replaces the
  existing `text` in place.

---

## Entity: `AnnotationStore` (in-memory active set)

The live set of annotations on the page; the single source of truth that the
affordance/marker, popover, panel, and `gs.a` codec all read and write.

```ts
type AnnotationStore = Map<AnnotationKey, Annotation>;
```

**Lifecycle**

- **Load**: hydrated from `gs.a` (R-3). Entries whose triple resolves to a
  missing table/row/column (FR-016) or to an opted-out target
  (`data-gs-ignore`/`data-gs-no-annotate`, FR-012) are **dropped** during
  hydration and never enter the store.
- **Mutate**: `save(identity, text)` upserts; `delete(identity)` removes. Every
  mutation re-serialises the whole store to `gs.a` in one step (FR-009) —
  subject to the 8 KB cap (R-1).
- **Teardown**: on Grid-Sight toggle-off the store is cleared from the DOM
  (markers/affordances/`aria-describedby` nodes removed) but the `gs.a` fragment
  is left intact so toggle-on re-hydrates (spec edge case "Disabling Grid-Sight").

**State transitions**

```text
(no note)  --save(text)-->            (annotated)
(annotated) --save(newText)-->        (annotated, replaced)
(annotated) --save("" / whitespace)-> (no note)        # empty save == delete
(annotated) --delete-->               (no note)
(annotated) --save@cap(grows URL)-->  (annotated, unchanged) + inline error  # R-1 refuse-and-warn
```

---

## Entity: `PersistedAnnotationSet`

The serialisation of every active annotation into the `gs.a` fragment value
(grammar in `contracts/url-fragment-schema.md`). Not a separate runtime object —
it is the encode/decode of `AnnotationStore`:

- `encode(store): string` — joins `tableKey/rowKey/colKey:encodeURIComponent(text)`
  entries with `,`. Returns `''` for an empty store (removes the `gs.a` param).
- `decode(raw): Annotation[]` — parses, slug-validates each triple, skips
  malformed entries. Caller applies the missing-target / opt-out drops against
  the live DOM.
- **Cap**: if `encode(next)` would exceed **8 KB**, the mutation is refused
  (R-1); the previously persisted value is retained.

---

## Entity: `AnnotationPanelViewModel` (P3)

An ordered, table-grouped projection of `AnnotationStore` for the page-level
panel (spec Key Entities, FR-019/FR-020).

```ts
interface AnnotationPanelEntry {
  readonly key: AnnotationKey;
  readonly cell: HTMLTableCellElement;   // resolved live target for scroll-into-view
  readonly tableLabel: string;           // caption | id | data-gs-key | `Table n`
  readonly columnLabel: string;          // header text for the column
  readonly previewText: string;          // full note; truncated with ellipsis in CSS at one line
}

type AnnotationPanelViewModel = readonly AnnotationPanelEntry[]; // grouped by table, document order
```

**Rules**

- Built on panel open from the current `AnnotationStore`; entries whose `cell`
  cannot be resolved in the live DOM are omitted.
- Empty store → empty view model → panel renders a single empty-state message,
  no list items (US3 AC-3).
- Activating an entry scrolls `cell` into view and pulses its marker for ≥ 1
  animation frame (FR-020).

---

## Relationships

```text
CellIdentity 1───1 Annotation          (identity is the Annotation's key)
AnnotationStore 1───* Annotation       (keyed by AnnotationKey)
AnnotationStore ───encode/decode─── PersistedAnnotationSet (gs.a fragment)
AnnotationStore ───project─── AnnotationPanelViewModel (P3 read-only view)
Annotation ───aria-describedby─── HTMLTableCellElement (live cell, FR-022)
```

## Invariants

1. One annotation per cell; `AnnotationKey` is unique in the store.
2. `text` length ∈ [1, 280] for every stored annotation (empty == not stored).
3. The store never holds an entry targeting an opted-out or missing cell.
4. `gs.a` is the only durable form; nothing is written to `localStorage`/
   `sessionStorage`/cookies (FR-018).
5. Toggle-off leaves `gs.a` untouched; the DOM is restored byte-identical.
