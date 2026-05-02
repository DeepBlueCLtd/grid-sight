import { describe, it, expect, beforeEach } from 'vitest';
import {
  decodeFragment,
  encodeFragment,
  readFromUrl,
  writeUrlHash,
  resolveInitialPosition,
  persistPosition,
  pruneEntry,
  readFromStorage,
  writeToStorage,
} from '../slider-persistence';

describe('encode/decode fragment', () => {
  it('round-trips entries', () => {
    const entries = { 'tbl#row': 0.42857, 'tbl#col': 0.1 };
    const encoded = encodeFragment(entries);
    const decoded = decodeFragment(encoded);
    expect(decoded['tbl#row']).toBeCloseTo(0.42857, 5);
    expect(decoded['tbl#col']).toBeCloseTo(0.1, 5);
  });

  it('ignores malformed entries', () => {
    expect(decodeFragment('garbage')).toEqual({});
    expect(decodeFragment('id:abc')).toEqual({});
    expect(decodeFragment('')).toEqual({});
  });

  it('clamps positions to 0..1', () => {
    expect(decodeFragment('a:1.5,b:-0.2').a).toBe(1);
    expect(decodeFragment('a:1.5,b:-0.2').b).toBe(0);
  });
});

describe('readFromUrl', () => {
  it('extracts gs.s from a hash', () => {
    expect(readFromUrl('#gs.s=tbl%23row:0.5')['tbl#row']).toBe(0.5);
  });

  it('returns empty for missing fragment', () => {
    expect(readFromUrl('')).toEqual({});
    expect(readFromUrl('#other=value')).toEqual({});
  });
});

describe('writeUrlHash', () => {
  it('preserves unrelated fragment params', () => {
    const out = writeUrlHash({ a: 0.5 }, '#other=value');
    expect(out).toContain('other=value');
    expect(out).toContain('gs.s=a:0.5');
  });

  it('returns empty hash when entries are pruned', () => {
    expect(writeUrlHash({}, '')).toBe('');
  });
});

describe('localStorage round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes and reads', () => {
    writeToStorage({ a: 0.42857 });
    const read = readFromStorage();
    expect(read.a).toBeCloseTo(0.42857, 5);
  });

  it('removes the key when entries are empty', () => {
    writeToStorage({ a: 0.5 });
    expect(readFromStorage().a).toBe(0.5);
    writeToStorage({});
    expect(readFromStorage()).toEqual({});
  });

  it('returns empty on malformed JSON', () => {
    const stem = (typeof location !== 'undefined' ? location.origin + location.pathname : 'default');
    localStorage.setItem(`gs:${stem}:sliders`, '{not json');
    expect(readFromStorage()).toEqual({});
  });
});

describe('resolveInitialPosition', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', location.pathname);
  });

  it('falls back to 0.5 midpoint when nothing is stored', () => {
    expect(resolveInitialPosition('some-id')).toBe(0.5);
  });

  it('reads from URL fragment first', () => {
    history.replaceState(null, '', location.pathname + '#gs.s=tbl1:0.25');
    expect(resolveInitialPosition('tbl1')).toBeCloseTo(0.25, 5);
  });

  it('falls back to localStorage when URL is missing', () => {
    writeToStorage({ tbl2: 0.75 });
    expect(resolveInitialPosition('tbl2')).toBeCloseTo(0.75, 5);
  });
});

describe('persistPosition / pruneEntry', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', location.pathname);
  });

  it('writes to URL and localStorage', () => {
    persistPosition('idA', 0.4);
    expect(location.hash).toContain('gs.s=idA:0.4');
    expect(readFromStorage().idA).toBeCloseTo(0.4, 5);
  });

  it('prunes from both surfaces', () => {
    persistPosition('idA', 0.4);
    pruneEntry('idA');
    expect(location.hash).not.toContain('idA');
    expect(readFromStorage().idA).toBeUndefined();
  });
});
