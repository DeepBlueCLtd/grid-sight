# Phase 0 — Research: Row Visibility & Order (Sort + Filter)

**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md) · **Date**: 2026-05-19

This document resolves every open design question raised by the spec's
"Requirements" and "Assumptions" sections. There are **zero**
`[NEEDS CLARIFICATION]` markers in the spec (validated in
`checklists/requirements.md`); the entries below are the planning
decisions, their rationale, and the alternatives that were considered and
rejected.

---

## R-1 — Pipeline ordering: filter, then sort, always

**Decision**: The Visible Row Sequence is computed as
`sort(filter(rows))` for every change. There is no user-visible knob to
invert this. Sort operates only on rows where `dimmed = false`; dimmed
rows retain their original `sourceIndex` and are never lifted into the
visible block.

**Rationale**: Matches the natural user mental model from US5
("show me orders over $100, biggest first"). Settles the implicit
question both source specs left open — `002-sort` US1 AS-1..AS-4
silently assumed no filter, `003-filter` US1 AS-1..AS-4 silently
assumed no sort. Without this rule, every downstream consumer
(`005`, `008`, `009`, `010`) would have to invent its own answer.

**Alternatives considered**:

- *Sort-then-filter*: equivalent for predicate-only filters (filter is
  position-independent), but the rendered DOM differs because dimmed
  rows would have to move. Rejected — violates SC-005 (byte-identical
  DOM restore) and the "dim, not hide" assumption.
- *User-selectable order*: adds UI surface, doc burden, and an extra URL
  field, with no concrete use case. Rejected as YAGNI.

---

## R-2 — Dim, not hide

**Decision**: Filter marks rows with `data-gs-dimmed="true"` plus a
class hook (e.g. `gs-row--dimmed`) and a CSS opacity reduction. Rows are
never removed from the DOM, never wrapped, and `display: none` is never
used.

**Rationale**: Carried verbatim from `003-filter`. Preserves row indices
for downstream features that hold references (e.g. cumulative-column),
keeps screen-reader output stable, and supports SC-005 by restoring with
a single attribute + class removal pass. Also makes the FR-VP-004 rule
("sort only un-dimmed rows") trivially expressible.

**Alternatives considered**:

- *`display: none`*: shorter CSS but breaks SC-005 (the row's box is
  gone) and screen-reader announcement (`003` FR-022 forbids it).
  Rejected.
- *`hidden` attribute*: same screen-reader objection. Rejected.
- *Detach + reattach*: would lose original position and require a
  separate placeholder map. Rejected as more complex.

---

## R-3 — Original Order Record: captured once, at first activation of either lozenge

**Decision**: The first time *either* the sort lozenge or any filter
lozenge transitions a table out of "idle", the pipeline snapshots
`Array.from(tbody.rows)` and stores it as the **Original Order Record**
(OOR) on a `WeakMap<HTMLTableElement, HTMLTableRowElement[]>`. Toggling
both projections off restores `tbody` to that order; toggling
Grid-Sight off discards the OOR after the restore.

**Rationale**: Reconciles the two source specs — `002-sort` captured on
first sort, `003-filter` captured on first filter. The combined spec
(FR-VP-005) demands one OOR per table, captured on whichever happens
first, because either projection can be the user's first action.

**Alternatives considered**:

- *Capture at table-process time*: simpler, but mutates the OOR scope
  (every table on the page pays the snapshot cost, even those never
  enriched). Rejected — violates progressive enhancement.
- *Re-snapshot on every change*: would lose the original order as soon
  as the user did anything. Rejected — defeats the purpose.

---

## R-4 — URL persistence: one fragment namespace, one directive object per table, sort+filter under one object

**Decision**: A single URL-fragment parameter, **`gs.v`** (for "view"),
holds a comma-separated list of per-table directive objects, each of the
shape:

```text
<table-id>{sort?}{filters?}
```

Encoded compactly as URL-safe ASCII; the parser is the only public
authority on shape. The full grammar lives in
[contracts/url-fragment-schema.md](./contracts/url-fragment-schema.md).
This is **separate** from `gs.s` (sliders, owned by spec 001) — they
co-exist in the same fragment, both keyed by the per-URL-stem scheme
(origin + pathname) already used by `src/utils/slider-persistence.ts`,
but they do not share a parameter or a codec.

**Rationale**: Satisfies FR-VP-006 (single namespace per page) and
FR-VP-007 (filters applied before sort on load → reproduce a
sort-of-filtered-view identically). Keeping `gs.v` distinct from `gs.s`
means slider persistence and view-state persistence evolve independently
— important because slider state is per-slider while view state is
per-table.

**Alternatives considered**:

- *Reuse `gs.s`*: would tangle two unrelated state shapes in one codec.
  Rejected.
- *Per-table fragment key (`gs.v.<id>=...`)*: blows up the parameter
  count and harms readability. Rejected.
- *Encode filters and sort as separate parameters (`gs.sort=`, `gs.filt=`)*:
  splits the "applied filter then sort" guarantee across two parameters
  with unspecified ordering on parse. Rejected.

