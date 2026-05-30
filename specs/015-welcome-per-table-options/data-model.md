# Phase 1 — Data Model

Feature: Welcome Page Redesign & Per-Table Options
Date: 2026-05-30

The feature adds **config-time** entities (parsed from author input) and
**derived runtime** entities (computed per table). Nothing is persisted (no new
`gs:` key, no URL fragment). All types live in `src/core/`.

---

## Entity: `RawTableOptionEntry` (author input, pre-validation)

What the host page writes inside `pageConfig.tables` (or `init({ tables })`).
Shape is *advisory* — `parsePageConfig` validates/normalises it.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `selector` | string | **yes** | CSS selector (an `#id` is the common case). Matched against `<table>` elements at `init()`. |
| `enrichments` | string[] | no | Ids this table offers. Absent → the table falls through to the page-level set for enrichments. Present (incl. `[]`) → replaces the offered set for matched tables. |
| `startActive` | boolean | no | Whether the matched table's GS toggle begins active (enrichments revealed). Absent → `false` (default off). |

**Validation (R-9, in `parsePageConfig`)**:
- `tables` not an array → warn once, ignore the field.
- entry not an object, or `selector` not a non-empty string → drop entry, warn once.
- `enrichments` not an array → ignore that field (entry kept); non-string members dropped with one warning; members trimmed + lowercased + deduped.
- `startActive` not boolean → `Boolean()`-coerce with one warning.

---

## Entity: `ParsedTableOptionEntry` (normalised)

Produced by `parsePageConfig`; stored on the parsed config.

| Field | Type | Notes |
|-------|------|-------|
| `selector` | string | non-empty, as authored (selectors are case-sensitive for attribute values; not lowercased). |
| `enrichments` | `Set<string>` \| `undefined` | normalised ids, or `undefined` when the field was absent (distinct from an empty set = "offer none"). |
| `startActive` | boolean | defaulted to `false`. |

### Extension to `ParsedPageConfig`

```text
ParsedPageConfig {
  enrichments: Set<string> | undefined   // existing (page-level)
  showToggleUi: boolean                   // existing
  tables: ParsedTableOptionEntry[]        // NEW — [] when absent
}
```

---

## Entity: `ResolvedTableConfig` (derived, per table, cached)

Computed once per table at `init()` (and on global re-enable), cached in a
`WeakMap<HTMLTableElement, ResolvedTableConfig>` in `enabled-set-state.ts` /
`per-table-options.ts`.

| Field | Type | Notes |
|-------|------|-------|
| `enrichments` | `Set<string>` | the effective enabled set for *this* table, after precedence resolution (visitor > per-table > page > defaults), unknown ids dropped. |
| `startActive` | boolean | the effective GS-toggle start-state for this table. |
| `matched` | boolean | whether any per-table entry matched (drives "fall back to global" vs "use per-table"). |

**Derivation (per table)**:
1. If `data-gs-ignore` → table is excluded before this runs (no entry).
2. Match: collect entries whose `selector` matches the table (`Element.matches`),
   in declaration order.
3. Fold with **last-match-wins per field** (R-7): later `enrichments`/`startActive`
   override earlier; absent fields leave prior value.
4. `enrichments` set:
   - visitor override present → `intersect(visitorOverride, knownIds)` (visitor wins, R-3);
   - else folded per-table `enrichments` present → `intersect(that, knownIds)`;
   - else page-level branch (existing `resolveEnabledSet` page/defaults logic).
5. `startActive`: folded value, default `false`.

---

## Derived behaviour: table-aware gate

`enabled-set-state.ts` surface (backward-compatible overloads):

```text
getEffectiveEnabledSet(table?: HTMLTableElement): ReadonlySet<string>
isEnrichmentEnabled(id: string, table?: HTMLTableElement): boolean
```

- No `table`, or a table with `matched === false` → returns the page-global set
  (today's behaviour; SC-009 / FR-018).
- A matched table → returns its `ResolvedTableConfig.enrichments`.

---

## Welcome-page content entities (documentation-only, not code types)

Captured for the `public/index.html` rewrite; see `contracts/welcome-page.md`.

| Entity | Key parts |
|--------|-----------|
| **Intro/hero** | What GS is; problem it solves; principles (offline, no deps, progressive, accessible, byte-identical teardown). |
| **Feature section** (×4) | Heading + narrative; ≥1 live demo table addressed by id in `pageConfig.tables`; links to that area's existing demo page(s); alternates side. |
| **Global toggle region** | The retained enable/disable control + narrative explaining the non-destructive overlay. |
| **Start-state demo** | One table `startActive: true` shown beside one `startActive: false`. |
| **All-demos index** | Links to all 12 existing demo pages (zero orphaned). |

---

## Invariants

- **INV-1 (no-regression)**: For any table with no matching entry, the resolved
  enrichment set equals `resolveEnabledSet` with no per-table tier — byte-for-byte
  today's behaviour.
- **INV-2 (unknown-id drop)**: No `ResolvedTableConfig.enrichments` ever contains
  an id absent from the registry, at any tier.
- **INV-3 (default off)**: `startActive` defaults to `false`; a table without a
  matching entry keeps today's inactive-on-load GS toggle.
- **INV-4 (teardown identity)**: A `startActive: true` table, when its toggle is
  deactivated (manually or via global disable), restores byte-identical original
  markup — because the programmatic activate and the manual click share one path.
- **INV-5 (opt-out absolute)**: `data-gs-ignore` tables receive no per-table
  config and no GS UI.
- **INV-6 (no persistence)**: Per-table options and start-state add no persisted
  state; only author-declared config and transient in-DOM toggle state exist.
