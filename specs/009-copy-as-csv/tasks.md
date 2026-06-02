# Tasks: Copy Table As CSV / TSV / Markdown

**Input**: Design documents from `/specs/009-copy-as-csv/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/copy-as-csv-api.md, quickstart.md

**Tests**: INCLUDED. The spec defines acceptance scenarios, plan.md enumerates
specific test files, and constitution §II makes a green unit + e2e suite a merge
gate.

**Organization**: Tasks are grouped by user story (P1 → P2) so each story is an
independently testable increment. US1 (CSV copy) is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 (user-story phases only)
- Paths are repository-relative; single-project layout per plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A demo fixture that the story, e2e, and manual verification target.

- [x] T001 [P] Add demo page `demo/copy-as-csv/index.html` with a table that has a row-header column, numeric + categorical columns, a `rowspan`/`colspan` example, and a cumulative/sparkline virtual-column trigger; register the page in `demo/nav.js` following the existing per-enrichment demo pattern.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Format-agnostic pieces both stories build on — the config type and
the export-model builder. No user-facing lozenge is surfaced yet (the catalog
entry stays `shipped: false` until US1 wires a working popup), so `main` stays
green per task.

**⚠️ CRITICAL**: Must complete before US1 / US2 work begins.

- [x] T002 [P] Define `CopyFormat`, `CopyOptions`, and `DEFAULT_COPY_OPTIONS` ({format:'csv', headers:true, rowHeaders:true, virtualCols:true}) in `src/utils/copy-persistence.ts` (types + defaults only; codec lands in US2).
- [x] T003 Implement `buildExportModel(table, options)` and the `ExportColumn`/`ExportModel` shapes in `src/enrichments/copy-as-csv.ts` — read `visibleBodyRows()` (minus `data-gs-no-export` rows), resolve source columns + header text via `table-grid` (`sourceColumnCount`, `headerCellFor`, `cellAt`, `cellValue`), append `listVirtualColumnsForCopy()` columns when `options.virtualCols`, prepend the row-header column when `options.rowHeaders`, and build a rectangular `matrix` with `''` for span-covered/short positions (research D-3). Derive each column's `align` (numeric → right).
- [x] T004 [P] Unit-test the builder in `src/enrichments/__tests__/copy-as-csv.builder.test.ts`: visible-only rows in sorted order, `data-gs-no-export` row omitted, row-header on/off, virtual-columns on/off, rowspan/colspan flatten (value at origin + empty covered cells), empty visible view (rowCount 0, columns intact), and INV-3 (no lozenge/slider text leaks via `cellValue`).

**Checkpoint**: Export model proven by tests; stories can begin.

---

## Phase 3: User Story 1 — One-click copy of the current view as CSV (Priority: P1) 🎯 MVP

**Goal**: A corner lozenge opens a popup; pressing Copy puts the current visible
view on the clipboard as RFC 4180 CSV (honouring the three option checkboxes),
shows a toast, and falls back to a selectable textarea when the clipboard is
unavailable. Toggling Grid-Sight off removes the lozenge/popup/toast.

**Independent Test**: On a page with one table, filter to hide half the rows and
sort a column; click the copy lozenge, accept defaults, press Copy; paste into a
plain editor and confirm only the visible rows appear in sorted order,
comma-separated, header first. Deny the clipboard and confirm the textarea
fallback is pre-selected.

- [x] T005 [P] [US1] Implement `toCsv(header, body)` (RFC 4180: comma delimiter, CRLF, quote-wrap on `, " CR LF`, internal `"` doubled) plus shared field helpers in `src/enrichments/csv-serialize.ts`.
- [x] T006 [P] [US1] Unit-test RFC 4180 vectors in `src/enrichments/__tests__/csv-serialize.test.ts`: embedded comma/quote/newline, CRLF line endings, `header === null` omits header row, header-only empty body.
- [x] T007 [US1] Implement `serialiseModel(model, options)` in `src/enrichments/copy-as-csv.ts` routing `format:'csv'` → `toCsv` (TSV/MD added in US2); pass `header` from `columns[].headerText` when `options.headers`, else `null`.
- [x] T008 [P] [US1] Implement `showCopyToast(message)` / `hideCopyToast()` in `src/ui/copy-toast.ts` — singleton `role="status"` `aria-live="polite"` `data-gs-injected` element, auto-dismiss ≤ 5 s, never focused (FR-015, FR-016, FR-022).
- [x] T009 [US1] Implement `openCopyPopup(args)` / `closeAllCopyPopups()` in `src/ui/copy-csv-popup.ts` — `role="dialog"` with labelled title, the three option checkboxes (defaults from `DEFAULT_COPY_OPTIONS`), Copy + Close, and an "i" note explaining "current visible view" + the flatten rule (FR-003, FR-005); use `installPopupChrome` + `positionPopup` for focus-trap/Esc/outside-click/focus-restore (FR-004); on Copy call `buildExportModel`→`serialiseModel`, then `await navigator.clipboard?.writeText(...)` guarded in try/catch; on success show toast `Copied {rows} rows × {cols} columns as CSV` and close; on failure/absence swap the body for a focused, fully-selected `<textarea>` and toast the fallback (FR-013, FR-014). Format is fixed to CSV in this story.
- [x] T010 [P] [US1] Add runtime-injected popup/toast CSS (`.gs-copy-popup`, textarea, toast) following the `slider-styles.ts` idempotent-injection pattern, in `src/ui/copy-csv-popup.ts` (or a sibling styles helper).
- [x] T011 [US1] Implement `removeCopyUi(table)` in `src/enrichments/copy-as-csv.ts` (call `closeAllCopyPopups()` + `hideCopyToast()`; no source-DOM to revert).
- [x] T012 [US1] Register the table-level descriptor in `src/ui/copy-csv-lozenge.ts` (`appliesTo: ctx.headerType === 'table' && !ctx.table.hasAttribute('data-gs-no-export')`; `mount` builds a `<button class="gs-lozenge" data-gs-lozenge-id="copy-as-csv">⎘</button>` that opens the popup), and add `import './ui/copy-csv-lozenge';` to `src/index.ts`.
- [x] T013 [US1] Flip the catalog entry in `src/core/enrichment-registry.ts` to `shipped: true` and add `tearDown: removeCopyUi` (import from `../enrichments/copy-as-csv`); update the spec-comment.
- [x] T014 [P] [US1] Storybook interaction story `src/stories/copy-as-csv.stories.ts`: open popup, Copy with defaults, toggle "include GS virtual columns" off with a virtual column active, and exercise the textarea fallback (clipboard stubbed to reject).
- [x] T015 [US1] Playwright e2e `tests/e2e/copy-as-csv.spec.ts`: enable GS, filter + sort, copy, read the clipboard back and assert visible rows in sorted order with header first; a `data-gs-no-export` row is omitted; toast announces the row × column count; clipboard-denied path yields a pre-selected textarea; toggling GS off removes the lozenge and any open popup/toast.

**Checkpoint**: CSV copy fully works end-to-end and is the shippable MVP.

---

## Phase 4: User Story 2 — Choose format, remember the choice (Priority: P2)

**Goal**: The popup offers CSV / TSV / Markdown; the chosen format and the three
booleans persist per page in the URL fragment (and localStorage) so reopening or
sharing the URL restores the last configuration.

**Independent Test**: Open the popup, switch to Markdown, copy, close. Reload and
reopen the popup → Markdown is preselected. A URL carrying an unsupported format
falls back to CSV without error.

- [x] T016 [P] [US2] Implement `toTsv(header, body)` (tab delimiter, LF, no quoting, tab/CR/LF inside a field → single space) and `toMarkdown(header, body, aligns)` (GFM table, `|`→`\|`, intra-cell newline → space, alignment row from `aligns`, blank header cells when `header === null`) in `src/enrichments/csv-serialize.ts`.
- [x] T017 [P] [US2] Unit-test TSV + Markdown vectors in `src/enrichments/__tests__/csv-serialize.test.ts`: TSV tab/newline replacement, Markdown pipe escaping, numeric → right alignment, headers-off blank header row.
- [x] T018 [US2] Extend `serialiseModel` in `src/enrichments/copy-as-csv.ts` to route `'tsv'`/`'md'` and pass per-column `aligns` (from `ExportColumn.align`) to `toMarkdown`.
- [x] T019 [US2] Implement the full `gs.cp` codec in `src/utils/copy-persistence.ts` — `encodeCopyFragment`/`decodeCopyFragment` (compact `fmt:csv;h:1;rh:1;vc:1`; decode never throws — unknown `fmt`→`csv`, bad boolean→`true`), `readCopyFromUrl`/`writeCopyToUrl`, `readCopyFromStorage`/`writeCopyToStorage` (`gs:${stem}:copy`), `persistCopyConfig` (URL via `history.replaceState` + storage), and `resolveInitialCopyConfig` (URL > storage > defaults), mirroring `outlier-persistence.ts`.
- [x] T020 [P] [US2] Unit-test persistence in `src/utils/__tests__/copy-persistence.test.ts`: encode/decode round-trip for all formats + booleans, unknown-format → CSV, unparseable boolean → true, and URL-only reproduction with no localStorage present (SC-004).
- [x] T021 [US2] Add the CSV/TSV/Markdown format radios to `src/ui/copy-csv-popup.ts`, preselect from `resolveInitialCopyConfig()`, and call `persistCopyConfig(...)` on every format change (FR-017).
- [x] T022 [US2] Persist the three option checkboxes via `persistCopyConfig(...)` on change and hydrate them from `resolveInitialCopyConfig()` when the popup opens, in `src/ui/copy-csv-popup.ts` (FR-018).
- [x] T023 [US2] Extend `tests/e2e/copy-as-csv.spec.ts` (and the story): pick Markdown → copy → assert GFM output; reload → reopen → Markdown + options preselected; a hand-crafted URL with an unknown format opens with CSV preselected and no console error.

**Checkpoint**: All three formats work and the configuration round-trips via URL + storage.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T024 [P] Flesh out `demo/copy-as-csv/` captions and the popup "i" tooltip text explaining "current visible view" (post sort/filter) and the rowspan/colspan flatten rule (FR-005, Edge Cases).
- [x] T025 [P] Document the shipped enrichment in `docs/architecture/enrichments.md` (copy-as-csv: corner lozenge, registry consumption, persistence segment `gs.cp`).
- [x] T026 Run `node scripts/bundle-size.js` after `yarn build`; confirm the IIFE gzipped delta is ≤ 1.5 KB and stays under the enforced 25 KB cap; record the number in the PR description.
- [x] T027 [P] Accessibility verification: dialog role/label, focus trap, Esc, focus-restore to the lozenge; lozenge operable by Enter/Space; toast `aria-live` does not steal focus (assert in the story where feasible; otherwise manual).
- [x] T028 Final gate: `yarn test` (Vitest + Storybook) and `yarn test:e2e` (Playwright) green; `yarn build` clean with zero `tsc` errors (constitution §II / Quality Gates).

---

## Dependencies & Execution Order

- **Setup (T001)** — independent; can run anytime (needed before T015 e2e / T014 story run).
- **Foundational (T002–T004)** — blocks all story work. `T002 → T003 → T004`.
- **US1 (T005–T015)** — depends on Foundational. Internal order:
  - `T005 → T006`; `T007` needs T005 + T003.
  - `T009` needs T007 + T008 + T010; `T011` needs T009; `T012` needs T009 + T011; `T013` needs T011 + T012.
  - `T014`, `T015` need T012/T013 (and T001 for a fixture).
- **US2 (T016–T023)** — depends on US1 popup existing (T009/T012) + Foundational. Internal order:
  - `T016 → T017`; `T018` needs T016.
  - `T019 → T020`; `T021`/`T022` need T019 + T009.
  - `T023` needs T018 + T021 + T022.
- **Polish (T024–T028)** — after the stories it documents/measures; T028 is the final merge gate.

## Parallel Execution Examples

- **Foundational kickoff**: T002 then, once done, T003 ∥ (its test) T004 split by author.
- **US1 parallel batch** (after Foundational): `T005` (csv-serialize) ∥ `T008` (toast) ∥ `T010` (styles) ∥ `T014` (story skeleton) — all different files.
- **US1 tests parallel**: `T006` ∥ `T004` (different test files).
- **US2 parallel batch**: `T016` (serialisers) ∥ `T019` (persistence codec) — different files; their tests `T017` ∥ `T020` likewise.

## Implementation Strategy

- **MVP = Phase 1 + 2 + 3 (US1).** Delivers one-click CSV copy of the visible
  view with the clipboard fallback, toast, and teardown — independently
  shippable and the headline value.
- **Increment 2 = Phase 4 (US2):** add TSV/Markdown + URL/storage persistence.
- **Increment 3 = Phase 5:** docs, demo polish, bundle + a11y verification, final
  green-suite gate.
- Keep `main` green per task: the catalog stays `shipped: false` until T013, so a
  partially-built popup never surfaces to users.

---

**Total tasks**: 28 — Setup 1, Foundational 3, US1 11, US2 8, Polish 5.
**Independent test criteria**: US1 and US2 each carry their own e2e/story coverage and "Independent Test" above.
**MVP scope**: Phases 1–3 (US1).
