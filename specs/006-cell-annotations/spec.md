# Feature Specification: Cell Annotations Enrichment

**Feature Branch**: `006-cell-annotations`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "Let users attach a short text note to any data cell when Grid-Sight is enabled, with a hover-revealed pin affordance, a popover editor, a visible per-cell marker, and shareable URL state."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Annotate a single cell and see a persistent marker (Priority: P1)

A user is reading a published report in the browser and wants to leave a short note
next to a single cell — "this figure is for Q3 only" or "verify with finance" — without
editing the page source. With Grid-Sight enabled, hovering a data cell reveals a small
"annotate" affordance (e.g. a corner pin glyph) in the cell. Clicking the affordance
opens a popover containing a textarea pre-filled with any existing note, plus **Save**
and **Delete** buttons. After Save, the popover closes and the cell shows a tinted
corner triangle marker indicating an attached note. Hovering the marker shows the note
text in a tooltip (truncated with an ellipsis if it would otherwise overflow).

**Why this priority**: Annotating a cell is the smallest, most self-contained piece of
this feature. It is independently valuable even without the panel or sharing — a single
user can mark up a table for their own next reading. It also exercises every UI piece
that the other stories layer on top of (affordance, popover, marker).

**Independent Test**: Open a page with one ordinary HTML table. Toggle Grid-Sight on,
hover a body cell, click the pin affordance, type "check this", click Save, and
confirm the popover closes and a corner marker appears. Re-open the popover by
clicking the marker, confirm the saved text is shown, click Delete, and confirm the
marker disappears.

**Acceptance Scenarios**:

1. **Given** Grid-Sight is enabled and the user hovers a body cell with no existing
   note, **When** the hover settles, **Then** a pin affordance becomes visible in a
   corner of the cell and is keyboard-focusable from the cell.
2. **Given** the pin affordance is visible, **When** the user clicks it, **Then** a
   popover opens anchored to the cell, containing an empty textarea, a **Save**
   button, and a **Delete** button (the Delete button is disabled until a note
   exists).
3. **Given** the popover is open and the user types up to 280 characters, **When** the
   user clicks **Save**, **Then** the popover closes, a corner-triangle marker
   appears on the cell, and the cell's `aria-describedby` references a node that
   contains the note text.
4. **Given** a cell already has a saved note, **When** the user clicks its marker,
   **Then** the popover re-opens with the existing text in the textarea and
   **Delete** enabled.
5. **Given** the popover is open with existing text, **When** the user clicks
   **Delete**, **Then** the note is removed, the marker disappears, and the
   `aria-describedby` reference is removed from the cell.

---

### User Story 2 - Share an annotated view via URL (Priority: P2)

A user has annotated a handful of cells in a shared report and wants to send the
exact annotated view to a colleague. The full set of annotations is encoded in the
URL fragment using the same per-page persistence scheme as
`src/utils/slider-persistence.ts`. Pasting the URL in a fresh tab reproduces every
annotation in the same cells, with no reliance on `localStorage`.

**Why this priority**: Without sharing, annotations are a single-user scratchpad.
With sharing, they become a lightweight review/comment workflow on any static HTML
table. Sharing layers cleanly on top of Story 1 — Story 1 is shippable without it,
but this is where the feature earns its keep.

**Independent Test**: Annotate three cells across two tables on a page, copy the
URL, open it in a new private window. Verify all three markers render in the same
cells and the popover content matches what was saved, with no prior `localStorage`
value present.

**Acceptance Scenarios**:

1. **Given** the user has saved a note on a cell, **When** they reload the page,
   **Then** the same cell shows the marker and the saved note is retrievable via
   the popover.
2. **Given** a URL fragment containing a note for a cell that no longer exists in
   the table (e.g. the row was removed in the source), **When** the URL is opened,
   **Then** the page loads with no error and the orphaned note is silently dropped
   from the active set.
3. **Given** the user opens a URL with five annotations in a private window,
   **When** the page settles, **Then** all five markers are visible without any
   `localStorage` value being read or written first.

---

### User Story 3 - Page-level annotations panel for navigation (Priority: P3)

A user reviewing a large page with many tables wants a single place to see every
note they have left and to jump to each one. A "Show annotations" entry in the GS
menu opens a panel listing all notes on the page with their table and column
context (e.g. "Sales › Q3 — verify with finance"). Clicking an entry scrolls the
cell into view and briefly pulses its marker.

**Why this priority**: The panel is a convenience layer over Stories 1 and 2. It
is not required for the feature to be useful but it makes notes discoverable on
long pages where markers might be off-screen.

**Independent Test**: Annotate cells in three different tables on a long page.
Open the annotations panel from the GS menu, confirm three entries are listed,
click the bottom entry, and confirm the page scrolls so the target cell is
visible and its marker pulses briefly.

