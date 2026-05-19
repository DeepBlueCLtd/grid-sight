---
name: "speckit-review"
description: "Review a plan thoroughly before task generation. Challenges scope, reviews architecture/design/tests/performance against existing code and the Grid-Sight constitution, with opinionated recommendations."
argument-hint: "Optional reviewer guidance (e.g. \"focus on bundle budget\")"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "adapted from debrief-future/.claude/commands/speckit.review.md"
  source: "https://raw.githubusercontent.com/debrief/debrief-future/refs/heads/main/.claude/commands/speckit.review.md"
user-invocable: true
disable-model-invocation: false
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Purpose

Review the implementation plan before committing to task generation. This is a strategic review gate that challenges scope, examines architectural decisions against existing code and the constitution, and surfaces issues while they're still cheap to fix.

**This command is read-only.** It does not modify any files. It produces a structured review with opinionated recommendations and asks the user for decisions at each stage.

After the review, suggested next steps:

- **Create Tasks** — run `/speckit-tasks` to break the (possibly revised) plan into tasks
- **Revise Plan** — run `/speckit-plan` to revise the plan based on review findings

## Allowed Tools

This review uses only: Read, Grep, Glob, Bash (read-only commands like `git log`, `git diff`, `find`), AskUserQuestion.

## Priority Hierarchy

If running low on context or the user asks to compress: Step 0 > Test coverage diagram > Opinionated recommendations > Everything else. Never skip Step 0 or the test coverage diagram.

## Engineering Preferences (guide your recommendations)

* **Constitution is law** — the principles in `.specify/memory/constitution.md` override all other considerations. Flag violations as CRITICAL.
* **Bundle budget is a hard ceiling** — Principle I caps the IIFE at 10 KB gzipped. Any growth must justify its bytes; a feature targeting ≤ 1 KB should not slip to 5 KB unchallenged.
* **DRY is important** — flag repetition aggressively across both the plan and existing code it touches.
* **Well-tested code is non-negotiable** — Principle II mandates Vitest unit tests and Playwright e2e tests green at merge; new behaviour without tests is a blocker.
* **Engineered enough** — not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity). The Development-Phase Posture lets us move fast, but not recklessly — backwards-compat is waived, bundle and a11y are not.
* **Bias toward explicit over clever** — TypeScript is configured strictly; flag any `any`, `as unknown as`, or non-null `!` that hides a real type problem.
* **Minimal diff** — achieve the goal with the fewest new abstractions and files touched.
* **Offline-first always** — every design decision must work without network and from `file://` (Principle VI). Any fetch, font CDN, or analytics call is a CRITICAL violation.
* **Accessibility by default** — every UI affordance must be keyboard-operable and convey state to AT; colour MUST NOT be the sole channel (Principle III).
* **Progressive enhancement** — the library MUST work as a `<script>` drop-in with no build step AND as ESM (Principle IV). A design that only works for one consumer mode is a violation.

## Execution Steps

### 1. Initialize Review Context

Run `.specify/scripts/bash/check-prerequisites.sh --json` from repo root and parse JSON for FEATURE_DIR and AVAILABLE_DOCS.
For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

Derive absolute paths:

- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- RESEARCH = FEATURE_DIR/research.md (if available)
- DATA_MODEL = FEATURE_DIR/data-model.md (if available)
- CONTRACTS = FEATURE_DIR/contracts/ (if available)

Abort with an error message if plan.md is missing (instruct user to run `/speckit-plan` first).

### 2. Load Artifacts

Read all available design artifacts:

