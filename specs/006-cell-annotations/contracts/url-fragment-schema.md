# Contract: `gs.a` URL-Fragment Schema

**Feature**: 006-cell-annotations | **Date**: 2026-05-26
**Owner module**: `src/enrichments/annotation-persistence.ts`
**Related**: `gs.s` (`slider-persistence.ts`), `gs.e` (enrichment toggles),
`gs.v` (`view-state-url.ts`). All four parameters co-exist in `location.hash`
and each write-back preserves the others.

This contract fixes the on-the-wire shape of persisted annotations. While the
Development-Phase Posture is active (constitution §Development-Phase Posture),
this schema MAY change without a migration; the version is implicit (none) in v1.

---

## Location & co-existence

- Annotations live in the **URL fragment** (`location.hash`) under the parameter
  key `gs.a`. Example full hash:
  `#gs.v=sales(s:q3:desc),gs.a=sales/acme/q3:check%20with%20finance`
- Parameters are `&`-separated `key=value` pairs. Reads scan for the `gs.a=`
  segment; writes filter out any existing `gs.a=` and append the new one,
  leaving `gs.s`/`gs.e`/`gs.v` byte-identical (same helper pattern as
  `view-state-url.ts` `writeViewStateToHash`).
- Write-back uses
  `history.replaceState(null, '', location.pathname + location.search + newHash)`
  — no new history entry, no page reload (mirrors `persistPosition`).
- **No** `localStorage`, `sessionStorage`, IndexedDB, or cookie is read or
  written for annotations (FR-018). This is the deliberate divergence from
  `gs.s`, which also writes `localStorage`.

---

## Grammar

```text
gs.a-value   := entry ( "," entry )*
entry        := triple ":" enc-text
triple       := tableKey "/" rowKey "/" columnKey
tableKey     := slug
rowKey       := slug
columnKey    := slug
slug         := [a-z0-9-]+              ; lower-case, hyphen-separated
enc-text     := encodeURIComponent(noteText)   ; commas, slashes, colons escaped
```

- The three triple segments are derived per [data-model.md](../data-model.md)
  (`CellIdentity`) and are each already constrained to `[a-z0-9-]+`, so `/`,
  `:`, and `,` never appear *inside* a segment — they are unambiguous
  delimiters.
- `enc-text` is `encodeURIComponent` of the raw note, so the structural
  delimiters (`,`, `/`, `:`) inside note text are percent-escaped and safe.
- Entry order in the encoded value is **table document order, then row order,
  then column order** (deterministic) so the same store always produces the same
  string (stable URLs, testable round-trip).

### Examples

| Store | Encoded `gs.a` value |
|-------|----------------------|
| empty | *(param omitted entirely)* |
| one note `sales/acme/q3 = "check with finance"` | `sales/acme/q3:check%20with%20finance` |
| note containing a comma | `t0/r2/price:1%2C000%20is%20wrong` |

---

## Decoding rules

1. Split the value on `,`. For each `entry`, split once on the **first** `:` into
   `triple` and `enc-text`; `lastIndexOf` is not needed because the triple
   contains no `:`.
2. Split `triple` on `/` into exactly three segments; reject entries that do not
   produce three non-empty `[a-z0-9-]+` segments (malformed → skip silently).
3. `decodeURIComponent(enc-text)`; on throw, skip the entry. Clamp to 280 chars.
4. Resolve the triple against the **live DOM**:
   - Missing table, missing row, or missing column → **silently drop** (FR-016).
   - Target cell (or its table) carries `data-gs-ignore` or `data-gs-no-annotate`
     → **silently drop** (FR-012).
5. Surviving entries populate the `AnnotationStore` and render markers before
   first user interaction (FR-015, SC-002: within one animation frame).

Malformed input never throws into the host page (constitution §IV); the worst
case is an empty store.

---

## Encoding rules

1. Iterate the store in the deterministic order above.
2. For each annotation emit `tableKey/rowKey/columnKey:encodeURIComponent(text)`.
3. Join with `,`. An empty store encodes to `''`, which **removes** the `gs.a`
   parameter from the hash.

---

## Size cap (8 KB) — refuse-and-warn (FR-017, research R-1)

- Before committing a **save that adds or grows** an entry, compute the encoded
  length of the *would-be* value. If the resulting `gs.a` value exceeds
  **8 192 bytes** (UTF-8), the save is **refused**:
  - the popover stays open,
  - an inline error renders in the popover: *"URL is full — delete an existing
    note to add a new one"*,
  - the previously persisted `gs.a` value and store are left untouched.
- Saves that **shrink or keep** the encoded length (shortening/replacing an
  existing note, deleting) are always permitted, even at the cap.
- Existing annotations are NEVER silently dropped to make room.

---

## Invariants (testable)

| # | Invariant | Test |
|---|-----------|------|
| U1 | `decode(encode(store))` reproduces the store for any valid store ≤ 8 KB | unit round-trip |
| U2 | Note text with `,` `/` `:` round-trips losslessly | unit |
| U3 | An entry for a missing table/row/column is dropped, no throw | unit + e2e (US2 AC-2) |
| U4 | An entry targeting `data-gs-ignore`/`data-gs-no-annotate` is dropped | unit |
| U5 | A save that would exceed 8 KB is refused; prior value retained | unit |
| U6 | Writing `gs.a` preserves co-existing `gs.s`/`gs.e`/`gs.v` segments | unit |
| U7 | Empty store removes the `gs.a` param from the hash | unit |
| U8 | No `localStorage`/`sessionStorage`/cookie access on any read or write | unit (spies) + e2e on clean profile (US2 AC-3) |
