# Contract: Combined sort + filter URL-fragment schema (`gs.v`)

**Spec**: [../spec.md](../spec.md) · **Plan**: [../plan.md](../plan.md) · **Research**: [../research.md](../research.md) §R-4 · **Date**: 2026-05-19

This document fixes the URL serialisation that satisfies **FR-VP-006**
(single per-page namespace), **FR-VP-007** (filters applied before sort
on load), and **SC-004** (100% reproducibility across machines without
`localStorage`).

The codec lives in `src/utils/view-state-url.ts`. It is **separate** from
the slider codec in `src/utils/slider-persistence.ts` (`gs.s`) — the two
co-exist in `location.hash`, keyed independently. Per-URL-stem scope
(origin + pathname) is inherited from the slider codec's behaviour but
expressed only in the surrounding load/save glue; the codec itself is
pure.

---

## Fragment parameter

```text
gs.v=<table-directive>(,<table-directive>)*
```

Sits inside `location.hash` as one `&`-separated parameter. Other
parameters (notably `gs.s` for sliders) are preserved on every read /
write.

---

## Table directive grammar

```text
table-directive    := <table-id> "(" <body> ")"
body               := <filter-clause>* <sort-clause>?
filter-clause      := "f:" <col-key> ":" <predicate-body> ";"
sort-clause        := "s:" <col-key> ":" <direction>
direction          := "asc" | "desc"
col-key            := slug(header-text) | "c" <columnIndex>
predicate-body     := <numeric-range> | <categorical-list>
numeric-range      := "n:" [ <number> ] ":" [ <number> ] [ ":h" ]
                      ; first number = min, second = max; trailing ":h" sets hideEmpty
                      ; either bound may be empty (open-ended)
categorical-list   := "v:" <value> ( "|" <value> )* [ ":h" ]
value              := URL-encoded UTF-8 string (percent-encoding); empty string allowed
```

**Ordering inside the body matters**: filters always precede the sort
clause. The parser MUST apply filters before sort on load (FR-VP-007).
Encoders MUST emit filters first.

---

## Worked examples

| State | URL fragment value |
|-------|--------------------|
| Sort `Amount` descending, no filters, table id `tbl-orders` | `gs.v=tbl-orders(s:amount:desc)` |
| Numeric range `100–500` on `Amount`, no sort | `gs.v=tbl-orders(f:amount:n:100:500;)` |
| Numeric range `100–∞`, hide empties, sorted desc | `gs.v=tbl-orders(f:amount:n:100::h;s:amount:desc)` |
| Categorical filter `Region ∈ {EU, US}`, sorted `Date` asc | `gs.v=tbl-orders(f:region:v:EU%7CUS;s:date:asc)` |
| Two tables on one page | `gs.v=t1(s:name:asc),t2(f:status:v:open;)` |

---

## Column-key derivation

Implemented in `view-state-url.ts`:

```ts
function colKey(header: HTMLTableCellElement, columnIndex: number): string {
  const text = (header.textContent ?? '').trim().toLowerCase();
  const slug = text.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `c${columnIndex}`;
}
```

- Stable across reloads while header text is unchanged.
- Collision (two columns slug to the same key) → second occurrence falls
  back to `c<columnIndex>`; the codec disambiguates on encode by
  preferring the leftmost match on decode.
- Headers changing text after persistence → the directive is silently
  dropped on load (matches the "missing column → silently dropped"
  rule).

---

## Parse / encode semantics

- **Round-trip**: `parse(encode(state)) === state` for every valid
  state. Covered by `view-state-url.test.ts`.
- **Lenient decode**: any unparseable directive is dropped, NOT thrown.
  The rest of the URL still applies.
- **Empty state never written**: when a table has neither sort nor
  filters, its directive is omitted from `gs.v`. When `gs.v` itself is
  empty, the parameter is removed from the fragment (matches
  `slider-persistence.ts` behaviour).
- **Order of tables**: encoders list table directives in DOM order.
  Decoders do not depend on order.
- **Character budget**: keep directives compact — typical URLs in the
  demo pages target < 200 characters of `gs.v` payload. No hard limit.
- **No base64, no JSON.stringify**: the grammar above is the canonical
  form. Choosing a tiny custom grammar over JSON saves ~30% of bytes
  and avoids the special-character escaping that JSON requires inside
  a fragment.

---

## Restore-on-load sequence

In `src/index.ts` `init()`, *before* the lozenge cluster mounts:

```text
1. parse location.hash → { tables: [{ id, sort, filters[] }] }
2. for each parsed entry whose table exists on the page:
     a. apply each filter predicate via setFilter(table, colIdx, pred)
        (filter-then-sort order per FR-VP-007)
     b. apply sort via setSort(table, sortDirective) if present
3. proceed with normal processTable() / injectPlusIcons() so the lozenges
   mount already reflecting the restored state.
```

This satisfies **SC-003** (no flash beyond one animation frame) because
the pipeline computes synchronously and the first paint already
includes the projection.

---

## Interaction with `gs.s`

`gs.s` (sliders, owned by spec 001) and `gs.v` (this contract) are
**peer parameters** under `location.hash`. The slider codec preserves
unknown parameters on write, and so does the view-state codec. Edits
to one parameter MUST NOT clobber the other.

A small shared helper in `view-state-url.ts` reads/writes individual
named fragment parameters by delegating to the same parsing approach
already used by `slider-persistence.ts` (`writeUrlHash`-style preserve-
others), but as a separate function (no behavioural coupling).
