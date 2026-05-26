# Feature Specification: Cell Annotations Enrichment

**Feature Branch**: `006-cell-annotations`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "Let users attach a short text note to any data cell
when Grid-Sight is enabled, with a hover-revealed pin affordance, a popover
editor, a visible per-cell marker, local persistence in the browser, and a
cross-document popup that lists every annotation on this site (with the date
each was modified) and jumps straight to the annotated cell."

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
this feature. It is independently valuable even without persistence or the cross-document
browser — a single user can mark up a table for their own next reading. It also exercises
every UI piece that the other stories layer on top of (affordance, popover, marker).

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

### User Story 2 - Annotations persist across reloads and follow their cell (Priority: P2)

A user has annotated several cells in a report. They close the tab and come back
the next day; every note is still attached to the same cell. In between, they sort
and filter the table — the notes stay glued to their *source* cells, not to whatever
row happens to occupy that visual position now. Persistence is local to the browser
(per-document `localStorage`, same `gs:` per-URL-stem scheme as
`src/utils/slider-persistence.ts`); nothing is sent over the network and nothing
depends on the URL.

**Why this priority**: Without durable persistence, annotations are a throwaway
scratchpad that evaporates on reload. Local persistence makes them a real
single-user review tool on any static HTML table. It layers cleanly on top of Story
1 — Story 1 is shippable without it, but this is where the feature earns its keep.

**Independent Test**: Annotate three cells across two tables on a page. Reload the
page and confirm all three markers reappear on the same cells with the saved text.
Then sort one table by a column so its rows reorder, and confirm each note is still
on its original source cell, not on the row now sitting in that position.

**Acceptance Scenarios**:

1. **Given** the user has saved a note on a cell, **When** they reload the page,
   **Then** the same cell shows the marker and the saved note is retrievable via
   the popover.
2. **Given** a stored note for a cell that no longer exists in the table (e.g. the
   row was removed in the source), **When** the page loads, **Then** the page loads
   with no error and the orphaned note is silently dropped from the active set.
3. **Given** the user has annotated a cell, **When** the table is sorted or filtered
   so rows reorder, **Then** the marker stays on the original source cell with no
   visual drift.
4. **Given** the user saves a note, **When** the save completes, **Then** the stored
   record carries a last-modified timestamp set to the moment of the save.

---

### User Story 3 - Cross-document annotations popup (Priority: P3)

A user has left notes across several pages of the same site and wants a single place
to see everything they have annotated — and to jump straight back to any of it. A
"Show annotations" entry in the GS menu opens a popup that lists every annotation
stored in this browser for the current site (origin), grouped by document, with the
note text, the document it lives on, and the date each note was last modified.
Clicking an entry opens that document (navigating if it is a different page) and
scrolls the annotated cell into view, briefly pulsing its marker.

**Why this priority**: As notes accumulate across many pages, the per-page markers
alone don't answer "where did I leave that comment?". The cross-document popup is the
discovery and navigation layer over Stories 1 and 2. It replaces the earlier
per-page-only panel concept with a site-wide view that also deep-links back to the
exact cell.

**Independent Test**: Annotate cells on two different pages of the same site. On
either page, open the annotations popup from the GS menu, confirm entries from
*both* documents are listed with their last-modified dates, click an entry that
belongs to the *other* document, and confirm the browser navigates to that document
and scrolls the target cell into view with its marker pulsing.

**Acceptance Scenarios**:

1. **Given** the browser holds at least one annotation for the current origin,
   **When** the user opens the annotations popup, **Then** every annotation is
   listed grouped by document, each entry showing the document identifier
   (title or path), the column/cell context, the note text (truncated with
   ellipsis past one line), and the last-modified date.
2. **Given** the popup is open, **When** the user clicks an entry for a cell on the
   *current* document, **Then** the cell is scrolled into view and its marker is
   visibly highlighted for at least one animation frame.
3. **Given** the popup is open, **When** the user clicks an entry for a cell on a
   *different* document of the same origin, **Then** the browser navigates to that
   document and, on load, scrolls the target cell into view and pulses its marker.
