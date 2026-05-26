---
description: "Task list for 006 cell annotations"
---

# Tasks: Cell Annotations Enrichment

**Input**: Design documents from `/specs/006-cell-annotations/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/localstorage-schema.md, contracts/annotations-module-api.md

**Tests**: INCLUDED. Constitution Principle II (Test Discipline) requires every
feature to land with automated tests, so Vitest unit, Storybook interaction, and
Playwright e2e tasks are part of each story.

**Organization**: Tasks are grouped by user story (priority order from spec.md)
to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, and polish carry no story label)

## Path Conventions

Single-project browser library. Sources under `src/`, unit tests under
`src/**/__tests__/`, Storybook interaction tests alongside in `src/ui/__tests__/`,
Playwright e2e under `tests/e2e/`. Paths below are exact.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test surfaces and shared helpers used by every story.

- [X] T001 [P] Add Playwright fixture pages for annotation e2e specs under `tests/e2e/fixtures/`: one single-table page, one two-table page, and two same-origin documents (`annotations-doc-a.html`, `annotations-doc-b.html`) for the cross-document flow
- [X] T002 [P] Create the Storybook story scaffold `src/stories/annotations.stories.ts` with a sample annotated table for interaction tests

**Checkpoint**: Test surfaces exist; story work can land its tests against them.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Identity, persistence codec, and styles that ALL stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Export `urlStem` and `storageKeyFor` from `src/utils/slider-persistence.ts` so the annotations store can reuse the `gs:` per-URL-stem scheme (no behaviour change to existing exports)
- [X] T004 [P] Implement cell-identity derivation in `src/enrichments/annotation-identity.ts`: `cellIdentity` (memoised via `WeakMap`), `identityKey`, `parseIdentityKey`, `isOptedOut`, `resolveCell`; tableKey preference `data-gs-key`→`id`→slug(caption)→`t{n}`, rowKey `data-gs-row-key`→slug(first cell)→`r{n}`, columnKey via `colKey` from `view-state-url.ts`; emit ONE `console.warn` per page on index fallback (FR-010,011,012,013)
- [X] T005 [P] Unit tests in `src/enrichments/__tests__/annotation-identity.test.ts`: triple derivation, tableKey preference order, rowKey fallbacks, slug rules, opt-out detection, `resolveCell` returns null for missing target, single warning per page
- [X] T006 [P] Implement the `localStorage` codec in `src/enrichments/annotation-persistence.ts`: `readDocumentAnnotations`, `writeDocumentAnnotations` (version:1 envelope with `title` + `{t,m}` entries, `try/catch` quota guard returning `{ok:false,reason:'quota'|'unavailable'}`), `isStorageAvailable`; uses `storageKeyFor(stem,'annotations')` from T003 (FR-014,017,018; contract `localstorage-schema.md`)
- [X] T007 [P] Unit tests in `src/enrichments/__tests__/annotation-persistence.test.ts`: round-trip (text+modifiedAt), `version!==1`→empty, malformed JSON→empty, quota throw→refuse, storage-unavailable→`{ok:false,'unavailable'}`, empty store removes the key (invariants U1–U8)
- [X] T008 [P] Implement style injection in `src/enrichments/annotation-styles.ts`: idempotent `ensureAnnotationStyles()` injecting `<style data-gs-annotation-styles>` for the hover/focus pin affordance, the persistent corner-triangle marker (shape distinct in monochrome), the `--pulse` keyframe, the popover, and the popup (FR-002,003,025; research R-5)

**Checkpoint**: Identity, persistence, and styling are ready and unit-tested — user stories can begin.

---

## Phase 3: User Story 1 - Annotate a single cell and see a persistent marker (Priority: P1) 🎯 MVP

**Goal**: With Grid-Sight on, hover/focus a body cell to reveal a pin, open a
popover, save a ≤280-char note, see a corner marker + `aria-describedby`, reopen
to edit, and delete — all within one session.

**Independent Test**: On a one-table page, toggle Grid-Sight on, hover a cell,
click the pin, type "check this", Save → marker appears; click the marker →
popover shows the text with Delete enabled; Delete → marker and
`aria-describedby` disappear.

### Tests for User Story 1

- [X] T009 [P] [US1] Interaction test `src/ui/__tests__/annotation-affordance.test.ts`: affordance reveals on hover and on keyboard focus and is Tab-reachable; `renderMarker` paints the corner marker with an accessible name; `aria-describedby` set on save and removed on delete (FR-001,002,003,004,023,025)
- [X] T010 [P] [US1] Interaction test `src/ui/__tests__/annotation-popover.test.ts`: focus lands in textarea on open; Tab cycles Save→Delete; Escape closes without saving; Delete disabled when no note; input and paste clamp to 280 chars (FR-005,006,007,008)
- [X] T011 [P] [US1] Unit test `src/enrichments/__tests__/annotations.test.ts`: `saveAnnotation` upserts the in-memory store and sets `modifiedAt`; empty/whitespace save deletes; `deleteAnnotation` removes; `getAnnotation` returns current text; `tearDownAnnotations` removes all injected DOM (markers, affordances, aria nodes) leaving byte-identical cells

### Implementation for User Story 1

- [X] T012 [US1] Implement orchestration `src/enrichments/annotations.ts`: in-memory `AnnotationStore` (Map keyed by `identityKey`), `applyAnnotations` mounting the affordance on each qualifying body cell, `saveAnnotation` (clamp 280, set `modifiedAt`, write store + `writeDocumentAnnotations`, return quota outcome), `deleteAnnotation`, `getAnnotation`, `hasAnyAnnotationsForOrigin`, `tearDownAnnotations` (depends on T004, T006, T008)
- [X] T013 [US1] Implement `src/ui/annotation-affordance.ts`: `mountAffordance` (hover/focus pin button), `renderMarker` (corner triangle + accessible name + `aria-describedby` node), `clearMarker`, `pulseMarker`; set/clear cell `position:relative` shim (depends on T008)
- [X] T014 [US1] Implement `src/ui/annotation-popover.ts`: `openAnnotationPopover` building textarea/Save/Delete/inline-error DOM, 280-char clamp on input+paste, `installPopupChrome(popup, cell, [textarea,save,delete], onClose)`, Save→`saveAnnotation` (show inline error and keep open on `{ok:false}`), Delete→`deleteAnnotation` (depends on T012, T013)
- [X] T015 [US1] Flip the registry entry in `src/core/enrichment-registry.ts`: set `annotations` `shipped: true` and `tearDown: tearDownAnnotations` (import from `../enrichments/annotations`); confirm boot-time validation still passes
- [X] T016 [US1] Wire `applyAnnotations(table)` into `src/index.ts` `processTable` flow, gated on `'annotations'` being in the effective enabled set
- [X] T017 [P] [US1] Playwright e2e `tests/e2e/annotations.spec.ts`: annotate → marker → reopen popover shows text → Delete removes marker (golden path; SC-001 ≤3 interactions)

**Checkpoint**: US1 is a fully functional, independently testable MVP (single-session annotate/edit/delete).

---

## Phase 4: User Story 2 - Annotations persist across reloads and follow their cell (Priority: P2)

**Goal**: Saved notes survive reload and a new session (per-document
`localStorage`), and stay glued to their source cell across sort/filter.

**Independent Test**: Annotate three cells, reload → all three markers reappear
with text; sort a column so rows reorder → each marker stays on its original
source cell.

### Tests for User Story 2

- [X] T018 [P] [US2] Unit test `src/enrichments/__tests__/annotations-hydrate.test.ts`: `applyAnnotations` hydrates the store from `readDocumentAnnotations`, drops entries for missing rows/columns (FR-016) and opted-out cells (FR-012); identity stays equal (memoised) when a cell's row index changes (reorder) (SC-004)
- [X] T019 [P] [US2] Playwright e2e `tests/e2e/annotations-persist.spec.ts`: annotate, reload the page, markers + text restored from `localStorage`; assert no network request on the persistence path and that the `gs:…:annotations` key exists (SC-003, invariant U11)
- [X] T020 [P] [US2] Playwright e2e `tests/e2e/annotations-reorder.spec.ts`: annotate a cell, sort then filter the table, marker remains on the original source cell with no drift (SC-004)

### Implementation for User Story 2

- [X] T021 [US2] Add hydrate-on-load to `applyAnnotations` in `src/enrichments/annotations.ts`: read `readDocumentAnnotations`, `resolveCell` each entry, drop missing/opted-out (FR-012,016), render surviving markers within one animation frame (FR-015, SC-002) (depends on T012)
- [X] T022 [US2] Re-attach markers after row reordering in `src/enrichments/annotations.ts`: subscribe to the visible-rows change event (or re-resolve on enrichment refresh) so markers follow their source cell when sort/filter moves/rebuilds rows; verify `aria-describedby` survives (FR-011, SC-004)
- [X] T023 [US2] Session-only fallback in `src/enrichments/annotations.ts`: when `isStorageAvailable()` is false, keep the in-memory store working and emit at most one `console.warn` per page; never throw (FR-017)

**Checkpoint**: US1 + US2 both work independently; notes are durable and position-stable.

---

## Phase 5: User Story 3 - Cross-document annotations popup (Priority: P3)

**Goal**: A "Show annotations" entry opens a popup listing every annotation for
the current origin (grouped by document, with last-modified dates) and deep-links
to each cell — scrolling in place or navigating to another same-origin document.

**Independent Test**: Annotate cells on two same-origin pages; open the popup on
either page; entries from both documents appear with dates; click an entry on the
*other* document → browser navigates there and scrolls the cell into view with
its marker pulsing.

### Tests for User Story 3

- [X] T024 [P] [US3] Unit test `src/enrichments/__tests__/annotation-index.test.ts`: `buildCrossDocumentIndex` selects only `^gs:.*:annotations$` keys, groups by document, orders by `modifiedAt`, flags `isCurrentDocument`, and yields an empty model when none exist (invariant U9; US3 AC-1,4)
- [X] T025 [P] [US3] Interaction test `src/ui/__tests__/annotation-popup.test.ts`: list grouping + dates render; arrow keys move, Enter activates, Escape closes; same-document entry scrolls + pulses; cross-document entry triggers navigation to `documentUrl#gs.annot=key` (FR-020,021,022)
- [X] T026 [P] [US3] Playwright e2e `tests/e2e/annotations-popup.spec.ts`: cross-document — annotate on doc A and doc B, open popup, click the doc-B entry from doc A, assert navigation + scroll-to-cell + marker pulse, and that `#gs.annot` is cleared after consumption (SC-006, invariant U10)

