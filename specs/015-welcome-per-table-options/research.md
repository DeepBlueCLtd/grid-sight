# Phase 0 — Research & Design Decisions

Feature: Welcome Page Redesign & Per-Table Options
Date: 2026-05-30

This resolves the open decisions from the spec's Assumptions and the technical
unknowns from `plan.md`. Each entry: **Decision / Rationale / Alternatives**.

---

## R-1: Where per-table options are declared

**Decision**: Extend the existing config object with a `tables` array:
`window.gridSight.pageConfig.tables = [{ selector, enrichments?, startActive? }]`
(and symmetrically on `gridSight.init({ tables: [...] })`). Parsed and normalised
by `parsePageConfig` alongside the existing `enrichments` / `showToggleUi`.

**Rationale**: Keeps one config entry point and one validation policy
(`core/page-config.ts`). No change to the frozen `window.gridSight.init`
*signature* — `tables` rides on the same `pageConfig`/options object the page
already supplies. Matches how spec 012 added page-level config.

**Alternatives considered**:
- Per-table HTML attributes (e.g. `data-gs-enrichments="heatmap sort"`). Rejected
  as the *primary* mechanism: the user explicitly asked for **id or CSS
  selector** addressing from one declaration; attributes can't express
  selector-based grouping and scatter config across the markup. (An attribute
  form could be added later; not in scope.)
- A separate `window.gridSight.tableConfig` map. Rejected: a second config
  surface and a second validation path; `pageConfig.tables` reuses the existing
  one.

---

## R-2: Matcher form — `id` or CSS selector

**Decision**: `selector` is a CSS selector string, matched with
`document.querySelectorAll(selector)` at `init()`, filtered to `<table>`
elements. An `#id` is therefore just the common case of a selector. Matching is
evaluated against the live document once per `init()`.

**Rationale**: One mechanism covers both the "by id" and "by CSS selector" asks
(an id is `#foo`). Native `querySelectorAll` is > 2 years everywhere, needs no
dependency, and is the least surprising contract for authors.

**Alternatives considered**: A union type (`{ id }` | `{ selector }`). Rejected
as redundant — `selector: '#foo'` already expresses id matching with one field.

---

## R-3: Resolution precedence and the per-table tier

**Decision**: Resolution order is **visitor override > per-table > page-level >
library defaults** (FR-016). Implement by adding a `perTableEnrichments?:
Set<string>` tier to `resolveEnabledSet`: if a visitor override exists it still
wins (unchanged); else if the table has a per-table enrichment set, intersect
*that* with known ids; else fall back to the existing page/defaults branches.
Unknown ids are dropped at every tier (FR-017), reusing the existing `intersect`
against `knownIds`.

**Rationale**: Extends the single existing resolver rather than forking it; the
"unknown ids dropped at every tier" invariant is preserved by construction.
Visitor-still-wins keeps the spec-012 visitor-override contract intact.

**Alternatives considered**: Merging per-table *into* page-level (union).
Rejected — the spec wants per-table to **replace** the offered set for that
table (so a demo can show *only* its feature), not add to the page set.

---

## R-4: Making the gate table-aware

