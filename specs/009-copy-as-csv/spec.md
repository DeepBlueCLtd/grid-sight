# Feature Specification: Copy Table As CSV / TSV / Markdown

**Feature Branch**: `009-copy-as-csv`
**Created**: 2026-05-18
**Updated**: 2026-06-01 (refreshed against current codebase: consumes the
`copy-as-csv-registry` shim + `VirtualColumnExport` exporters, the
`table-grid` addressing layer, and the URL view-state persistence mechanism)
**Status**: Draft — ready for planning
**Input**: User description: "A table-level lozenge that copies the currently
visible view of a table to the clipboard in CSV, TSV, or Markdown, with a small
options popup (include headers, include row headers, include GS virtual
columns) and a toast confirmation. Honors current sort/filter/visible rows,
RFC 4180 CSV, GFM Markdown tables, rowspan/colspan flattening, clipboard
failure fallback, aria-live toast, remembered format in URL. Consumes the
existing copy-as-csv-registry shim and virtual-column exporters."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-click copy of the current view as CSV (Priority: P1)

A user has sorted and filtered a table to the rows they care about and now wants to
paste those exact rows into a spreadsheet or chat. With Grid-Sight enabled, a
table-level lozenge (suggested label **⎘** or **CSV**) appears in the table's corner
cluster. Clicking the lozenge opens a small popup; the default format is CSV and the
default options are "include headers" on, "include row headers" on, "include GS
virtual columns" on. Pressing "Copy" places the current visible view on the
clipboard and a transient toast confirms "Copied 12 rows × 5 columns as CSV".

**Why this priority**: Getting the data *out* of a Grid-Sight-enriched view is the
most common follow-up to building the view in the first place. Without it, every
other enrichment leaves the user manually re-selecting cells.

**Independent Test**: Open a page with one table, apply a filter that hides half
the rows, click the copy lozenge, accept defaults, press "Copy". Paste into a
plain text editor and confirm only the visible rows appear, separated by commas,
with headers as the first line.

**Acceptance Scenarios**:

1. **Given** a table where rows 2 and 4 are filtered out, **When** the user opens
   the copy popup and presses "Copy" with CSV selected, **Then** the clipboard
   contains exactly the visible rows in their currently visible order, each cell
   serialised as a CSV field, with one header row at the top.
2. **Given** the table has an active cumulative column appended by Grid-Sight,
   **When** the user copies with "include GS virtual columns" on, **Then** the
   appended column is included in the output; **When** the option is off, **Then**
   it is omitted.
3. **Given** the copy succeeds, **When** the toast appears, **Then** it announces
   the row × column count of the copied output and disappears within five seconds.
4. **Given** the clipboard API is unavailable or permission is denied, **When**
   the user presses "Copy", **Then** the popup replaces its body with a textarea
   whose contents are pre-selected for manual `Ctrl+C` and the toast confirms the
   fallback path was taken.

---

### User Story 2 - Choose format, remember the choice (Priority: P2)

A user routinely pastes Grid-Sight output into a Markdown-based note system and
wants the popup to default to Markdown next time. The popup offers CSV, TSV, and
Markdown table formats. The most-recent choice is encoded into the URL fragment
using the established Grid-Sight URL view-state mechanism (the per-enrichment
persistence + `view-state-url` pattern most recently used by the outlier
enrichment in `src/utils/outlier-persistence.ts`), so reopening the popup on the
same page (or sharing the URL) restores the user's last format.

**Why this priority**: Format-stickiness is small but high-impact for repeat
users; it turns a three-click action into a two-click action on the second use.
It is strictly value-add once the basic copy works.

**Independent Test**: Open the popup, switch to Markdown, copy, close the popup.
Reload the page, open the popup again, and confirm Markdown is preselected.

**Acceptance Scenarios**:

1. **Given** a user picked Markdown the previous time they copied on this page,
   **When** they reopen the popup, **Then** Markdown is preselected.
2. **Given** the URL contains a stored format that the current build no longer
   supports, **When** the page is loaded, **Then** the popup falls back to CSV
   without error.

---

### Edge Cases

- **Clipboard permission denied or API unavailable**: Fall back to a textarea
  pre-selected for manual copy (see Acceptance Scenario 4 of User Story 1).
- **Merged cells (`rowspan` / `colspan`)**: Flatten by placing the source cell's
  value in the source position and emitting empty fields for every spanned
  position. Document this in the popup's "i" tooltip.
