# Phase 0 Research: End-to-End Enrichment Coverage Matrix

All Technical Context items are resolved from the existing codebase; there are no
open `NEEDS CLARIFICATION` markers. Decisions below record the design choices and
the alternatives weighed.

## D1 — Demo discovery: filesystem glob vs. hand-listed paths

**Decision**: Discover demo pages by globbing `public/demo/**/*.html` at
test-collection time (Node `fs`), filtering to pages that set `window.gridSight`
(a cheap substring check of the file contents), and excluding non-page fixtures
by convention (e.g. `*fixture*.html`, files with no `<table>`).

**Rationale**: FR-007/FR-008 require the matrix to extend itself when a demo is
added. The existing suite hand-lists paths (`demo.spec.ts`,
`capability-filtering.spec.ts` Pattern 1/2), which is exactly the rot that
produced issue #50. A glob removes the duplicated list.

**Alternatives considered**:

- *Hand-listed case array* (current pattern): rejected — does not self-extend;
  the maintenance burden is the root cause being fixed.
- *Read a manifest file*: rejected — adds a second source of truth to keep in
  sync; the filesystem already is the truth.

## D2 — Offered enrichment set per demo: runtime `pageConfig` vs. static parse

**Decision**: After navigating, read the offered set in-page:
`window.gridSight.pageConfig.enrichments` when non-empty, else the full
`window.gridSight.enrichmentIds` (empty array = "all opt-in", per
`opt-in-playground.html`). Confirmed preserved at runtime: `src/index.ts:667`
merges the author's `pageConfig` back onto the exported `GridSight` object.

**Rationale**: Single source of truth that matches what the library actually
applied. Avoids re-implementing the empty-means-all merge rule in the test.

**Alternatives considered**:

- *Static-parse the `<script>` block*: rejected — duplicates the merge semantics
  and misses the empty-means-all case.

## D3 — Applicability oracle: authored ground truth vs. derived from the library

**Decision**: Two tiers.

- **General demos**: assert the *weak* oracle — enabling each offered enrichment
  must not throw, must render its affordance/lozenge where the library reports it
  applies (`data-gs-lozenge-id="<id>"` presence), and must tear down
  byte-identically. This is fully derived and self-extending.
- **Curated matrix fixture** (`public/demo/matrix/index.html`): assert the
  *strong* oracle against **authored** column-type ground truth (which columns
  are numeric, categorical, or identifier-text such as `S-001`, and which cells
  are annotated). The fixture's expectation table lives next to the spec.

**Rationale**: The #48 defect was the library mis-classifying a column's type. A
test whose expectation is derived from that same typing would inherit the bug and
never fail (circular oracle). SC-002 demands the regression be caught, so the
identifier/annotated expectations must be authored independently. Keeping the
authored oracle to one curated fixture bounds the maintenance cost.

**Alternatives considered**:

- *Derive all expectations from `appliesTo`/column typing*: rejected — circular;
  cannot catch a typing regression.
- *Author expectations for every demo*: rejected — high upkeep and redundant; the
  weak oracle + one curated fixture covers SC-001/SC-002 at far lower cost.

## D4 — Inapplicable-state oracle (enabled-but-inapplicable)

**Decision**: For numeric-only enrichments enabled on text/categorical columns,
assert the library's defined disabled affordance (e.g. the disabled corner
lozenge `gs-lozenge--disabled` introduced in spec 014) is present and that no
*active* result was produced (no summed identifier footer, no spurious numeric
slider). The set of "numeric-only" enrichments is declared once in the harness
(`applicability.ts`) as test metadata, since the registry exposes no global
numeric/categorical flag (each enrichment decides in its `appliesTo(ctx)`).

**Rationale**: Directly encodes the issue's "enabled-but-inapplicable" requirement
and the `S-001`/spurious-slider regression as explicit negative assertions.

**Alternatives considered**:

- *Infer numeric-only from the registry*: rejected — no such metadata exists; the
  predicate is per-enrichment and column-contextual. A small declared list is
  clearer and is itself guarded by FR-009 (a registered enrichment with no
  classification fails the meta-check).

## D5 — Byte-identical teardown verification

**Decision**: `teardown-snapshot.ts` captures a table's `outerHTML` (after the
library's initial enrichment-free render, before enabling) and compares it to the
`outerHTML` after enabling → disabling (and, separately, after a toggle-off→on
round-trip for stateful enrichments). Compare after a `requestAnimationFrame`
flush. This follows the spec-013/014 invariant already asserted piecemeal in
`navigation-and-analysis.spec.ts` (lozenge `toHaveCount(0)`, `.not.toHaveClass`),
but generalizes it to a full structural equality.

**Rationale**: A single reusable assertion catches incomplete teardown across all
enrichments rather than re-deriving per-enrichment class/attribute checks.

**Alternatives considered**:

- *Per-enrichment class/count checks only* (current style): kept as a fallback for
  enrichments whose "resting" DOM legitimately differs (e.g. injected toggle
  panel), but the default is full `outerHTML` equality on the data table(s).

## D6 — Combination strategy: pairwise vs. power set

**Decision**: On the opt-in playground, generate **pairwise** combinations of the
offered enrichments plus one or two hand-picked "rich" combinations from the issue
(`summary-row` + `sort` + `filter` + sliders + virtual columns + annotations +
`find-in-table`). Assert each member behaves and the joint teardown is
byte-identical.

**Rationale**: SC-006 / the issue's runtime note explicitly reject the full power
set (2^n). Pairwise coverage catches the vast majority of interaction defects at
O(n²) rather than O(2^n), and the curated rich combo exercises the spec-013
cross-enrichment invariant the issue calls out.

**Alternatives considered**:

- *Full power set*: rejected — combinatorial blow-up; violates the runtime budget.
- *Only the one rich combo*: rejected — misses systematic pair interactions and
  would not self-extend as enrichments are added.

## D7 — Preview server lifecycle: one shared server vs. per-spec

**Decision**: A single `preview-server.ts` helper starts one `vite preview` on a
dedicated port (e.g. 3160) in each new spec's `beforeAll` and closes it in
`afterAll`, matching the existing per-file pattern but reused across the two new
specs. The suite remains serial (`workers: 1`, `fullyParallel: false`) per the
Playwright config's documented rationale.

**Rationale**: Page navigation (`goto`) is cheap; the cost is server startup.
Reusing one server per spec keeps the matrix fast without touching the global
config's serial guarantee.

**Alternatives considered**:

- *Refactor to a global `webServer`*: out of scope and risks destabilizing the
  whole suite; the config comments explicitly defer that until the suite is large.

## D8 — Driving the toggle panel

**Decision**: Use the real toggle panel selectors confirmed in
`src/ui/toggle-panel.ts`: root `[data-gs-toggle-panel-root]`, per-enrichment
`input[type=checkbox][value="<id>"]` (and label `[data-gs-enrichment-toggle="<id>"]`).
Helpers `setEnrichment(page, id, on)` call `.check()/.uncheck()` then `raf(page)`.
Demos under test must have `showToggleUi: true` (or the harness enables it via the
matrix fixture); demos that ship without the panel are asserted at the
applied-state level only.

**Rationale**: Exercises the same path a user takes (the issue's requirement:
"enable each enrichment the page offers via the toggle panel").

**Alternatives considered**:

- *Call `processTable`/internal APIs directly*: rejected — bypasses the toggle
  path the issue specifically wants covered.

## D9 — Offline guard

**Decision**: Register a Playwright route/`requestfailed`+`request` listener that
fails the test if any request targets a non-local origin during a case (Principle
VI). Local `vite preview` and `data:`/`blob:` are allowed.

**Rationale**: Cheap, always-on enforcement that the fixtures and library stay
air-gapped — a constitutional hard minimum.