4. **Given** the browser holds no annotations for the current origin, **When** the
   user opens the popup, **Then** the popup shows a single empty-state message and
   no list items.

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
- **`localStorage` unavailable**: When `localStorage` cannot be read or written
  (private-mode restrictions, `file://` null-origin quirks, disabled storage),
  Grid-Sight MUST still allow annotating for the current session (in-memory),
  MUST NOT throw into the host page, and MUST emit at most one non-blocking
  console warning per page noting that annotations will not persist.
- **`localStorage` quota exceeded**: When saving a note would exceed the browser's
  storage quota, Grid-Sight MUST refuse the save, leave the popover open, and
  display an inline error in the popover ("Storage is full — delete an existing
  note to add a new one"). Existing annotations MUST NOT be dropped.
- **Cross-origin scope**: `localStorage` is per-origin, so the cross-document popup
  lists only annotations for the **current origin**. Annotations made on other
  origins are not visible and are out of scope for v1.
- **`data-gs-ignore` or `data-gs-no-annotate` opt-out**: A table or cell carrying
  either attribute MUST NOT show the annotate affordance, and any stored note
  targeting such a cell MUST be silently ignored.
- **Annotations on cells with `rowspan` / `colspan`**: A spanned cell MAY be
  annotated; the annotation attaches to the single source cell, not to each
  visually-covered grid position. The marker renders on the source cell only.
- **Multiple annotations on the same cell**: Only one note per cell is supported in
  v1. Re-saving replaces the existing note and updates its last-modified timestamp.
- **Disabling Grid-Sight while annotations are active**: Turning Grid-Sight off MUST
  hide all markers and affordances; turning it back on MUST re-apply the
  locally-stored annotations.
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
- **FR-009**: Saving a note MUST close the popover, render the marker, and write the
  note to local storage in a single user-visible step.

**Cell identity & integration**

- **FR-010**: Each annotation MUST be keyed by a `(table-key, row-key, column-key)`
  triple. `table-key` MUST prefer, in order: an explicit `data-gs-key`, the table
  `id`, the trimmed `caption` text, and finally the table's document-order index.
- **FR-011**: Annotations MUST follow their source cell across re-sorts, filters,
  and other Grid-Sight enrichments — identity MUST NOT depend on visual row
  position.
- **FR-012**: Tables and cells carrying `data-gs-ignore` or `data-gs-no-annotate`
  MUST NOT show the affordance, and stored notes targeting them MUST be silently
  dropped.
- **FR-013**: When a table lacks any stable identifier, Grid-Sight MUST fall back
  to an index-based key and emit at most one non-blocking console warning per
  page.

**Persistence**

- **FR-014**: The set of annotations for a document MUST be persisted to
  `localStorage`, keyed per document using the same per-URL-stem (`origin +
  pathname`) scheme and `gs:` key prefix as `src/utils/slider-persistence.ts`.
- **FR-015**: On page load, Grid-Sight MUST read the stored annotations for the
  current document and render markers before the user interacts with the page.
- **FR-016**: A stored annotation referring to a missing table, missing row, or
  missing column MUST be silently ignored without erroring, and the active set
  rendered from what remains.
- **FR-017**: When `localStorage` is unavailable, Grid-Sight MUST degrade to
  session-only (in-memory) annotations without throwing, emitting at most one
  console warning per page. When a save would exceed the storage quota, Grid-Sight
  MUST refuse the save, surface an inline error in the popover, and leave existing
  annotations untouched.
- **FR-018**: Each stored annotation MUST record a last-modified timestamp, set on
  every create or replace, for display in the cross-document popup.
- **FR-019**: Annotations MUST NOT be encoded in the URL fragment as a persistence
  channel. The URL fragment MAY carry only a **transient** cell-target hint used by
  the cross-document popup to scroll to a cell on load; that hint MUST be cleared
  after it is consumed and MUST NOT be relied on for persistence.

**Cross-document annotations popup**

- **FR-020**: A "Show annotations" entry MUST appear in the GS menu when at least
  one annotation exists in `localStorage` for the current origin; selecting it MUST
  open a popup listing every such annotation, grouped by document, with the
  document identifier (title or path), the column/cell context, the truncated note
  text, and the last-modified date.
- **FR-021**: Clicking an entry MUST take the user to the annotated cell: if the
  cell is on the current document, scroll it into view and highlight its marker for
  at least one animation frame; if it is on a different document of the same origin,
  navigate to that document and, on load, scroll the cell into view and pulse its
  marker.
- **FR-022**: The annotations popup MUST be keyboard-navigable: arrow keys move
  between entries, Enter activates the focused entry, and Escape closes the popup.

**Accessibility**

- **FR-023**: Each annotated cell MUST expose its note to assistive technology via
  `aria-describedby` pointing at a node containing the current note text.
- **FR-024**: The affordance, marker, popover controls, and popup entries MUST all
  be operable by keyboard alone (Enter / Space activates buttons).
- **FR-025**: Colour MUST NOT be the sole channel indicating an annotated cell —
  the corner triangle / pin glyph MUST be distinguishable in monochrome.

### Key Entities

- **Annotation**: A `(table-key, row-key, column-key, text, modified-at)` record
  where `text` is at most 280 characters and `modified-at` is the timestamp of the
  last create/replace. At most one annotation per cell.
- **Cell Identity Triple**: The persistence key for an annotation, derived from
  the source DOM at load time and stable across reorders.
- **Per-Document Annotation Set**: The serialisation of every active annotation on a
  document, written to a per-document `localStorage` key under the `gs:` prefix,
  wrapped in a versioned envelope.
- **Cross-Document Annotation Index**: The aggregate, built by scanning all
  `localStorage` annotation keys for the current origin, that backs the
  cross-document popup — an ordered list grouped by document, each entry holding
  enough context (document identifier, column/cell label, truncated text,
  last-modified date, and the cell target needed to navigate) to render and
  scroll-target a cell.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can attach a new note to a cell in **three interactions or
  fewer** from a Grid-Sight-enabled page (hover, click, type, Save counts as
  three discrete user actions plus typing).
- **SC-002**: Re-opening a document holding up to 50 annotations MUST render every
  marker within **one animation frame** of first paint on a mid-range laptop.
- **SC-003**: Annotations MUST survive a reload and a new browser session **100% of
  the time** via `localStorage`, with no network access on the persistence path.
- **SC-004**: Sorting, filtering, or otherwise reordering rows MUST keep every
  annotation on its original source cell in **100%** of cases (no visual drift).
- **SC-005**: The full feature (affordance, popover, marker, persistence,
  cross-document popup) MUST add no more than **2 KB gzipped** to the IIFE bundle,
  in line with the Lightweight & Minimal Dependencies constitutional principle.
- **SC-006**: From the cross-document popup, clicking any entry MUST land the user
  on the correct annotated cell **100%** of the time — scrolling in place for the
  current document, or navigating then scrolling for another document on the same
  origin.

## Assumptions

- Persistence is local to the browser: a per-document `localStorage` key under the
  `gs:` prefix, reusing the per-URL-stem (`origin + pathname`) derivation of
  `src/utils/slider-persistence.ts`. Annotations are NOT shared via URL in v1.
- A 280-character cap per note is a reasonable default. The cap is tunable in code
  but not exposed to end users in v1.
- One annotation per cell is sufficient for v1. Threaded comments, replies,
  attachments, and rich text are out of scope.
- Cell identity is derived from the load-time DOM. Annotations on tables whose
  rows are re-keyed by the host page on each load (e.g. server-rendered with
  rotating IDs) are out of scope; the index-based fallback MAY drift in that
  case and the console warning documents the risk.
- The cross-document popup is scoped to the current origin because `localStorage`
  is per-origin; cross-origin aggregation is out of scope for v1.
- The cross-document popup reuses the existing GS menu surface; no new top-level UI
  chrome is introduced.
- No new runtime dependency is introduced; the popover, marker, and popup are
  implemented with the platform DOM and the existing lozenge styling system in
  `src/ui/header-utils.ts`.
- Annotations are scoped to body cells only. Annotating header cells or
  `<caption>` is out of scope for v1.
- The URL fragment is used only as a transient scroll-to-cell hint when navigating
  from the popup, then cleared; it is not a persistence channel.