### Implementation for User Story 3

- [X] T027 [P] [US3] Implement `src/enrichments/annotation-index.ts`: `buildCrossDocumentIndex` scanning `localStorage` for the current origin, reconstructing `documentUrl`/`documentLabel` from each key + envelope `title`, producing the grouped `AnnotationPopupViewModel` (research R-8)
- [X] T028 [US3] Implement `consumeNavigationHint` in `src/enrichments/annotations.ts`: read `#gs.annot=<key>` from the hash on load, `resolveCell`, `scrollIntoView` + `pulseMarker`, then clear the hint via `history.replaceState`; silent no-op when absent/unresolvable (FR-019,021)
- [X] T029 [US3] Implement `src/ui/annotation-popup.ts`: `registerAnnotationsMenuEntry` (visible only when `hasAnyAnnotationsForOrigin()`); `openAnnotationsPopup` rendering the index via `installPopupChrome`, keyboard nav, empty-state message; activation → same-doc scroll+pulse or navigate to `documentUrl#gs.annot=key` (FR-020,021,022; US3 AC-1–4)
- [X] T030 [US3] Wire into `src/index.ts`: call `registerAnnotationsMenuEntry()` once per page and `consumeNavigationHint()` once after tables are processed

**Checkpoint**: All three stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Budget, accessibility, and end-to-end validation across stories.

