import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readDocumentAnnotations,
  writeDocumentAnnotations,
  isStorageAvailable,
} from '../annotation-persistence';
import { storageKeyFor } from '../../utils/slider-persistence';
import type { CellIdentity } from '../annotation-identity';

const KEY = storageKeyFor('annotations');

function id(tableKey: string, rowKey: string, columnKey: string): CellIdentity {
  return { tableKey, rowKey, columnKey };
}

beforeEach(() => {
  localStorage.clear();
});

describe('round-trip (U1)', () => {
  it('read(write(store)) reproduces text + modifiedAt', () => {
    const entries = [
      { id: id('sales', 'acme', 'q3'), text: 'check with finance', modifiedAt: 1769414400000 },
      { id: id('sales', 'globex', 'q3'), text: 'verify', modifiedAt: 1769410800000 },
    ];
    expect(writeDocumentAnnotations(entries)).toEqual({ ok: true });
    const read = readDocumentAnnotations();
    expect(read).toHaveLength(2);
    expect(read).toEqual(expect.arrayContaining(entries));
  });
});

describe('read rules (U2)', () => {
  it('version !== 1 yields empty set', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 2, entries: { 'a/b/c': { t: 'x', m: 1 } } }));
    expect(readDocumentAnnotations()).toEqual([]);
  });
  it('malformed JSON yields empty set, no throw', () => {
    localStorage.setItem(KEY, '{not json');
    expect(readDocumentAnnotations()).toEqual([]);
  });
  it('skips malformed entries (bad key, non-string text)', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        entries: {
          'a/b/c': { t: 'ok', m: 5 },
          'bad key': { t: 'x', m: 1 },
          'd/e/f': { t: 123, m: 1 },
        },
      })
    );
    const read = readDocumentAnnotations();
    expect(read).toHaveLength(1);
    expect(read[0].id).toEqual(id('a', 'b', 'c'));
  });
  it('defaults modifiedAt to a number when absent', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, entries: { 'a/b/c': { t: 'x' } } }));
    const read = readDocumentAnnotations();
    expect(typeof read[0].modifiedAt).toBe('number');
  });
});

describe('write rules', () => {
  it('clamps text to 280 chars', () => {
    const long = 'x'.repeat(400);
    writeDocumentAnnotations([{ id: id('a', 'b', 'c'), text: long, modifiedAt: 1 }]);
    expect(readDocumentAnnotations()[0].text).toHaveLength(280);
  });

  it('empty store removes the key (U7)', () => {
    writeDocumentAnnotations([{ id: id('a', 'b', 'c'), text: 'x', modifiedAt: 1 }]);
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(writeDocumentAnnotations([])).toEqual({ ok: true });
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('quota refuse (U5)', () => {
  let setItem: ReturnType<typeof vi.spyOn>;
  afterEach(() => setItem?.mockRestore());

  it('refuses when setItem throws quota; prior value retained', () => {
    writeDocumentAnnotations([{ id: id('a', 'b', 'c'), text: 'prior', modifiedAt: 1 }]);
    const before = localStorage.getItem(KEY);
    setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const result = writeDocumentAnnotations([
      { id: id('a', 'b', 'c'), text: 'prior', modifiedAt: 1 },
      { id: id('d', 'e', 'f'), text: 'new', modifiedAt: 2 },
    ]);
    expect(result).toEqual({ ok: false, reason: 'quota' });
    setItem.mockRestore();
    expect(localStorage.getItem(KEY)).toBe(before);
  });
});

describe('isStorageAvailable (U6)', () => {
  it('true in jsdom', () => {
    expect(isStorageAvailable()).toBe(true);
  });
  it('false when storage access throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isStorageAvailable()).toBe(false);
    spy.mockRestore();
  });
});
