/**
 * Pure, DOM-free serialisers for the Copy-as-CSV feature (spec 009, FR-010/011/
 * 012). Each takes an already-resolved rectangular grid of cell strings plus an
 * optional header row and returns a single serialised string. No clipboard, no
 * DOM, no globals — directly unit-testable against RFC 4180 / GFM vectors.
 */

/** A rectangular grid of resolved cell strings (no header row). */
export type Matrix = ReadonlyArray<ReadonlyArray<string>>;

export type ColumnAlign = 'left' | 'right';

/* ── CSV (RFC 4180) ─────────────────────────────────────────────────── */

const CSV_NEEDS_QUOTE = /[",\r\n]/;

function csvField(value: string): string {
  if (!CSV_NEEDS_QUOTE.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** RFC 4180: comma delimiter, CRLF line endings, double-quote wrapping when a
 *  field contains a comma, quote, CR, or LF; internal quotes doubled. A null
 *  header omits the header row. */
export function toCsv(header: readonly string[] | null, body: Matrix): string {
  const lines: string[] = [];
  if (header) lines.push(header.map(csvField).join(','));
  for (const row of body) lines.push(row.map(csvField).join(','));
  return lines.join('\r\n');
}

/* ── TSV ────────────────────────────────────────────────────────────── */

function tsvField(value: string): string {
  // No quoting in TSV: collapse any tab/CR/LF inside a cell to a single space.
  return value.replace(/[\t\r\n]+/g, ' ');
}

/** Tab delimiter, LF line endings, no quoting. A null header omits the header
 *  row. */
export function toTsv(header: readonly string[] | null, body: Matrix): string {
  const lines: string[] = [];
  if (header) lines.push(header.map(tsvField).join('\t'));
  for (const row of body) lines.push(row.map(tsvField).join('\t'));
  return lines.join('\n');
}

/* ── Markdown (GitHub-flavoured) ────────────────────────────────────── */

function mdField(value: string): string {
  // Escape pipes; intra-cell newlines/tabs become a single space.
  return value.replace(/\|/g, '\\|').replace(/[\t\r\n]+/g, ' ');
}

function alignmentMarker(align: ColumnAlign): string {
  // GFM separator cell. Right-aligned columns use a trailing colon.
  return align === 'right' ? '---:' : '---';
}

/** GitHub-flavoured Markdown table. `|` escaped as `\|`, intra-cell newlines
 *  replaced with a space, alignment from `aligns` (numeric → right). GFM
 *  structurally requires a header row, so a null header emits blank header
 *  cells rather than an invalid table. */
export function toMarkdown(
  header: readonly string[] | null,
  body: Matrix,
  aligns: readonly ColumnAlign[],
): string {
  const colCount =
    (header?.length ?? 0) ||
    body.reduce((max, row) => Math.max(max, row.length), 0) ||
    aligns.length;
  const headerCells = header ?? new Array<string>(colCount).fill('');
  const lines: string[] = [];
  lines.push('| ' + headerCells.map(mdField).join(' | ') + ' |');
  const sep: string[] = [];
  for (let i = 0; i < colCount; i++) sep.push(alignmentMarker(aligns[i] ?? 'left'));
  lines.push('| ' + sep.join(' | ') + ' |');
  for (const row of body) {
    const cells: string[] = [];
    for (let i = 0; i < colCount; i++) cells.push(mdField(row[i] ?? ''));
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  return lines.join('\n');
}
