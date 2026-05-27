# Contract: Annotations `localStorage` Schema

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Owner module**: `src/enrichments/annotation-persistence.ts` (per-document
read/write) + `src/enrichments/annotation-index.ts` (cross-document scan)
**Related**: `gs:${stem}:sliders` and `gs:${stem}:enrichments`
(`slider-persistence.ts`). Annotations reuse the same `gs:` prefix and
per-URL-stem derivation but a distinct `annotations` suffix and payload shape.

This contract fixes the durable form of annotations. While the
Development-Phase Posture is active (constitution §Development-Phase Posture),
this schema MAY change without a migration; legacy/malformed envelopes are
skipped, not migrated.

---

## Key scheme

```text
gs:${origin + pathname}:annotations
```

- `origin + pathname` is the **stem** from `urlStem()` in
  `src/utils/slider-persistence.ts` (no search, no hash). One key per document.
- Reuses `storageKeyFor(suffix, stem)` → `gs:${stem}:${suffix}` with
  `suffix = 'annotations'`. (Export `urlStem`/`storageKeyFor` from
  `slider-persistence.ts` if not already exported.)
- The cross-document index enumerates `localStorage` and selects keys matching
  `^gs:.*:annotations$` for the current origin (R-8). The document URL for
  navigation is reconstructed from the key's stem.

**No** `sessionStorage`, IndexedDB, cookie, or **URL-fragment** persistence is
used (FR-019). The URL fragment carries only the transient `#gs.annot=` cell hint.

---

## Envelope

```jsonc
{
  "version": 1,
  "title": "Quarterly Sales",          // optional; document.title at write time
  "entries": {
    "sales/acme/q3": { "t": "check with finance", "m": 1769414400000 },
    "sales/globex/q3": { "t": "verify", "m": 1769410800000 }
  }
}
```

| Field | Type | Rule |
|-------|------|------|
| `version` | number | `1` for this schema. A value `!== 1` ⇒ treat as absent (skip). |
| `title` | string? | Friendly label for the cross-document popup; falls back to the pathname when missing. |
| `entries` | object | Map of `AnnotationKey` → `{ t, m }`. Empty/absent ⇒ no annotations; the whole key is removed when the set becomes empty. |
| `entries[k].t` | string | Note text, 1–280 chars (clamped on write). |
| `entries[k].m` | number | Last-modified epoch ms (FR-018). |

- `AnnotationKey` = `tableKey/rowKey/columnKey`, each segment `[a-z0-9-]+`
  (derivation in [data-model.md](../data-model.md)). The `/` separators are
  unambiguous because segments contain no `/`.
- Text is stored as a normal JSON string (JSON handles escaping); no
  percent-encoding needed.

---

## Read rules (per document)

1. `getItem(gs:${stem}:annotations)`; missing/`null` ⇒ empty set.
2. `JSON.parse` inside `try/catch`; on throw ⇒ empty set (never throws into host).
3. Reject envelopes where `version !== 1` ⇒ empty set.
4. For each `entries` pair: validate the key is three non-empty `[a-z0-9-]+`
   segments, `t` is a string (clamp to 280), `m` is a finite number (default
   `Date.now()` if absent). Skip malformed pairs.
5. Resolve each key against the **live DOM**:
   - missing table/row/column ⇒ **silently drop** (FR-016);
   - target (or its table) has `data-gs-ignore`/`data-gs-no-annotate` ⇒ **drop**
     (FR-012).
6. Survivors populate the `AnnotationStore`; markers render within one animation
   frame of first paint (FR-015, SC-002).

---

## Write rules (per document)

1. Serialise the non-empty `AnnotationStore` into the envelope (`version: 1`,
   current `document.title` as `title`, each entry `{ t, m }`).
2. `setItem` inside `try/catch`:
   - **success** ⇒ done (single user-visible step with marker render, FR-009);
   - **quota exception** ⇒ **refuse** the triggering save: keep the prior stored
     value, keep the popover open, show the inline error "Storage is full —
     delete an existing note to add a new one" (FR-017, R-1). Existing notes are
     never dropped.
3. An empty store ⇒ `removeItem` (no empty envelope left behind).
4. If `localStorage` itself is unavailable (access throws) ⇒ skip persistence,
   run session-only, emit at most one `console.warn` per page (FR-017).

---

## Transient navigation hint (not persisted)

When the cross-document popup activates an entry on **another** document:

```text
<targetDocumentUrl>#gs.annot=<tableKey>/<rowKey>/<columnKey>
```

On load, `index.ts` reads `gs.annot` from the hash, resolves the cell, scrolls it
into view and pulses the marker, then **clears** the hint via
`history.replaceState(null, '', location.pathname + location.search)` so it does
not linger (FR-019, FR-021). An unresolvable hint is cleared silently.

---

## Invariants (testable)

| # | Invariant | Test |
|---|-----------|------|
| U1 | `read(write(store))` reproduces the store (text + modifiedAt) | unit round-trip |
| U2 | `version !== 1` or malformed JSON ⇒ empty set, no throw | unit |
| U3 | A stored entry for a missing table/row/column is dropped on load | unit + e2e (US2 AC-2) |
| U4 | A stored entry targeting `data-gs-ignore`/`data-gs-no-annotate` is dropped | unit |
| U5 | A save that throws quota is refused; prior value retained; inline error shown | unit |
| U6 | `localStorage` unavailable ⇒ session-only, one warning, no throw | unit (stubbed storage) |
| U7 | Empty store removes the `gs:…:annotations` key | unit |
| U8 | Every create/replace sets `modifiedAt`; delete removes the entry | unit |
| U9 | Cross-document scan selects only `^gs:.*:annotations$` keys for the origin | unit |
| U10 | `#gs.annot` hint scrolls+pulses the cell then clears itself | e2e (US3 AC-3, SC-006) |
| U11 | No URL-fragment persistence; reload restores purely from `localStorage` | e2e clean profile (SC-003) |
