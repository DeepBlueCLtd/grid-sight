# Feature Specification: End-to-End Enrichment Coverage Matrix

**Feature Branch**: `claude/pending-tasks-NGcyT`
**Created**: 2026-05-30
**Status**: Draft
**Input**: GitHub issue #50 — "e2e coverage gap: exercise every enrichment on every demo + per-permutation interaction tests"

## Why this feature exists

The current end-to-end suite tests each enrichment mostly on its *own* dedicated
demo and walks a single golden path. It does **not** systematically verify that
**every enrichment a demo page offers actually works on that page's table(s)**,
nor that **enrichments do not break one another** when combined. This blind spot
let real defects reach manual review of PR #48 — for example identifier columns
(`S-001`) being mis-typed as numeric so `summary-row` summed them and a spurious
row slider appeared, and annotated numeric cells silently losing their
sort/filter affordances. Neither was caught because no automated test enabled
*those* enrichments on *those* tables, or in combination.

This feature closes that gap with two coverage layers — a per-demo applicability
matrix and a per-permutation interaction sweep — plus a data-driven harness so
the coverage extends itself as new enrichments and demos are added.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every enrichment is exercised on every demo that offers it (Priority: P1)

As a maintainer, when I run the e2e suite I want each demo page to have every
enrichment it advertises turned on and checked against that page's real
table(s), so that a defect in how an enrichment reads or mutates a particular
demo's data fails a test instead of slipping to manual review.

**Why this priority**: This is the layer that would have caught the #48 defects
directly. It delivers the bulk of the protection on its own and is the minimum
viable slice of the feature.

**Independent Test**: Run the matrix suite alone against the existing demos. For
each demo, the suite enables each offered enrichment via the toggle panel and
asserts correct behaviour (including correct "enabled-but-inapplicable" states).
Introducing a regression like the `S-001` mis-typing causes at least one matrix
case to fail.

**Acceptance Scenarios**:

1. **Given** a demo page that offers a set of enrichments, **When** the suite
   enables each offered enrichment in turn on that page, **Then** each enrichment
   either behaves correctly on the page's table(s) or presents its defined
   inapplicable state — and never produces an incorrect active result.
2. **Given** a numeric-only enrichment (e.g. `summary-row`, `statistics`,
   sliders) enabled on a column of identifier strings such as `S-001`, **When**
   the matrix case runs, **Then** the enrichment does NOT treat the identifiers
   as numbers (no summation, no spurious numeric slider) and the case asserts the
   correct inapplicable / text-typed outcome.
3. **Given** a categorical or text-only table, **When** a numeric-only enrichment
   is enabled, **Then** its affordance appears in the defined disabled/inapplicable
   state (e.g. a disabled corner lozenge) rather than acting or throwing.
4. **Given** an enrichment is enabled and then disabled on a demo, **When** the
   matrix case completes, **Then** the table's DOM is byte-identical to its
   pre-enable state.

---

### User Story 2 - Combined enrichments do not break one another (Priority: P2)

As a maintainer, I want the opt-in playground exercised with enrichments enabled
in combination, so that composition defects (one enrichment corrupting another's
typing, ordering, or teardown) fail a test rather than reaching users.

**Why this priority**: Composition is where the subtle, cross-cutting defects
live (the spec-013 cross-enrichment invariant). It builds on the per-demo layer
and protects the realistic case where a consumer turns several enrichments on at
once.

**Independent Test**: Run the permutation suite alone against
`public/demo/toggle/opt-in-playground.html`. It enables representative
combinations (e.g. `summary-row`, `sort`, `filter`, sliders, virtual columns,
annotations, and `find-in-table`), asserts each still behaves correctly under
the others, and asserts byte-identical teardown when the combination is torn
down.

**Acceptance Scenarios**:

1. **Given** the opt-in playground with a representative combination of
   enrichments enabled, **When** the suite interacts with each one, **Then** each
   enrichment produces its correct individual result while the others remain
   active (e.g. a sort does not break a summary aggregate; a filter recomputes
   the summary over visible rows).
2. **Given** a combination is enabled and then fully disabled, **When** teardown
   completes, **Then** the table DOM is byte-identical to its pre-enrichment
   state (the spec-013 cross-enrichment teardown invariant).
3. **Given** an enrichment is toggled off and on again while others stay enabled,
   **When** it re-applies, **Then** it restores correctly without a page reload
   and without disturbing the other active enrichments.

---

### User Story 3 - Coverage extends itself as enrichments and demos are added (Priority: P3)

As a maintainer, I want the matrix to derive each demo's offered enrichment set
from its existing configuration / the registry rather than from a hand-written
list, so that adding a new enrichment or a new demo automatically extends
coverage and a missed pairing fails loudly instead of going untested.

**Why this priority**: This is a durability/maintainability multiplier on top of
the first two layers. The coverage is valuable without it, but without it the
matrix rots as the project grows — which is the exact failure mode that created
issue #50.

**Independent Test**: Add a new (throwaway) demo or a new offered enrichment to
an existing demo's configuration, run the suite without editing any test file,
and confirm a corresponding matrix case appears and runs (and fails if that new
pairing misbehaves).

**Acceptance Scenarios**:

1. **Given** a demo declares the enrichments it offers in its existing page
   configuration, **When** the matrix suite runs, **Then** it discovers that set
   from the configuration / registry rather than a duplicated hard-coded list.
2. **Given** a new enrichment id is registered and offered on a demo, **When** the
   suite runs with no test-file edits, **Then** a matrix case for that
   demo×enrichment pairing is generated and executed.