- **Very large tables**: No size cap is imposed by Grid-Sight. The browser's own
  clipboard size limit applies and any error surfaces via the textarea fallback.
- **Tables or rows marked `data-gs-no-export`**: A table with this attribute MUST
  NOT show the copy lozenge. A row with this attribute MUST be omitted from the
  export even if it is currently visible.
- **Sparkline column**: When "include GS virtual columns" is on, the sparkline
  column MUST be emitted as the underlying numeric series joined by `|`
  (e.g. `1|3|2|5`); it MUST NOT be emitted as SVG markup.
- **Markdown output with pipe characters in cell values**: Pipes MUST be escaped
  as `\|`. Newlines inside cells MUST be replaced with a single space in
  Markdown output.
- **CSV / TSV cell containing the delimiter, a quote, or a newline**: Standard
  RFC 4180 quoting MUST apply (wrap in double quotes, double any internal
  quotes).
- **Empty visible view**: The output MUST still include the header row (if
  "include headers" is on) and the toast MUST report "0 rows × N columns".

## Requirements *(mandatory)*

### Functional Requirements

**Affordance**

- **FR-001**: Grid-Sight MUST add a copy lozenge (visible label "⎘" or "CSV") to
  every qualifying table's corner cluster when Grid-Sight is enabled.
- **FR-002**: A table MUST qualify for the copy lozenge unless it is marked with
  `data-gs-ignore` or `data-gs-no-export`.

**Popup**

- **FR-003**: Activating the lozenge MUST open a modal popup that contains:
  format radios (CSV, TSV, Markdown), three checkboxes (include headers,
  include row headers, include GS virtual columns), a primary "Copy" button,
  and a "Close" affordance.
- **FR-004**: The popup MUST be a proper dialog with focus trapped inside it
  while open, MUST restore focus to the lozenge on close, and MUST close on
  `Esc`.
- **FR-005**: The popup MUST present a brief explanatory note describing what
  "current visible view" means (rows after sort and filter, plus any GS-appended
  virtual columns when the option is on).

**Output content**

- **FR-006**: The output MUST include exactly the rows currently visible in the
  table's `tbody`, in their currently visible order, after any active sort and
  filter.
- **FR-007**: Row-headers (cells with `scope="row"` or in a header column) MUST
  be included as the first field of each row when "include row headers" is on,
  and omitted otherwise.
- **FR-008**: When "include GS virtual columns" is on, every GS-appended column
  (e.g. cumulative, compare, sparkline) MUST be included at its rendered
  position. Its header text and per-row cell text MUST be obtained from the
  exporters registered in the existing `copy-as-csv-registry` shim
  (`VirtualColumnExport.headerText` and `getCellText(rowEl)`) rather than by
  re-reading rendered DOM, so that e.g. the sparkline column exports its raw
  underlying numeric series (per Edge Cases) rather than SVG markup. When the
  option is off, no registered virtual column appears in the output.
- **FR-009**: Cells marked or spanned by `rowspan` / `colspan` MUST be flattened
  per Edge Cases. The visible-row set, currently-visible column order, and
  logical cell text MUST be resolved through the canonical `table-grid`
  addressing layer (`src/core/table-grid.ts`, spec 013) so the export agrees
  with what every other enrichment considers a cell, rather than via ad-hoc
  `nth-child` DOM walks.

**Output formats**

- **FR-010**: CSV output MUST conform to RFC 4180 (comma delimiter, CRLF line
  endings, double-quote wrapping when a field contains a comma, quote, or
  newline, internal quotes doubled).
- **FR-011**: TSV output MUST use the tab character as delimiter, LF line
  endings, no quoting; any tab or newline inside a cell MUST be replaced with a
  single space.
- **FR-012**: Markdown output MUST emit a GitHub-flavoured table (header row,
  separator row with column alignment derived from column data type when
  detectable, pipe-delimited body rows), with `|` escaped as `\|` and intra-cell
  newlines replaced by a space.

**Clipboard and fallback**

- **FR-013**: "Copy" MUST attempt to write the serialised output to the system
  clipboard using the asynchronous clipboard interface available in the page.
- **FR-014**: On a thrown error, denied permission, or absent clipboard API,
  the popup MUST replace its body with a read-only-feeling textarea whose
  contents are the serialised output and whose text is fully selected for
  manual copy.

**Feedback**