**Decision**: Give `getEffectiveEnabledSet(table?)` and
`isEnrichmentEnabled(id, table?)` an **optional** table argument
(`enabled-set-state.ts`). When a table is passed *and* it matches a per-table
entry, return that table's resolved set (computed once, cached in a `WeakMap<
HTMLTableElement, Set<string>>`); otherwise return the page-global set exactly as
today. `header-utils.addLozengesToHeader` already has `table` in scope and passes
it; the auto-render gates in `index.ts` (`outlier`, `freeze-panes`,
`summary-row`) pass their `table`.

**Rationale**: Backward compatible by construction — every existing call without
a table, and every table with no per-table entry, yields the current behaviour
(SC-009, FR-018). The `WeakMap` cache makes per-header reads O(1) and avoids
re-matching selectors during re-injection (toggle round-trips).

**Alternatives considered**:
- A second parallel "per-table" function set. Rejected: two code paths to keep in
  sync; the optional-arg overload keeps one.
- Recomputing the resolved set on every header. Rejected: O(headers × entries)
  selector work; the cache makes it O(entries × tables) once at `init()`.

---

## R-5: Start-state = the GS toggle's initial position (not GS attachment)

**Decision**: `startActive` controls whether a table's "GS" corner toggle begins
in its **active** state (enrichments revealed) vs **inactive** (default). It does
**not** attach/detach Grid-Sight — the GS button is injected either way, exactly
as today. Default is `false` (inactive). Implement by **extracting** the
activate/deactivate body from the inline click handler in `toggle-injector.ts`
into `activateToggle(table)` / `deactivateToggle(table)`, having the click
handler call them, and calling `activateToggle(table)` once after
`injectToggle(table)` in `index.ts` when the table's resolved start-state is
active.

**Rationale**: This is precisely the user's clarification ("the GS toggle button
itself — whether the enrichments are shown for that table"). Extracting (not
duplicating) the activate path guarantees the programmatic start and a manual
click run **identical** code, so teardown stays byte-identical (FR-024) and there
is no second behaviour to test against.

**Alternatives considered**:
- Simulating a `click()` on the toggle. Rejected: relies on event plumbing and
  `stopPropagation`, harder to assert in jsdom, and couples start-state to event
  dispatch. A named function is explicit and unit-testable.
- A CSS-only "pre-expanded" class. Rejected: the active state also *injects*
  plus-icons/lozenges and wires the `gridsight:enrichmentSelected` listener —
  not a pure style toggle.

---

## R-6: Interaction between the global control and per-table start-state
*(resolves spec Assumption "Global control and start-state interaction")*

**Decision**: The global enable/disable control governs whether Grid-Sight is
**attached** at all. On (re-)enable, each table is re-processed and its GS toggle
is set to its **configured start-state** (active/inactive). After that, the
visitor's own clicks on a table's GS toggle govern its state until the next
global disable→enable cycle. Global disable removes all GS UI and restores
byte-identical markup (FR-010, FR-024).

**Rationale**: Deterministic and matches the demonstrated narrative: re-enabling
returns the page to its authored initial presentation rather than trying to
remember each table's last manual state (which would need new persistence —
out of scope, see Storage = none). Simple mental model for the visitor.

**Alternatives considered**: Persisting each table's last toggle state across a
global off→on. Rejected: introduces new persisted state for no requirement and
muddies the "re-enable returns to authored start" demo.

---

## R-7: Multiple per-table entries matching the same table
*(resolves spec Assumption "Deterministic multi-match resolution")*

**Decision**: **Last-match-wins per field.** Entries are applied in declaration
order; for a table matched by several entries, a later entry's `enrichments`
and/or `startActive` overrides an earlier one's for that field (a field absent in
the later entry leaves the earlier value standing). Documented in the contract.

**Rationale**: Mirrors familiar cascade semantics (later rules win), is trivial
to implement deterministically, and lets an author write a broad selector then a
narrow override. Per-field (not whole-entry) override avoids an unspecified
partial entry wiping a previously-set field.

**Alternatives considered**: First-match-wins; most-specific-selector-wins.
Rejected: first-match prevents targeted overrides; specificity scoring is complex
and surprising for a config array.

---

## R-8: `data-gs-ignore` vs a matching per-table selector
*(confirms spec Assumption "Explicit opt-out wins")*

**Decision**: `data-gs-ignore` is checked **before** per-table matching in the
`init()` table loop (it already is). An ignored table is skipped entirely; a
per-table selector that also matches it has no effect.

**Rationale**: Keeps the absolute opt-out absolute (FR-019); no new branch — the
existing early `return` in the `init()` loop already wins.

---

## R-9: Malformed `pageConfig.tables` policy

**Decision**: Extend the existing parse policy: non-array `tables` → warn + ignore
the field; entries that are non-objects or lack a string `selector` → drop with
one warning; `enrichments` normalised exactly like the page-level list
(trim/lowercase/dedup, drop non-strings); `startActive` coerced via `Boolean()`
with a warn if non-boolean. Each distinct warning at most once per call. Never
throw into the host page (constitution §IV).

**Rationale**: Consistent with the spec-012 validation policy already in
`parsePageConfig`; progressive-enhancement safe.

**Alternatives considered**: Throwing on malformed config. Rejected — violates
"degrade gracefully, never throw into the host page".

---

## R-10: Welcome-page layout technique

**Decision**: Plain semantic HTML + CSS grid. Each feature section is a two-column
grid (`grid-template-columns: 1fr 1fr`) with the narrative and table in **DOM
order narrative-then-table**, and alternation achieved with CSS only (`order` /
`:nth-of-type(even)` reversing the columns) so reading/tab order stays logical.
A `@media (max-width: …)` collapses to one column. No scrollytelling JS (the user
chose "alternating two-column rows", not the sticky option).

**Rationale**: Keeps DOM order accessible regardless of visual side (constitution
§III), needs no JS for layout, and works offline. CSS grid is > 2 years
everywhere.

**Alternatives considered**: Float/flex hacks (more fragile); sticky
scrollytelling (explicitly not chosen; more JS).

---

## R-11: Driving the inline demos with the per-table API

**Decision**: The welcome page sets `window.gridSight.pageConfig.tables` so each
inline demo table (addressed by `id`) offers exactly its section's enrichment(s)
and starts active; one table is deliberately left `startActive: false` (or
unspecified) to demonstrate the default. A reference "before" table keeps
`data-gs-ignore`. The page still registers the slider formula on its slider demo
(as today) once the IIFE loads.

**Rationale**: Makes the welcome page the first real consumer of the capability —
dogfooding the contract — and gives the start-state demo (Story 3) for free.

**Alternatives considered**: Hand-wiring each table with bespoke script.
Rejected: the whole point is to exercise the declarative per-table API.

---

## R-12: Scope guard — no new enrichments, no API-signature change

**Decision**: This feature adds a *new way to scope existing enrichments per
table* plus a page rewrite. It introduces no new enrichment id and does not
change the `window.gridSight.init` signature (`tables` rides on the existing
config object). Existing enrichment modules are reviewed only to confirm their
`isEnrichmentEnabled` calls remain correct (page-global where they are
page-global; table-scoped where a table is in hand).

**Rationale**: Bounds the change, protects the frozen public surface, and keeps
the bundle delta small (≤ 1.5 KB gz target).
