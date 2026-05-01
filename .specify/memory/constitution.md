<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — added "Development-Phase Posture" section explicitly waiving
backwards-compatibility (specs, schemas, test data, source, public API) until the
production cut. No principles removed or redefined.

Prior amendment (2026-05-01, v1.0.0): Initial ratification — first concrete principles
replaced placeholder template. Refined via interview the same day.

Modified principles (template → ratified at 1.0.0; unchanged at 1.1.0):
  - I. Lightweight & Minimal Dependencies
  - II. Test Discipline
  - III. Accessibility by Default (best-effort)
  - IV. Progressive Enhancement
  - V. Cross-Browser Compatibility (evergreen)
  - VI. Offline-First / Air-Gapped Compatibility

Added sections (this amendment, 1.1.0):
  - Development-Phase Posture — declares pre-production status; waives backwards-compat
    for specs, schemas, test data, source, and public API until the production cut.
  - Caveats added to Performance & Distribution Constraints and Governance to defer the
    SemVer freeze and MAJOR-bump rule until production.

Added sections (1.0.0):
  - Performance & Distribution Constraints (was [SECTION_2_NAME])
  - Development Workflow & Quality Gates (was [SECTION_3_NAME])

Removed sections: None.

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check is generic; no edits needed.
  - ✅ .specify/templates/spec-template.md — no constitution-specific fields; no edits needed.
  - ✅ .specify/templates/tasks-template.md — sample tasks are illustrative; no edits needed.
  - ✅ .specify/templates/checklist-template.md — generic; no edits needed.
  - ⚠ README.md — claims "Zero dependencies" while package.json lists shepherd.js +
    simple-statistics. Reconcile claim with reality. Flagged for follow-up.

Follow-up TODOs:
  - Define and record the production-cut trigger (release tag? milestone? customer
    deployment?) when known. Until then, the posture in §"Development-Phase Posture"
    remains active.
-->

# Grid-Sight Constitution

## Core Principles

### I. Lightweight & Minimal Dependencies

Grid-Sight MUST remain a small, drop-in browser library. The published IIFE bundle MUST stay
within a tracked size budget of **≤ 10 KB gzipped** for the core build. Each runtime
dependency MUST justify its bundle cost in the PR that introduces it; transitive
dependencies count toward the budget. Build-time devDependencies are unconstrained.

**Rationale**: Grid-Sight is intended to be embedded in third-party pages where bundle size
directly affects load time and adoption. A loose-but-real ceiling lets the library grow
without losing its lightweight character.

### II. Test Discipline

Every new feature MUST land with automated tests that exercise its behaviour. Every bug fix
MUST land with a regression test that fails before the fix and passes after. Tests MUST NOT
be silently skipped or `.skip`-ed to ship a change; if a test is genuinely obsolete it MUST
be deleted with rationale in the commit message. The full Vitest unit suite and Playwright
e2e suite MUST be green on the branch before merge to `main`.

**Rationale**: This library runs inside other people's pages — a regression here is a
regression in every consumer simultaneously. Strict test-first / TDD ordering is not
mandated, but the safety net at merge time is.

### III. Accessibility by Default

Every user-visible feature MUST be operable by keyboard alone and convey state to assistive
technology (screen readers). Interactive controls MUST expose appropriate ARIA roles, names,
and states. Colour MUST NOT be the sole channel for conveying information (e.g. heatmaps
must remain intelligible to users with colour-vision deficiencies). Grid-Sight does NOT
claim conformance to a specific WCAG level; the bar is best-effort with the rules above as
hard minimums.

**Rationale**: Tables are a primary interface for data-heavy work, including in
accessibility-sensitive contexts. The hard minimums catch the most common failures without
forcing the project into a formal conformance audit it would not pass on every release.

### IV. Progressive Enhancement

Grid-Sight MUST work as a single `<script>` include with no build step (IIFE distribution),
AND as an npm/ESM package for build-system consumers. Loading the script MUST NOT break a
page if no valid tables are present. Features MUST degrade gracefully when optional inputs
(e.g. numeric data, headers) are missing rather than throwing into the host page.

**Rationale**: The library's reach depends on it being trivially adoptable in legacy pages
while still feeling native to modern toolchains. Both consumption modes are first-class.

### V. Cross-Browser Compatibility

Grid-Sight MUST function correctly on any evergreen browser released within the **last two
years** (Chrome, Firefox, Safari, Edge, and Chromium derivatives). Browser-specific APIs
MUST either be feature-detected with a graceful fallback or polyfilled at the call site;
they MUST NOT be required at script load. Newly-shipped APIs (i.e. available for less than
two years across the major engines) MUST be guarded.

**Rationale**: The library runs on an unknown population of pages and browsers, but
"evergreen ≤ 2 years" is a realistic floor that includes ESR / corporate-managed channels
without forcing legacy-IE polyfill burden.

### VI. Offline-First / Air-Gapped Compatibility

Grid-Sight MUST run correctly with no network access at runtime. The library MUST NOT
fetch fonts, icons, scripts, telemetry, analytics, error reporters, or any other resource
from the public internet during execution. All assets the library needs MUST be embedded
in the published artifact or supplied by the host page. CDN distribution (e.g. jsDelivr) is
permitted as a developer-side download channel only; the running library MUST behave
identically when served from a local file, internal mirror, or air-gapped network.