**Acceptance Scenarios**:

1. **Given** the page has at least one annotation, **When** the user opens the
   annotations panel, **Then** every annotation is listed with table caption (or
   fallback identifier), column header text, and the note text (truncated with
   ellipsis past one line).
2. **Given** the annotations panel is open, **When** the user clicks an entry,
   **Then** the corresponding cell is scrolled into view and its marker is
   visibly highlighted for at least one animation frame.
3. **Given** the page has no annotations, **When** the user opens the panel,
   **Then** the panel shows a single empty-state message and no list items.

---

### Edge Cases

- **Cell identity across reorders / sorts / filters**: Cells MUST be identified by a
  stable `(table-key, row-key, column-key)` triple derived from the source DOM at
  load time, NOT by post-sort visual position. If a sort, filter, or other
  enrichment reorders rows, existing annotations MUST follow their underlying
  cell.
- **Table without a stable identifier**: When a table has no `id`, `caption`, or
  `data-gs-key`, Grid-Sight MUST fall back to an index-based key (table index in
  document order plus row/column indices) AND emit a single non-blocking console
  warning per page explaining that annotations on that table are fragile under
  source edits.
- **Note length overflow**: Notes MUST be capped at **280 characters**. The textarea
  MUST enforce the cap on input. Marker tooltips MUST truncate display with an
  ellipsis if the rendered note would exceed the tooltip's one-line width; the
  full text remains available in the popover.