3. **Given** a demo offers an enrichment for which no applicability expectation is
   defined, **When** the suite runs, **Then** the gap is surfaced (an explicit
   failure or flagged skip) rather than silently passing.

---

### Edge Cases

- **Identifier-looking strings** (`S-001`, `2024-01`, phone numbers, ZIP codes):
  numeric enrichments must treat them as text, not numbers.
- **Annotated cells**: a cell carrying an annotation marker must still type and
  expose its column's sort/filter affordances correctly.
- **Blank / mixed columns**: numeric enrichments over columns with blanks or
  mixed content compute over the valid values and report the inapplicable or
  partial state as defined.
- **Runtime budget**: a full power-set sweep of all offered enrichments is
  combinatorially large; the permutation layer must use representative /
  pairwise combinations, not every subset, while the suite still completes within
  the project's e2e time budget.
- **Inapplicable but enabled**: an enrichment toggled on for a table it cannot act
  on must present its defined disabled/inapplicable affordance — not act, throw,
  or vanish.
- **Demo with no offered enrichments** (or a fixture page): produces no matrix
  cases rather than an error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The suite MUST, for each demo page, enable (via the toggle panel)
  each enrichment that page offers and assert the enrichment's behaviour on that
  page's table(s).
- **FR-002**: For each demo×enrichment pairing the suite MUST assert one of two
  defined outcomes: a correct *active* result, or the correct
  *enabled-but-inapplicable* state — and MUST fail on an incorrect active result.
- **FR-003**: The suite MUST verify that numeric-only enrichments do not treat
  identifier/text columns (e.g. `S-001`) as numeric, covering the specific
  regression class from issue #50.
- **FR-004**: The suite MUST verify that enabling then disabling an enrichment on
  a demo leaves the table DOM byte-identical to its pre-enable state.
- **FR-005**: The suite MUST exercise the opt-in playground with enrichments
  enabled in representative combinations and assert each still behaves correctly
  alongside the others.
- **FR-006**: The combination tests MUST assert byte-identical teardown when an
  enabled combination is disabled (the spec-013 cross-enrichment invariant),
  including toggle-off-then-on round-trips without a page reload.
- **FR-007**: The matrix MUST derive each demo's offered enrichment set from the
  demo's existing configuration and/or the enrichment registry, not from a
  duplicated hand-maintained list.
- **FR-008**: Adding a new enrichment offered on a demo, or a new demo, MUST
  extend the matrix automatically with no edits to the test files.
- **FR-009**: When a demo offers an enrichment that has no defined applicability
  expectation, the suite MUST surface the gap explicitly (fail or flagged skip)
  rather than silently passing.
- **FR-010**: The combination layer MUST bound its runtime by using representative
  / pairwise coverage rather than the full power set of offered enrichments.
- **FR-011**: The full e2e suite (existing specs plus the new matrix and
  permutation specs) MUST pass on the branch before merge, per the project's test
  discipline.
- **FR-012**: Where the existing demo fixtures lack data that meaningfully
  exercises an offered enrichment, the feature MAY enrich those fixtures (or add
  minimal ones) so each pairing has a non-trivial assertion.

### Key Entities

- **Demo page**: a page under the demos area that loads Grid-Sight, declares the
  enrichments it offers (its configuration), and contains one or more tables.
- **Enrichment**: a registered capability (sort, filter, sliders, statistics,
  summary-row, annotations, virtual columns, freeze-panes, find-in-table, …)
  identified by a stable id and toggled via the panel.
- **Matrix case**: one (demo × enrichment) pairing with a defined expected
  outcome — active behaviour or a specific inapplicable state.
- **Combination case**: a set of enrichments enabled together on the playground
  with expectations for each member's behaviour and for joint teardown.
- **Applicability expectation**: the declared rule mapping a (demo, enrichment)
  pairing to its expected outcome, against which a matrix case asserts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every demo page has every enrichment it offers exercised by at least
  one automated matrix case (100% of offered demo×enrichment pairings covered).
- **SC-002**: Re-introducing either #48 defect (identifier columns mis-typed as
  numeric; annotated numeric cells losing sort/filter affordances) causes at
  least one matrix case to fail.
- **SC-003**: The opt-in playground is covered by at least one representative
  multi-enrichment combination that asserts both correct concurrent behaviour and
  byte-identical teardown.
- **SC-004**: Adding a new offered enrichment to a demo, or a new demo, produces a
  new executed matrix case with zero edits to existing test files.
- **SC-005**: A demo offering an enrichment with no defined expectation cannot
  pass silently — it fails or is explicitly flagged.
- **SC-006**: The complete e2e suite remains green and completes within the
  project's existing e2e runtime budget (no more than a modest, agreed increase
  attributable to representative-rather-than-exhaustive combination coverage).

## Assumptions

- The existing per-enrichment e2e specs remain; this feature adds the matrix and
  permutation layers alongside them rather than replacing them.
- Each demo's offered enrichment set is discoverable from its existing page
  configuration and/or the registry (both already exist in the codebase).
- The opt-in playground at `public/demo/toggle/opt-in-playground.html` is the
  canonical surface for combination testing.
- "Representative / pairwise" combination coverage (not the full power set) is an
  acceptable trade-off, per the issue's runtime note.
- Demo fixtures may be enriched or added where current data does not meaningfully
  exercise an offered enrichment; this stays within the demos/test scope.
- This work was surfaced during the spec-014 (#48) review and is explicitly
  **not** part of spec 014; it is a standalone testing-coverage feature.
- No new runtime dependency and no change to shipped library behaviour is required
  — the deliverable is test coverage (and supporting fixtures/harness).