- **FR-015**: On successful clipboard write, a transient toast MUST announce
  the row × column count and the format (e.g. "Copied 12 rows × 5 columns as
  CSV") and MUST disappear automatically after at most five seconds.
- **FR-016**: The toast MUST be announced via `aria-live="polite"`.

**Persistence**

- **FR-017**: The most-recently chosen format MUST be encoded into the URL
  fragment using the established Grid-Sight URL view-state mechanism (a
  per-enrichment persistence module riding `src/utils/view-state-url.ts`, as
  most recently exemplified by `src/utils/outlier-persistence.ts`).
- **FR-018**: The three boolean options (include headers, include row headers,
  include GS virtual columns) MUST also persist alongside the format choice,
  using the same per-page scheme, so that reopening the popup on the same page
  (or sharing the URL) restores the user's last full configuration. Initial
  defaults remain "on" for all three when no persisted value exists.
- **FR-019**: A persisted format value that the current build no longer
  supports MUST fall back to CSV silently. A persisted checkbox value that
  cannot be parsed MUST fall back to its "on" default silently.

**Accessibility**

- **FR-020**: The copy lozenge MUST be keyboard-operable (Enter / Space).
- **FR-021**: The popup MUST conform to a single dialog role with a labelled
  title, focus trap, and Esc-to-close.
- **FR-022**: The toast MUST not steal focus and MUST be readable by assistive
  technology via an `aria-live` region.

**Integration**

- **FR-023**: The copy lozenge MUST live in the table's corner cluster defined
  by `src/ui/header-utils.ts`, alongside other table-level lozenges.
- **FR-024**: A `data-gs-no-export` attribute on a row MUST cause that row to
  be omitted from the output even if it is currently visible.
- **FR-025**: Toggling Grid-Sight off MUST remove the copy lozenge and any open
  popup or toast.

### Key Entities

- **Copy Directive**: A `(table, format, options)` snapshot describing how to
  serialise the current visible view. Only one directive per table is active at
  a time (the one currently presented in the popup).
- **Visible View Snapshot**: The ordered list of visible rows × visible columns
  (including any GS-appended virtual columns when requested), captured at the
  moment "Copy" is pressed.
- **Persisted Format State**: A serialisation of the user's last format choice
  *and* the three boolean option values per page, written to the URL fragment.
- **Toast Notification**: A short-lived `aria-live` element communicating the
  outcome of a copy attempt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can copy the current view to the clipboard in **two clicks
  or fewer** (open popup, press Copy) from a Grid-Sight-enabled page.
- **SC-002**: For tables up to 1 000 visible rows × 20 columns, serialisation
  and clipboard write MUST complete in **under 200 ms** on a mid-range laptop.
- **SC-003**: The clipboard fallback path (textarea pre-selected for manual
  copy) MUST succeed on **100% of supported browsers** when the asynchronous
  clipboard interface is unavailable.
- **SC-004**: A persisted format choice MUST reproduce from URL alone on
  another machine **100% of the time** with no `localStorage` dependency.
- **SC-005**: The toast confirmation MUST appear within **one animation frame**
  of a successful clipboard write.

## Assumptions

- The established Grid-Sight URL view-state persistence mechanism
  (`src/utils/view-state-url.ts` plus a per-enrichment persistence module, as
  done for sliders and most recently the outlier feature) is reused; this
  feature adds its own small persistence module following that pattern rather
  than inventing a new scheme.
- The `copy-as-csv-registry` shim (`src/utils/copy-as-csv-registry.ts`,
  introduced by spec 012) already exists and is populated by each virtual-column
  enrichment with a `VirtualColumnExport` (`headerText` + `getCellText(rowEl)`).
  This feature consumes that registry as-is; virtual-column enrichments remain
  responsible for registering/unregistering their own exporters.
- The `table-grid` addressing layer (spec 013) is the source of truth for the
  visible-row set, visible-column order, and logical cell text; the export does
  not re-implement coordinate/visibility logic.
- Pages embedding Grid-Sight serve content over a secure context (file://,
  https://, or localhost) sufficient for the asynchronous clipboard interface
  on supported browsers; insecure contexts fall back to the textarea path.
- The sparkline enrichment's registered exporter yields the underlying numeric
  series of its virtual column, so the copy feature never re-parses SVG.
- No new runtime dependency is introduced; serialisation uses platform string
  handling.
- Sparkline-as-numeric-series is the chosen export representation; embedding
  the SVG markup is explicitly out of scope for v1.
- "Current visible view" excludes rows hidden via CSS by the host page only
  when those rows are also marked invisible to the existing filter enrichment;
  Grid-Sight does not introspect arbitrary host CSS.