**Open at plan time, locked here**: directive serialisation. Numeric
range = `min:max` with empty strings for open bounds; categorical =
`v:a|b|c` (URL-encoded); sort = `s:<col-key>:asc` or `s:<col-key>:desc`;
column key = column header text after `String.prototype.trim()` and a
deterministic slug (`/^[a-z0-9-]+$/`, fall back to `c<columnIndex>` if
empty). Missing target columns or tables are silently dropped per the
spec (US6 acceptance + FR-VP-007 prose).

---

## R-5 — Sort: stable, locale-aware, type-routed

**Decision**:

- Use `Array.prototype.sort` (stable since ES2019 across every evergreen
  engine within the constitution's 2-year floor).
- For numeric columns (typed via the existing `core/type-detection.ts`):
  parse with the existing `cleanNumericCell`; sort by `Number` value;
  `NaN` / blank cells sort to the end in both directions (matches the
  `002` edge case for blanks).
- For categorical / text columns: a single shared `Intl.Collator(undefined, { sensitivity: 'base', numeric: true })`
  drives `.compare()`, giving us "natural" ordering ("file2" before
  "file10") and locale-aware case folding.
- Ties keep their original `sourceIndex` order — that is what
  Array.sort already guarantees, no extra code needed.

**Rationale**: Zero new dependencies, locale-correct, stable, and
"natural sort" handles the mixed alphanumeric tables the demo pages
already showcase. Edge case "non-monotonic mixed types" from `002`
collapses naturally because the column-type detector already picks one
type per column.

**Alternatives considered**:

- *Hand-rolled comparators per column*: more code, more bugs, no win
  over `Intl.Collator`. Rejected.
- *Adding a tiny dep like `natural-orderby`*: violates constitution §I
  (no new runtime deps) for a problem `Intl.Collator` already solves.
  Rejected.

---

## R-6 — Filter predicates: minimal closure, no DSL

**Decision**: A filter predicate is a function
`(row: HTMLTableRowElement) => boolean` (returns `true` if the row
**passes** the filter, i.e. is NOT dimmed). The Active Filter Set is an
array of predicates composed with logical AND. Two built-in predicate
factories:

- `numericRange({ min?, max?, hideEmpty? })` — open bounds allowed;
  empty cells dimmed only if `hideEmpty` is `true` (per `003` US1 +
  per-popup toggle).
- `categoricalInclusion({ allowed: Set<string>, hideEmpty? })` — empty
  string membership controlled by `hideEmpty`; values are read via
  `textContent.trim()`.

Both factories also expose a serialisable `toDirective()` so the URL
codec never inspects predicate internals.

**Rationale**: A closure-based predicate set is the smallest surface
that satisfies FR-VP-001 and US4 (AND composition). Keeping the
predicate as a function means custom filters (none planned for v1, but
called out as an extension point) plug in without changing the pipeline.

**Alternatives considered**:

- *Object-based DSL (`{ op: 'between', min, max }`)*: more verbose for
  no gain — the pipeline never introspects the predicate, only the URL
  codec does, and it reads from `toDirective()`. Rejected.

---

## R-7 — Bundle-size budget

**Decision**: Net IIFE delta budget for the combined feature is **≤ 6.0 KB
gzipped** (relaxed from the original 2.0 KB target on 2026-05-19 after the
implementation landed at 5.30 KB — the two filter popups, the chip
render and its empty-state, and the URL codec all came in larger than
the single-sentence estimates below allowed). The constitution §I 10 KB
total cap is already obsolete on this project (spec 001 alone took the
baseline to 19 KB gz); the per-feature delta budget here is the live
gate. Estimated split (after minification + gzip):

| Module | Estimated gz |
|--------|-------------:|
| `utils/visible-rows.ts` | ~0.35 KB |
| `utils/original-order.ts` | ~0.10 KB |
| `utils/view-state-url.ts` (codec) | ~0.45 KB |
| `enrichments/sort.ts` (comparator + lozenge wiring) | ~0.35 KB |
| `enrichments/filter.ts` (predicate factories + popup orchestration) | ~0.40 KB |
| `enrichments/filter-chip.ts` | ~0.15 KB |
| `ui/sort-lozenge.ts` + `ui/filter-lozenge.ts` | ~0.10 KB |
| `ui/filter-popup-numeric.ts` + `ui/filter-popup-categorical.ts` | ~0.10 KB |
| Total estimate | **~2.00 KB** |

`scripts/bundle-size.js` measures the live delta on every PR. If the
total slips past 2 KB, the first PR that breaches MUST either trim or
file a budget-raise note in `tasks.md`.

**Baseline (T002)**: pre-feature IIFE measures **19.01 KB gzipped** on
commit `7981c12` (the merge that landed `claude/row-visibility-spec-UxTM5`).

**Rationale**: Constitution §I caps the IIFE at 10 KB gzipped. Spec 001
already lives inside that ceiling (current measured ~5.8 KB total); a
2 KB feature delta keeps total comfortably ≤ 8 KB with headroom for
specs 004–010.

---

## R-8 — Synchronous change-event semantics

**Decision**: `visible-rows` exposes a single subscription channel:

```ts
onChange(table: HTMLTableElement, listener: (seq: VisibleRowSequence) => void): () => void
```

The listener is invoked **synchronously** at the end of every
re-evaluation (after the pipeline has updated DOM order and dim flags),
before control returns to the caller that triggered the change. The
returned closure unsubscribes.

**Rationale**: FR-VP-003 demands that downstream enrichments re-render
within one animation frame of the change. Synchronous emission is the
only reliable way to keep them inside the same frame as the
user-initiated event (`click`, `input`, popstate). Microtasks /
`queueMicrotask` would also work in practice but introduce ordering
hazards if the listener mutates a sibling enrichment's state.

**Alternatives considered**:

- *`requestAnimationFrame` batching inside the pipeline*: would
  guarantee one frame of latency. Rejected — listeners that need to
  batch can wrap their handler themselves.
- *CustomEvent on the `tbody`*: leaks contract details into DOM
  attributes (event name, payload shape) that would then need
  versioning. Rejected.

---

## R-9 — Restore-before-paint on first load

**Decision**: `gridSight.init()` reads `location.hash` synchronously
during table processing and applies the persisted filter set + sort
directive *before* `processTable` returns. The lozenge cluster mounts
with the resulting state already reflected (sort indicator, filter chip
present, dimmed rows already dim) so the first paint is the final paint.

**Rationale**: Satisfies SC-003 ("restore the view with no visible
flash beyond one animation frame after first paint"). Since the
pipeline computes synchronously from in-memory state, there is no
async barrier between parse and render.

**Alternatives considered**:

- *Apply via `DOMContentLoaded` listener after first paint*: produces
  a visible flicker on slow devices. Rejected.
- *Pre-render server-side*: not applicable — Grid-Sight is a
  client-side library with no SSR story.

---

## R-10 — Composition with downstream consumers (`005`, `008`, `009`, `010`)

**Decision**: Downstream specs read row order and visibility **only**
via `utils/visible-rows.ts`. Each subscribes via `onChange` and
re-renders on every emission. The Visible Row Sequence shape
(`{ row, dimmed, sourceIndex }[]`) is the locked contract.

**Rationale**: FR-VP-002 makes this the only sanctioned read-channel.
Centralising prevents the situation where every downstream consumer
reads `tbody.rows` directly and rediscovers the sort-over-filter rule.

**Alternatives considered**:

- *Document the rules and let each consumer reimplement*: would have
  made this combined spec unnecessary. Rejected by the spec's own
  framing.

---

## R-11 — Accessibility wiring

**Decision**: Unchanged from the source specs.

- Sort lozenge:
  - `aria-sort` on the column header reflects `"ascending"`,
    `"descending"`, or `"none"`.
  - Accessible name describes the **next** action ("Sort Amount
    descending").
- Filter lozenge:
  - `aria-pressed` reflects whether a filter is active on the column.
  - Popup is a focus-trap (Tab cycles inside; Escape returns focus to
    the lozenge).
- Chip:
  - Reachable via Tab from each filter lozenge; `Clear all filters`
    button restores focus to the table's first focusable lozenge.
- Dimmed rows:
  - No `aria-hidden`; screen readers continue to announce the row.
    Dim is visual only (CSS opacity).

**Rationale**: Constitution §III mandates AT operability; every behaviour
here is already specified verbatim in `002` and `003` and just needs
to survive the combination.

---

## R-12 — Toggle-off → byte-identical DOM

**Decision**: Disabling Grid-Sight (`gridSight.disable()` or removing
the toggle) runs the pipeline's `teardown(table)` which:

1. Restores `tbody` row order to the OOR if any change was applied.
2. Removes `data-gs-dimmed` and `gs-row--dimmed` from every row.
3. Removes `aria-sort` from every header cell touched.
4. Removes sort/filter lozenges via `header-utils.removePlusIcons`.
5. Deletes the OOR entry on the per-table WeakMap.

URL state is **not** rewritten on teardown — toggling Grid-Sight back
on re-applies the saved view (matches the "URL state remains so
toggling back on re-applies both" edge case from `002`/`003`).

**Rationale**: SC-005 demands byte-identical DOM. The teardown is the
sole code path that achieves it; covered by a Vitest snapshot test
(`tbody.innerHTML` before init vs after disable).

---

## Closed questions

- "Should sort and filter share a URL fragment key?" → **Yes**, R-4.
- "What happens to dimmed rows when a sort is applied?" → **Stay put**,
  R-1 + FR-VP-004.
- "When is the Original Order Record captured?" → **First activation of
  either projection**, R-3 + FR-VP-005.
- "Is the change event sync or async?" → **Sync**, R-8.
- "Do we need any new runtime dep?" → **No**, R-5, R-6.

## Out of scope for v1 (carried from spec Assumptions)

- Multi-column sort.
- Per-column custom comparators.
- OR composition across different filters (per-column categorical OR
  inside one popup is the only OR semantics in v1).
- A user-exposed knob to invert filter/sort ordering.
- Server-side rendering.