**Rationale**: Grid-Sight targets defence and similar environments where the host network
is air-gapped and any outbound request will fail (or worse, raise a security incident). An
internet dependency anywhere on the runtime path makes the library unusable for that
audience.

## Development-Phase Posture

Grid-Sight is currently in a **pre-production development phase**. While this posture is
active, the project is the sole owner of every artifact it produces and consumes — there
are no external consumers whose installations, scripts, or pipelines we are obliged to
preserve. Accordingly:

- **No backwards-compatibility guarantee** applies to specs, data schemas, test fixtures,
  generated DOM/CSS, source-code module layout, or any item in the "Public API surface"
  list below. Any of these MAY change without notice and without a deprecation window.
- **Migrations** for in-tree test data, fixtures, and example HTML are written only as far
  as needed to keep the suite green; legacy shapes are deleted, not preserved.
- **SemVer discipline** still governs the constitution itself (see Governance) and tracked
  releases of the npm package, but a 0.x version line is appropriate while this posture is
  in effect.
- **Trigger for production posture**: the project enters production when a deliberate
  decision is recorded (e.g. a 1.0.0 npm release, a signed-off customer deployment, or an
  amendment to this section naming the date). Until that record exists, this posture
  applies. From the production cut forward, the freezes in "Performance & Distribution
  Constraints" and "Governance" become binding and breaking changes require a MAJOR bump
  with a migration note.

**Rationale**: Premature compatibility commitments are the most expensive form of waste
in early-stage software — they ossify decisions that are still wrong. Stating the waiver
explicitly prevents reviewers and contributors from defending obsolete shapes "just in
case", and forces a conscious moment when we choose to commit.

## Performance & Distribution Constraints

- **Bundle size**: The IIFE build (`dist/grid-sight.iife.js`) MUST be measured on every PR.
  Increases that push the artifact above 10 KB gzipped MUST be rejected or accompanied by an
  explicit budget-raise amendment to this constitution.
- **Runtime budget**: Processing a single table of up to 1,000 cells MUST complete within
  100 ms on a mid-range laptop. Larger tables MUST NOT block the main thread for more than
  one animation frame at a time.
- **Distribution channels**: Releases MUST be published to npm (`@deepbluec/grid-sight`).
  CDN availability (jsDelivr) is offered as a convenience for development environments with
  internet access; it is NOT required for runtime correctness (see Principle VI).
- **Public API surface**: `window.gridSight.init` is designated as the **frozen public
  contract** *from the production cut onward* — once production posture is declared, breaking
  changes to its signature or documented behaviour require a MAJOR version bump and a
  migration note in the changelog. `window.gridSight.processTable` and
  `window.gridSight.isValidTable` are documented and stable in practice but are NOT under
  the SemVer freeze; they MAY change in a MINOR release with notice. While the
  Development-Phase Posture is active, all three MAY change freely (see that section).

## Development Workflow & Quality Gates

- **Branching**: Feature work happens on branches named `<issue-number>-<slug>` and lands
  via PR to `main`. Direct commits to `main` are reserved for release tags and emergency
  hotfixes.
- **Required checks before merge**:
  1. `yarn test` (Vitest unit + Storybook tests) — green.
  2. `yarn test:e2e` (Playwright) — green.
  3. `yarn build` — green; bundle size measured against the 10 KB ceiling.
  4. TypeScript compilation — zero errors (`tsc` runs as part of `yarn build`).
- **Reviews**: Every PR MUST be reviewed by at least one human maintainer. Reviewers MUST
  verify that any new behaviour is covered by tests (Principle II), that accessibility was
  considered for any UI change (Principle III), and that no internet-fetching code path was
  introduced (Principle VI).
- **Spec Kit usage**: Non-trivial features SHOULD be specified via `/speckit-specify` and
  planned via `/speckit-plan` before implementation. The Constitution Check in the plan
  template MUST be completed against the principles above.

## Governance

This constitution supersedes ad-hoc practice. Where another document conflicts with the
principles or constraints here, this document wins until amended.

- **Amendment procedure**: Amendments are proposed by PR that edits this file together
  with any dependent templates. The PR description MUST state the version bump (MAJOR /
  MINOR / PATCH) and rationale, and update the Sync Impact Report at the top of this file.
- **Versioning policy** (governs this constitution document):
  - **MAJOR**: Backward-incompatible removal or redefinition of a principle or governance
    rule. After the production cut, also: any breaking change to `window.gridSight.init`.
  - **MINOR**: New principle or section added, or material expansion of an existing rule.
  - **PATCH**: Clarifications, wording fixes, typos, or non-semantic refinements.
- **Package versioning**: While the Development-Phase Posture is active, the npm package
  MAY remain on a `0.x` line and breaking changes do NOT require a MAJOR bump there. From
  the production cut forward, the package follows full SemVer and breaking changes to the
  frozen API surface require a MAJOR bump with a migration note.
- **Compliance review**: Reviewers MUST treat the principles above as merge gates. PRs that
  introduce a runtime dependency, change `window.gridSight.init`, add UI, alter the build
  output, or add any network call MUST explicitly note compliance (or justified deviation)
  in the description.
- **Runtime guidance**: Day-to-day development guidance lives in `CLAUDE.md` (for AI
  assistants) and `README.md` (for human contributors). Both MUST stay consistent with this
  constitution.

**Version**: 1.1.0 | **Ratified**: 2026-05-01 | **Last Amended**: 2026-05-01