- **URL length limit reached**: When adding a new annotation would push the URL
  fragment past **8 KB**, Grid-Sight MUST refuse the save, leave the popover open,
  and display an inline error in the popover ("URL is full — delete an existing
  note to add a new one"). Existing annotations MUST NOT be silently dropped.
- **`data-gs-ignore` or `data-gs-no-annotate` opt-out**: A table or cell carrying
  either attribute MUST NOT show the annotate affordance, and any URL-encoded note
  targeting such a cell MUST be silently ignored.
- **Annotations on cells with `rowspan` / `colspan`**: A spanned cell MAY be
  annotated; the annotation attaches to the single source cell, not to each
  visually-covered grid position. The marker renders on the source cell only.
- **Multiple annotations on the same cell**: Only one note per cell is supported in
  v1. Re-saving replaces the existing note.
- **Disabling Grid-Sight while annotations are active**: Turning Grid-Sight off MUST
  hide all markers and affordances; turning it back on MUST re-apply the
  URL-encoded annotations.
- **Cell containing block-level content** (e.g. a nested list or image): The
  annotate affordance MUST still be offered; the popover anchors to the cell, not
  to the inner content.

## Requirements *(mandatory)*

### Functional Requirements

**Affordance & marker**

- **FR-001**: Grid-Sight MUST add an annotate affordance to body cells of every
  qualifying table when Grid-Sight is enabled and the cell is hovered or focused.
- **FR-002**: The affordance MUST become visible on pointer hover and on keyboard
  focus of the parent cell, and MUST remain reachable by Tab order once visible.
- **FR-003**: Cells with a saved note MUST display a persistent corner marker
  (tinted triangle or pin glyph) regardless of hover state, distinct from the
  hover-only affordance.
- **FR-004**: The marker MUST have a discernible accessible name (e.g. "Annotated
  cell — click to view note") and expose the note text via an `aria-describedby`
  reference on the parent cell.

**Popover editor**

- **FR-005**: Clicking the affordance or marker MUST open a popover anchored to the
  cell, containing a textarea, a **Save** button, and a **Delete** button.
- **FR-006**: The popover MUST be keyboard-navigable: focus MUST land in the
  textarea on open, Tab MUST move through Save and Delete, and Escape MUST close
  the popover without saving.
- **FR-007**: The textarea MUST enforce a hard cap of **280 characters** on input;
  paste operations exceeding the cap MUST be truncated to the cap.
- **FR-008**: The **Delete** button MUST be disabled when no note currently exists
  for the cell.
- **FR-009**: Saving a note MUST close the popover, render the marker, and update
  the URL fragment in a single user-visible step.

**Cell identity & integration**

- **FR-010**: Each annotation MUST be keyed by a `(table-key, row-key, column-key)`
  triple. `table-key` MUST prefer, in order: an explicit `data-gs-key`, the table
  `id`, the trimmed `caption` text, and finally the table's document-order index.
- **FR-011**: Annotations MUST follow their source cell across re-sorts, filters,
  and other Grid-Sight enrichments — identity MUST NOT depend on visual row
  position.
- **FR-012**: Tables and cells carrying `data-gs-ignore` or `data-gs-no-annotate`
  MUST NOT show the affordance, and URL-encoded notes targeting them MUST be
  silently dropped.
- **FR-013**: When a table lacks any stable identifier, Grid-Sight MUST fall back
  to an index-based key and emit at most one non-blocking console warning per
  page.

**Persistence**

- **FR-014**: The full set of active annotations MUST be encoded in the URL
  fragment using the same per-URL-stem scheme as `src/utils/slider-persistence.ts`.
- **FR-015**: On page load, Grid-Sight MUST decode any annotation directives from
  the URL fragment and render markers before the user interacts with the page.
- **FR-016**: A URL directive referring to a missing table, missing row, or
  missing column MUST be silently ignored without erroring.
- **FR-017**: When the URL fragment would exceed **8 KB** as a result of saving a
  new annotation, Grid-Sight MUST refuse the save, surface an inline error in
  the popover, and leave existing annotations untouched. [NEEDS CLARIFICATION:
  is "drop oldest" preferred over refuse-and-warn? Spec currently chooses
  refuse-and-warn so existing notes are never lost without the user's consent.]
- **FR-018**: Grid-Sight MUST NOT write annotations to `localStorage`,
  `sessionStorage`, IndexedDB, cookies, or any other persistent store outside the
  URL fragment.

**Annotations panel**

- **FR-019**: A "Show annotations" entry MUST appear in the GS menu when at least
  one annotation exists on the page; selecting it MUST open a panel listing every
  annotation with table identifier, column header text, and truncated note text.
- **FR-020**: Clicking an entry in the panel MUST scroll the corresponding cell
  into view and visually highlight its marker for at least one animation frame.
- **FR-021**: The annotations panel MUST be keyboard-navigable: arrow keys move
  between entries, Enter activates the focused entry, and Escape closes the
  panel.

**Accessibility**

- **FR-022**: Each annotated cell MUST expose its note to assistive technology via
  `aria-describedby` pointing at a node containing the current note text.
- **FR-023**: The affordance, marker, popover controls, and panel entries MUST all
  be operable by keyboard alone (Enter / Space activates buttons).
- **FR-024**: Colour MUST NOT be the sole channel indicating an annotated cell —
  the corner triangle / pin glyph MUST be distinguishable in monochrome.

### Key Entities

- **Annotation**: A `(table-key, row-key, column-key, text)` record where `text`
  is at most 280 characters. At most one annotation per cell.
- **Cell Identity Triple**: The persistence key for an annotation, derived from
  the source DOM at load time and stable across reorders.
- **Persisted Annotation Set**: The serialisation of every active annotation on a
  page, written to the URL fragment.
- **Annotations Panel View Model**: An ordered list of annotations grouped by
  table for display in the page-level panel, with each entry holding enough
  context (table identifier, column header, truncated text) to render and
  scroll-target a cell.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can attach a new note to a cell in **three interactions or
  fewer** from a Grid-Sight-enabled page (hover, click, type, Save counts as
  three discrete user actions plus typing).
- **SC-002**: Re-opening a URL containing up to 50 annotations MUST render every
  marker within **one animation frame** of first paint on a mid-range laptop.
- **SC-003**: An annotated view shared by URL MUST reproduce on another machine
  **100% of the time** with no `localStorage` dependency.
- **SC-004**: Sorting, filtering, or otherwise reordering rows MUST keep every
  annotation on its original source cell in **100%** of cases (no visual drift).
- **SC-005**: The full feature (affordance, popover, marker, panel, persistence)
  MUST add no more than **2 KB gzipped** to the IIFE bundle, in line with the
  Lightweight & Minimal Dependencies constitutional principle.

## Assumptions

- The existing per-URL-stem persistence model (URL fragment, same scheme as
  `src/utils/slider-persistence.ts`) is reused unchanged.
- A 280-character cap per note and an 8 KB cap on the total URL fragment are
  reasonable defaults to keep shared URLs paste-able across mail clients and
  chat tools. Both caps are tunable in code but not exposed to end users in v1.
- One annotation per cell is sufficient for v1. Threaded comments, replies,
  attachments, and rich text are out of scope.
- Cell identity is derived from the load-time DOM. Annotations on tables whose
  rows are re-keyed by the host page on each load (e.g. server-rendered with
  rotating IDs) are out of scope; the index-based fallback MAY drift in that
  case and the console warning documents the risk.
- The annotations panel reuses the existing GS menu surface; no new top-level UI
  chrome is introduced.
- No new runtime dependency is introduced; the popover, marker, and panel are
  implemented with the platform DOM and the existing lozenge styling system in
  `src/ui/header-utils.ts`.
- Annotations are scoped to body cells only. Annotating header cells or
  `<caption>` is out of scope for v1.