1. **spec.md** — user stories, requirements, success criteria
2. **plan.md** — technical context, architecture, project structure, constitution check
3. **research.md** — design decisions and alternatives (if exists)
4. **data-model.md** — entities, relationships, validation rules (if exists)
5. **contracts/** — public API definitions, DOM contract, URL/localStorage contract (if exists)
6. **quickstart.md** — author-facing onboarding (if exists; cross-check accuracy against contracts)
7. **`.specify/memory/constitution.md`** — Grid-Sight constitution (Principles I–VI + Development-Phase Posture)

### 3. Survey Existing Code

**This step is critical.** The plan does not exist in a vacuum — it integrates with or modifies existing code.

1. **Identify files the plan touches**: Read plan.md's Project Structure section and extract all source file paths, directories, and modules mentioned.

2. **Search for existing implementations**: For each entity, module, or DOM contract proposed in the plan:
   - Glob for files with matching names in the repository
   - Grep for key type names, function names, class names, and `data-gs-*` attributes
   - Note what already exists vs what the plan proposes to create
   - Pay particular attention to the existing `src/core/`, `src/enrichments/`, `src/ui/`, `src/utils/` boundaries — does the plan honour them?

3. **Check the bundle baseline**: If `dist/grid-sight.iife.js` exists, note its current gzipped size so you can sanity-check the plan's projected delta against the 10 KB ceiling.

4. **Check git history** for the feature branch:
   ```
   git log --oneline -20
   git log --oneline main..HEAD  # if not on main
   ```
   If prior commits suggest a previous review cycle (review-driven refactors, reverted changes), note what changed and be more aggressive reviewing those areas.

5. **Record findings** for use in Step 0 and the "What Already Exists" output.

### 4. Step 0 — Scope Challenge

**BEFORE reviewing anything else**, answer these questions:

1. **What existing code already partially or fully solves each sub-problem?** Reference specific files and functions found in Step 3. Can the plan reuse existing patterns (e.g. the slider's URL+localStorage persistence model, the lozenge cluster in `header-utils.ts`, the `data-gs-*` attribute convention) rather than building parallel ones?

2. **What is the minimum set of changes that achieves the stated goal?** Flag any work in the plan that could be deferred without blocking the core objective. Be ruthless about scope creep — particularly UI scaffolding, new public API symbols, and demo content that isn't on the critical path.

3. **Complexity check**: Count the files the plan creates or modifies, and the new types/modules it introduces. If the plan touches more than 8 files or introduces more than 2 new top-level concepts (modules, registries, public API symbols), treat that as a smell and challenge whether the same goal can be achieved with fewer moving parts.

4. **Bundle budget pre-check**: Does the plan project a bundle delta? Is it credible? A feature claiming "≤ 1 KB" while introducing a new UI panel, a new persistence path, and a new public API surface deserves scrutiny.

5. **Constitution compliance pre-check**: Does the plan's Constitution Check section in plan.md correctly identify all six principles plus Development-Phase Posture? Are there violations it missed (e.g. a hidden `fetch()`, a non-keyboard-operable widget, a feature that breaks the IIFE path)?

Then use AskUserQuestion to present your findings and ask the user to choose one of three review modes:

**Option A — SCOPE REDUCTION**: The plan is overbuilt. You will propose a minimal version that achieves the core goal, then review that reduced plan.

**Option B — FULL REVIEW**: Work through interactively, one section at a time (Architecture → Design Quality → Tests → Performance) with at most 4 top issues per section.

**Option C — COMPRESSED REVIEW**: Step 0 + one combined pass covering all 4 sections. For each section, pick the single most important issue. Present as a single numbered list + mandatory test coverage diagram + completion summary. One AskUserQuestion round at the end.

**Critical: If the user does NOT select SCOPE REDUCTION, respect that decision fully.** Your job becomes making the plan they chose succeed, not continuing to lobby for a smaller plan. Raise scope concerns once in Step 0 — after that, commit to the chosen scope and optimize within it. Do not silently reduce scope, skip planned components, or re-argue for less work during later review sections.

### 5. Review Sections (after scope is agreed)

#### 5A. Architecture Review

Evaluate the plan against the codebase and constitution:

* **Constitution alignment**: Check every architectural decision against the relevant principle. Pay special attention to:
  - **Principle I (Lightweight & Minimal Dependencies)**: Any new runtime dependency? Does the projected bundle delta keep the IIFE under 10 KB gzipped?
  - **Principle II (Test Discipline)**: Are Vitest unit, Storybook interaction, and Playwright e2e tests planned for every new code path?
  - **Principle III (Accessibility by Default)**: Are all new UI affordances keyboard-operable? Do they expose state to AT? Is colour ever the sole channel for information?
  - **Principle IV (Progressive Enhancement)**: Does the design work as an IIFE drop-in AND as ESM? Does it degrade gracefully when optional inputs are missing?
  - **Principle V (Cross-Browser Compatibility)**: Any newly-shipped browser API used without a feature-detect / fallback?
  - **Principle VI (Offline-First / Air-Gapped)**: Any fetch, font CDN, analytics, or telemetry call? Anything that would break from `file://`?
  - **Development-Phase Posture**: Backwards-compat is waived pre-production — flag any energy spent on compat shims that the posture explicitly excuses.

* **Component boundaries and coupling**: Review the dependency graph between proposed and existing modules. Grid-Sight's layout is `core/` (detection, processors) → `enrichments/` (registration / orchestration) → `ui/` (DOM + a11y) → `utils/` (pure logic). Flag layering violations (e.g. `utils/` importing from `ui/`) or circular dependencies.

* **Data flow patterns**: Trace data from input (host page DOM, page config, URL fragment, localStorage) to runtime state to output (lozenges, popups, persistence writes). Identify potential bottlenecks and races (e.g. config read after init).

* **Integration with existing code**: For each touchpoint with existing code (found in Step 3), assess whether the integration approach is clean or introduces coupling. Watch for:
  - New code reaching into `src/ui/header-utils.ts` lozenge-spec assembly in more than one place.
  - Duplication of the slider persistence model rather than reuse.
  - Bypassing `data-gs-ignore` honouring.

* **Failure scenarios**: For each new codepath or integration point, describe one realistic production failure scenario (malformed config object, corrupted localStorage value, missing DOM container, host CSS clobbering a panel) and whether the plan accounts for it.

* **Diagrams**: Note whether key flows deserve ASCII diagrams in the plan or in code comments.

**STOP.** You MUST call AskUserQuestion NOW with your findings from this section. Do NOT proceed to the next section until the user responds.

#### 5B. Design Quality Review

Evaluate the proposed design in data-model.md, contracts/, and plan.md:

* **DRY violations**: Check proposed types and interfaces against existing ones. Flag duplication aggressively — especially:
  - Re-declarations of existing types (e.g. another `EnrichmentType` enum next to the one in `src/ui/enrichment-menu.ts`).
  - Parallel implementations of persistence that the slider already solved.
  - Repeated id-normalisation logic that should be one helper.

* **Naming consistency with existing code**: Grid-Sight already has in-code identifiers for shipped enrichments (`heatmap`, `sliders`, `slider`, `threshold-slider`, `frequency`, `frequency-chart`, …). Flag any spec/plan that introduces a parallel vocabulary (e.g. spec says `slider` while code says `sliders`) without reconciling explicitly in research.

* **Error handling patterns**: Are failure modes explicit? Does the design fall back rather than throw at init? Are the console warnings used to surface misuse (rather than silent fall-through) where appropriate?

* **Over/under-engineering**: Is the design proportional to the problem? Flag premature abstractions (unnecessary base classes, overly generic interfaces, "future-proofing" beyond what specs 002–010 actually need) and missing structure (god objects, mixed concerns, DOM logic in `core/`).

* **Type safety**: TypeScript is configured strictly (zero errors required by Principle II / Workflow gates). Flag:
  - Any `any` in proposed type signatures.
  - `as unknown as T` casts that paper over a real shape mismatch.
  - Optional fields that should be required (or vice-versa) given the data flow.

* **Existing code impact**: For files the plan modifies (found in Step 3), review whether the proposed changes conflict with existing patterns, break existing tests, or introduce inconsistencies. Pay attention to the lozenge cluster code in `src/ui/header-utils.ts` — modifications there ripple to every demo.

* **Stale documentation**: If the plan modifies code that has inline comments, README references, or `CLAUDE.md` content, note that these will need updating. Likewise quickstart.md if the contract changes.

**STOP.** You MUST call AskUserQuestion NOW with your findings from this section. Do NOT proceed to the next section until the user responds.

#### 5C. Test Review

Build a diagram (ASCII art) of all new:

- User journeys (from spec.md user stories)
- Data flows (from data-model.md and contracts/)
- Codepaths and branching (from plan.md architecture)

For each item in the diagram, verify:

1. **Unit tests** (Vitest): Are proposed pure functions and parsers covered, including edge cases (empty input, malformed input, unknown ids, case variants, duplicates)?
2. **Component tests** (Storybook interaction tests via `@storybook/addon-vitest`): Are new UI affordances exercised with realistic DOM (focus order, keyboard activation, AT-relevant attributes)?
3. **End-to-end tests** (Playwright): Are full host-page flows covered — load → init → user action → persistence → reload? Are demo pages exercised so the demo-subset acceptance criteria are mechanically verified?
4. **Acceptance criteria**: Can every acceptance scenario from spec.md be mapped to a testable assertion in one of the test layers above?
5. **Existing test impact**: Will the proposed changes break any existing tests? Grep for test files that reference modified modules (e.g. `src/ui/__tests__/`, `src/enrichments/__tests__/`, `tests/e2e/`).
6. **Bundle size assertion**: Is there a test or CI step that measures the IIFE size and fails the PR if it crosses 10 KB gzipped?

Flag any new codepath that has no planned test coverage.

**STOP.** You MUST call AskUserQuestion NOW with your findings from this section. Do NOT proceed to the next section until the user responds.

#### 5D. Performance Review

Evaluate with Grid-Sight's domain constraints in mind:

* **Bundle size**: Does the plan's projected gzipped delta hold up under scrutiny? Are the heaviest contributors (UI panels, large data literals, inlined SVG) accounted for? Is there a credible mitigation plan if the delta blows the budget?
* **Runtime budget**: Constitution caps processing of a 1,000-cell table at 100 ms on a mid-range laptop, and forbids main-thread blocking beyond one animation frame. Does the design hit those numbers under realistic data (large heatmaps, many tables on one page, many lozenges)?
* **Interaction latency**: Slider drag, lozenge toggle, panel checkbox flip — each must complete within one animation frame (≤ 16 ms). Flag any design that walks the entire DOM on each interaction.
* **Memory & DOM growth**: Are large collections held in memory unnecessarily? Are detached DOM nodes (closed popups, removed lozenges) reachable through retained references? Are event listeners cleaned up on tearDown?
* **localStorage / URL footprint**: URL fragments are visible everywhere they're shared. Are they kept short? Is the localStorage payload bounded (no unbounded history)?
* **Startup impact**: Time from `<script>` parse to first lozenge rendered. Does the feature add measurable cost on a page with no qualifying tables? It should not.

**STOP.** You MUST call AskUserQuestion NOW with your findings from this section. Do NOT proceed to the next section until the user responds.

## For Each Issue Found

For every specific issue (bug, smell, design concern, or risk):

1. **Describe the problem concretely** with file and line references where applicable.
2. **Present 2–3 options**, including "do nothing" where reasonable.
3. For each option, state in one line: effort, risk, and maintenance burden.
4. **Lead with your recommendation.** State it as a directive: "Do B. Here's why:" — not "Option B might be worth considering." Be opinionated.
5. **Map the reasoning to a specific engineering preference or constitution principle.** One sentence connecting your recommendation to a principle (e.g. "Principle I — keeps the bundle under the 10 KB ceiling").
6. **AskUserQuestion format**: Start with "We recommend [LETTER]: [one-line reason]" then list all options. Label with issue NUMBER + option LETTER (e.g., "3A", "3B").

## Required Outputs

### "NOT in scope" Section

Every review MUST produce a "NOT in scope" section listing work that was considered and explicitly deferred, with a one-line rationale for each item.

### "What Already Exists" Section

List existing code, modules, and flows (found in Step 3) that already partially solve sub-problems in this plan. State whether the plan reuses them or unnecessarily rebuilds them. Pay particular attention to:

- Slider URL+localStorage persistence (`src/utils/slider-persistence.ts`)
- Lozenge cluster assembly (`src/ui/header-utils.ts`)
- Enrichment menu items list (`src/ui/enrichment-menu.ts`)
- Table registry (`src/index.ts`)
- `data-gs-*` attribute convention

### Deferred Items for BACKLOG

Any deferred work that is genuinely valuable MUST be written up as potential backlog entries (in BACKLOG.md if it exists, otherwise propose creating one). Each entry needs:

* **What**: One-line description of the work
* **Why**: The concrete problem it solves or value it unlocks
* **Context**: Enough detail that someone picking this up in 3 months understands the motivation
* **Depends on / blocked by**: Any prerequisites

Do NOT write vague bullet points. Ask the user which deferred items they want captured before proposing backlog entries.

### Diagrams

The review should use ASCII diagrams for any non-trivial data flow, state machine, or processing pipeline being discussed. Additionally, identify which files in the implementation should get inline ASCII diagram comments — particularly:

- Modules with complex state transitions (e.g. EffectiveEnabledSet precedence resolver)
- Code with multi-step pipelines (e.g. page config → normalised config → effective set → lozenge filter)
- Integration points with non-obvious data flow (e.g. URL fragment → persistence → toggle panel → tearDown)

### Failure Modes

For each new codepath identified in the test review diagram, list one realistic way it could fail in production (malformed config, corrupted localStorage, missing DOM container, race between init and pageConfig assignment, host CSS clobbering layout, etc.) and whether:

1. A test would cover that failure
2. Error handling exists for it
3. The user (page author or end-visitor) would see a clear console warning or a silent failure

If any failure mode has no test AND no error handling AND would be silent (the page just looks broken with no diagnostic), flag it as a **critical gap**.

### Completion Summary

At the end of the review, display this summary:

```
## Review Summary

- Step 0: Scope Challenge (user chose: ___)
- Architecture Review: ___ issues found
- Design Quality Review: ___ issues found
- Test Review: diagram produced, ___ gaps identified
- Performance Review: ___ issues found
- NOT in scope: written
- What already exists: written
- Deferred items: ___ items proposed to user
- Failure modes: ___ critical gaps flagged
- Constitution violations: ___ found

### Unresolved Decisions

[List any AskUserQuestion decisions the user did not respond to or skipped]
These may cause problems during implementation if not addressed.
```

## Formatting Rules

* NUMBER issues (1, 2, 3...) and give LETTERS for options (A, B, C...).
* When using AskUserQuestion, label each option with issue NUMBER and option LETTER.
* Recommended option is always listed first.
* Keep each option to one sentence max.
* After each review section, pause and ask for feedback before moving on.

## Unresolved Decisions

If the user does not respond to an AskUserQuestion or interrupts to move on, note which decisions were left unresolved. At the end of the review, list these as "Unresolved decisions that may bite you later" — never silently default to an option.

## Context

$ARGUMENTS
