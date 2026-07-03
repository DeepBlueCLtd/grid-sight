import { describe, it, expect } from 'vitest';
import { deriveSyncKey, headersMatch, parseHeaderNumber } from '../sync-key';

describe('parseHeaderNumber', () => {
  it('parses plain numbers', () => {
    expect(parseHeaderNumber('1000')).toBe(1000);
    expect(parseHeaderNumber('-3.14')).toBe(-3.14);
  });

  it('canonicalises common numeric forms', () => {
    expect(parseHeaderNumber('1,000')).toBe(1000);
    expect(parseHeaderNumber('1.0e3')).toBe(1000);
  });

  it('strips trailing unit suffixes', () => {
    expect(parseHeaderNumber('1000 m')).toBe(1000);
    expect(parseHeaderNumber('25kg')).toBe(25);
  });

  it('ignores trailing note annotations after a unit-suffixed value', () => {
    // Real-world speed axis: "1kt", "2kt", … "120kt (Note 1)", "121kt (Note 2)".
    // Only the leading numeric prefix is significant; unit + parenthetical note are discarded.
    expect(parseHeaderNumber('3kt')).toBe(3);
    expect(parseHeaderNumber('120kt (Note 1)')).toBe(120);
    expect(parseHeaderNumber('121kt (Note 2)')).toBe(121);
  });

  it('returns null when text precedes the number', () => {
    // The numeric run must be anchored at the start of the cell — a leading note
    // (rather than a trailing one) disqualifies the header.
    expect(parseHeaderNumber('Note 1: 120kt')).toBeNull();
    expect(parseHeaderNumber('~120kt')).toBeNull();
  });

  it('returns null for non-numeric headers', () => {
    expect(parseHeaderNumber('alpha')).toBeNull();
    expect(parseHeaderNumber('')).toBeNull();
  });
});

describe('deriveSyncKey', () => {
  it('returns identical keys for identical numeric headers', () => {
    expect(deriveSyncKey(['10', '20', '30'])).toBe(deriveSyncKey(['10', '20', '30']));
  });

  it('canonicalises across number formats', () => {
    expect(deriveSyncKey(['1000', '2000'])).toBe(deriveSyncKey(['1,000', '2,000']));
    expect(deriveSyncKey(['1000', '2000'])).toBe(deriveSyncKey(['1.0e3', '2.0e3']));
  });

  it('returns null when any header is non-numeric', () => {
    expect(deriveSyncKey(['10', 'twenty', '30'])).toBeNull();
  });

  it('accepts a speed axis whose headers carry unit suffixes and note annotations', () => {
    // Whole axis must parse for the table to qualify for interpolation.
    const speedHeaders = ['1kt', '2kt', '3kt', '120kt (Note 1)', '121kt (Note 2)'];
    expect(deriveSyncKey(speedHeaders)).not.toBeNull();
    // Note text is irrelevant to the derived key: annotated headers sync with plain ones.
    expect(deriveSyncKey(speedHeaders)).toBe(deriveSyncKey(['1', '2', '3', '120', '121']));
  });

  it('returns null for degenerate (single-value) axes', () => {
    expect(deriveSyncKey(['10'])).toBeNull();
  });
});

describe('headersMatch', () => {
  it('detects matching axes', () => {
    expect(headersMatch(['1000', '2000', '3000'], ['1,000', '2,000', '3,000'])).toBe(true);
  });

  it('detects mismatched axes', () => {
    expect(headersMatch(['10', '20'], ['10', '30'])).toBe(false);
  });

  it('rejects non-numeric headers entirely', () => {
    expect(headersMatch(['10', 'x'], ['10', 'x'])).toBe(false);
  });
});
