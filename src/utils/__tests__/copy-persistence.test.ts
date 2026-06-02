import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeCopyFragment,
  decodeCopyFragment,
  readCopyFromUrl,
  writeCopyToUrl,
  persistCopyConfig,
  resolveInitialCopyConfig,
  DEFAULT_COPY_OPTIONS,
  type CopyOptions,
} from '../copy-persistence';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  history.replaceState(null, '', '/');
});

const cfg = (over: Partial<CopyOptions> = {}): CopyOptions => ({
  ...DEFAULT_COPY_OPTIONS,
  ...over,
});

describe('encode/decode round-trip', () => {
  it('round-trips every format and boolean combination', () => {
    const samples: CopyOptions[] = [
      cfg(),
      cfg({ format: 'tsv', headers: false }),
      cfg({ format: 'md', rowHeaders: false, virtualCols: false }),
    ];
    for (const s of samples) {
      expect(decodeCopyFragment(encodeCopyFragment(s))).toEqual(s);
    }
  });

  it('uses the compact grammar', () => {
    expect(encodeCopyFragment(cfg())).toBe('fmt:csv;h:1;rh:1;vc:1');
    expect(encodeCopyFragment(cfg({ format: 'md', headers: false }))).toBe(
      'fmt:md;h:0;rh:1;vc:1',
    );
  });
});

describe('malformed-tolerant decode (FR-019)', () => {
  it('falls back to CSV for an unknown format', () => {
    expect(decodeCopyFragment('fmt:xlsx;h:1;rh:1;vc:1').format).toBe('csv');
  });

  it('falls back to true for an unparseable boolean', () => {
    const d = decodeCopyFragment('fmt:tsv;h:maybe;rh:;vc:2');
    expect(d.headers).toBe(true);
    expect(d.rowHeaders).toBe(true);
    expect(d.virtualCols).toBe(true);
  });

  it('returns defaults for empty/garbage input without throwing', () => {
    expect(decodeCopyFragment('')).toEqual(DEFAULT_COPY_OPTIONS);
    expect(decodeCopyFragment('@@@')).toEqual(DEFAULT_COPY_OPTIONS);
  });
});

describe('URL fragment helpers', () => {
  it('writes gs.cp while preserving other params', () => {
    const hash = writeCopyToUrl(cfg({ format: 'md' }), '#gs.v=foo&gs.s=bar');
    expect(hash).toContain('gs.v=foo');
    expect(hash).toContain('gs.s=bar');
    expect(hash).toContain('gs.cp=fmt:md;h:1;rh:1;vc:1');
  });

  it('reads gs.cp back from a hash', () => {
    const got = readCopyFromUrl('#gs.cp=fmt:tsv;h:0;rh:1;vc:0');
    expect(got).toEqual(cfg({ format: 'tsv', headers: false, virtualCols: false }));
  });

  it('returns undefined when gs.cp is absent', () => {
    expect(readCopyFromUrl('#gs.v=foo')).toBeUndefined();
  });
});

describe('resolve priority + reproduction (SC-004)', () => {
  it('reproduces a persisted config from URL alone with no localStorage', () => {
    history.replaceState(null, '', '/#gs.cp=fmt:md;h:1;rh:0;vc:1');
    localStorage.clear();
    expect(resolveInitialCopyConfig()).toEqual(cfg({ format: 'md', rowHeaders: false }));
  });

  it('prefers URL over storage over defaults', () => {
    // storage only
    persistCopyConfig(cfg({ format: 'tsv' }));
    history.replaceState(null, '', '/'); // drop the URL the persist wrote
    expect(resolveInitialCopyConfig().format).toBe('tsv');
    // URL wins over storage
    history.replaceState(null, '', '/#gs.cp=fmt:md;h:1;rh:1;vc:1');
    expect(resolveInitialCopyConfig().format).toBe('md');
  });

  it('falls back to defaults when nothing is persisted', () => {
    expect(resolveInitialCopyConfig()).toEqual(DEFAULT_COPY_OPTIONS);
  });
});
