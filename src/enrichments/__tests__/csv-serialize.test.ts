import { describe, it, expect } from 'vitest';
import { toCsv, toTsv, toMarkdown, type ColumnAlign } from '../csv-serialize';

describe('toCsv (RFC 4180)', () => {
  it('joins fields with commas and rows with CRLF, header first', () => {
    const out = toCsv(['A', 'B'], [
      ['1', '2'],
      ['3', '4'],
    ]);
    expect(out).toBe('A,B\r\n1,2\r\n3,4');
  });

  it('omits the header row when header is null', () => {
    expect(toCsv(null, [['1', '2']])).toBe('1,2');
  });

  it('quotes fields containing comma, quote, CR, or LF and doubles quotes', () => {
    expect(toCsv(null, [['a,b']])).toBe('"a,b"');
    expect(toCsv(null, [['say "hi"']])).toBe('"say ""hi"""');
    expect(toCsv(null, [['line1\nline2']])).toBe('"line1\nline2"');
    expect(toCsv(null, [['has\rcr']])).toBe('"has\rcr"');
  });

  it('leaves plain fields unquoted', () => {
    expect(toCsv(null, [['plain', '42', 'a b']])).toBe('plain,42,a b');
  });

  it('emits a header-only document for an empty body', () => {
    expect(toCsv(['A', 'B'], [])).toBe('A,B');
  });
});

describe('toTsv', () => {
  it('uses tab delimiter and LF line endings, no quoting', () => {
    const out = toTsv(['A', 'B'], [['1', '2']]);
    expect(out).toBe('A\tB\n1\t2');
  });

  it('replaces embedded tab/CR/LF with a single space', () => {
    expect(toTsv(null, [['a\tb']])).toBe('a b');
    expect(toTsv(null, [['line1\nline2']])).toBe('line1 line2');
    expect(toTsv(null, [['x\r\ny']])).toBe('x y');
  });

  it('omits the header row when header is null', () => {
    expect(toTsv(null, [['1', '2']])).toBe('1\t2');
  });
});

describe('toMarkdown (GFM)', () => {
  const aligns: ColumnAlign[] = ['left', 'right'];

  it('emits a header row, separator with alignment, and body rows', () => {
    const out = toMarkdown(['Name', 'Qty'], [['apple', '3']], aligns);
    expect(out).toBe(
      '| Name | Qty |\n| --- | ---: |\n| apple | 3 |',
    );
  });

  it('escapes pipes and collapses intra-cell newlines to spaces', () => {
    const out = toMarkdown(['A'], [['a|b'], ['c\nd']], ['left']);
    expect(out).toContain('| a\\|b |');
    expect(out).toContain('| c d |');
  });

  it('right-aligns via a trailing colon and left has none', () => {
    const out = toMarkdown(['L', 'R'], [], ['left', 'right']);
    const sep = out.split('\n')[1];
    expect(sep).toBe('| --- | ---: |');
  });

  it('emits blank header cells (still valid GFM) when header is null', () => {
    const out = toMarkdown(null, [['1', '2']], ['right', 'right']);
    const lines = out.split('\n');
    expect(lines[0]).toBe('|  |  |');
    expect(lines[1]).toBe('| ---: | ---: |');
    expect(lines[2]).toBe('| 1 | 2 |');
  });
});
