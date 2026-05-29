import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeOutlierFragment,
  decodeOutlierFragment,
  readOutliersFromUrl,
  writeOutliersToUrl,
  persistOutliers,
  resolveInitialOutliers,
  type PersistedOutlierState,
} from '../outlier-persistence';
import type { OutlierThreshold } from '../../enrichments/outlier-marks';

function state(...tables: Array<[string, Array<[string, OutlierThreshold]>]>): PersistedOutlierState {
  return tables.map(([tableId, cols]) => ({ tableId, columns: new Map(cols) }));
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  history.replaceState(null, '', '/');
});

describe('encode/decode round-trip', () => {
  it('round-trips the schema example', () => {
    const s = state(
      ['sales', [['latency', 1], ['error-rate', 3]]],
      ['inventory', [['qty', 2]]],
    );
    const encoded = encodeOutlierFragment(s);
    expect(encoded).toBe('sales(latency:1;error-rate:3;),inventory(qty:2;)');
    const decoded = decodeOutlierFragment(encoded);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].tableId).toBe('sales');
    expect(Array.from(decoded[0].columns)).toEqual([['latency', 1], ['error-rate', 3]]);
    expect(Array.from(decoded[1].columns)).toEqual([['qty', 2]]);
  });

  it('empty state encodes to "" and decodes to []', () => {
    expect(encodeOutlierFragment([])).toBe('');
    expect(decodeOutlierFragment('')).toEqual([]);
  });
});

describe('decode robustness (FR-017)', () => {
  it('malformed input yields the empty state, never throws', () => {
    expect(() => decodeOutlierFragment('garbage((')).not.toThrow();
    expect(decodeOutlierFragment('garbage((')).toEqual([]);
    expect(decodeOutlierFragment(')(:;,')).toEqual([]);
  });

  it('skips out-of-range thresholds, keeping valid siblings', () => {
    const decoded = decodeOutlierFragment('sales(latency:5;qty:2;)');
    expect(decoded).toHaveLength(1);
    expect(Array.from(decoded[0].columns)).toEqual([['qty', 2]]);
  });

  it('skips colKeys not matching ^[a-z0-9-]+$', () => {
    const decoded = decodeOutlierFragment('sales(Bad Key:2;ok:1;)');
    expect(Array.from(decoded[0].columns)).toEqual([['ok', 1]]);
  });

  it('de-duplicates a repeated colKey, last wins', () => {
    const decoded = decodeOutlierFragment('sales(latency:1;latency:3;)');
    expect(Array.from(decoded[0].columns)).toEqual([['latency', 3]]);
  });
});

describe('URL write preserves other fragment params', () => {
  it('keeps gs.s and gs.v when writing gs.o', () => {
    const s = state(['sales', [['latency', 1]]]);
    const hash = writeOutliersToUrl(s, '#gs.s=axis-x:0.42&gs.v=sales(s:latency:asc)');
    expect(hash).toContain('gs.s=axis-x:0.42');
    expect(hash).toContain('gs.v=sales(s:latency:asc)');
    expect(hash).toContain('gs.o=sales(latency:1;)');
  });

  it('writing an empty state removes the gs.o segment but keeps the rest', () => {
    const hash = writeOutliersToUrl([], '#gs.o=sales(latency:1;)&gs.s=axis-x:0.4');
    expect(hash).toBe('#gs.s=axis-x:0.4');
  });

  it('readOutliersFromUrl decodes the gs.o segment from a hash', () => {
    const decoded = readOutliersFromUrl('#gs.v=x(s:a:asc)&gs.o=inventory(qty:2;)');
    expect(decoded).toHaveLength(1);
    expect(decoded[0].tableId).toBe('inventory');
  });
});

describe('persistOutliers / resolveInitialOutliers (SC-004)', () => {
  it('writes the URL and a localStorage mirror, and resolves URL-first', () => {
    const s = state(['sales', [['latency', 2]]]);
    persistOutliers(s);
    expect(location.hash).toContain('gs.o=sales(latency:2;)');

    const resolved = resolveInitialOutliers();
    expect(resolved).toHaveLength(1);
    expect(Array.from(resolved[0].columns)).toEqual([['latency', 2]]);
  });

  it('falls back to localStorage when the URL has no gs.o segment', () => {
    const s = state(['sales', [['qty', 3]]]);
    persistOutliers(s);
    // Strip the URL hash but keep the localStorage mirror.
    history.replaceState(null, '', '/');
    expect(location.hash).toBe('');
    const resolved = resolveInitialOutliers();
    expect(resolved).toHaveLength(1);
    expect(Array.from(resolved[0].columns)).toEqual([['qty', 3]]);
  });

  it('returns [] when neither URL nor localStorage has state', () => {
    expect(resolveInitialOutliers()).toEqual([]);
  });
});