- [X] T031 Run `yarn build` and confirm via `scripts/bundle-size.js` that the IIFE net delta is ≤ 2 KB gzipped (SC-005) and the total stays ≤ 10 KB; trim (defer/slim the popup first) if over
- [X] T032 [P] Flesh out `src/stories/annotations.stories.ts` with affordance/popover/marker/popup stories for visual + interaction coverage
- [X] T033 [P] Accessibility pass (constitution §III): keyboard-only operation of affordance, popover, and popup; marker distinguishable in a monochrome simulation; `aria-describedby` verified with a screen reader (FR-023,024,025)
- [X] T034 Run `quickstart.md` end-to-end (all 7 sections), including toggle-off restoring byte-identical DOM with the `localStorage` envelope left intact

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**. Within it, T003 precedes T006; T004/T005, T006/T007, T008 are otherwise parallel.
- **User Stories (Phase 3–5)**: all depend on Foundational. US1 is the MVP; US2 builds on US1's `annotations.ts`; US3 is largely independent (adds new modules) but its menu entry/nav-hint wiring assumes US1's orchestration exists.
- **Polish (Phase 6)**: depends on the desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational. No dependency on other stories.
- **US2 (P2)**: extends `annotations.ts` from US1 (hydrate/reorder/fallback). Independently testable (reload + reorder) once US1 + T021–T023 land.
- **US3 (P3)**: adds `annotation-index.ts` + `annotation-popup.ts` + nav-hint; depends on US1 orchestration (`hasAnyAnnotationsForOrigin`, `pulseMarker`, `resolveCell`) and on persisted data from US2 to be meaningful, but is independently testable with seeded `localStorage`.

### Within Each User Story

- Tests are written to fail first, then implementation makes them pass.
- Foundational modules (identity, persistence, styles) before orchestration.
- Orchestration (`annotations.ts`) before affordance/popover/popup UI.
- Story complete and green before moving to the next priority.

### Parallel Opportunities

- Setup: T001, T002 in parallel.
- Foundational: after T003, run T004+T005, T006+T007, and T008 as three parallel tracks.
- US1 tests T009/T010/T011 in parallel; then T012→T013→T014 (T013 parallel-able with T012's store work, but T014 needs both); T017 parallel once UI exists.
- US2 tests T018/T019/T020 in parallel.
- US3 tests T024/T025/T026 in parallel; T027 parallel with tests.
- Different stories can be staffed in parallel once Foundational is done.

---

## Parallel Example: Foundational Phase

```bash
# After T003 (export stem helpers) lands, run three tracks in parallel:
Task: "Implement annotation-identity.ts + its unit tests (T004, T005)"
Task: "Implement annotation-persistence.ts + its unit tests (T006, T007)"
Task: "Implement annotation-styles.ts (T008)"
```

## Parallel Example: User Story 1 Tests

```bash
Task: "Interaction test annotation-affordance.test.ts (T009)"
Task: "Interaction test annotation-popover.test.ts (T010)"
Task: "Unit test annotations.test.ts (T011)"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational (identity, persistence, styles).
2. Phase 3 US1: orchestration + affordance + popover + registry flip + index wiring.
3. **STOP and VALIDATE**: annotate/edit/delete a cell in one session; run the US1 e2e.
4. Demo the MVP.

### Incremental Delivery

1. Setup + Foundational → ready.
2. US1 → in-session annotations (MVP). Test + demo.
3. US2 → durability + position stability. Test + demo.
4. US3 → cross-document popup + deep links. Test + demo.
5. Polish → bundle budget, a11y, quickstart validation.

### Parallel Team Strategy

After Foundational: Dev A on US1, Dev B can start US3's standalone modules
(`annotation-index.ts` + its tests) against seeded `localStorage`, Dev C drafts
US2 e2e fixtures. US1 must land before US2/US3 wiring into `annotations.ts`/`index.ts`.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Every story carries unit/interaction/e2e tests per Constitution Principle II — they must be green before merge (plus `yarn build` bundle check).
- Persistence is `localStorage` only; the URL fragment is used solely as the transient `#gs.annot` scroll hint (FR-019).
- Toggle-off must restore byte-identical DOM while leaving the `localStorage` envelope intact.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
