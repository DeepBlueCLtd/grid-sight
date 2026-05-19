/**
 * spec 012 — enrichments persistence (gs.e + entries: string[]).
 *
 * The slider-persistence module exposes a generic helper pair for the
 * enrichments list. This file covers the new URL + localStorage round-trips
 * without disturbing the slider call sites.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  readEnrichmentsFromUrl,
  writeEnrichmentsToUrl,
  readEnrichmentsFromStorage,
  writeEnrichmentsToStorage,
  resolveVisitorEnrichments,
  persistVisitorEnrichments,
} from '../slider-persistence';

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', location.pathname);
});

describe('URL fragment round-trip', () => {
  it('round-trips ids alphabetically', () => {
    const hash = writeEnrichmentsToUrl(['sliders', 'heatmap'], '');
    expect(hash).toContain('gs.e=heatmap,sliders');
    expect(readEnrichmentsFromUrl(hash)).toEqual(['heatmap', 'sliders']);
  });

  it('returns undefined when no gs.e segment present', () => {
    expect(readEnrichmentsFromUrl('')).toBeUndefined();
    expect(readEnrichmentsFromUrl('#gs.s=foo:0.5')).toBeUndefined();
  });

  it('returns empty array when gs.e is present-but-empty', () => {
    // writeEnrichmentsToUrl with [] removes the segment, so we synthesise.
    expect(readEnrichmentsFromUrl('#gs.e=')).toEqual([]);
  });

  it('drops malformed ids and dedupes', () => {
    expect(readEnrichmentsFromUrl('#gs.e=heatmap,HEATMAP,not_a_thing!,sliders')).toEqual([
      'heatmap', 'sliders',
    ]);
  });

  it('coexists with gs.s fragment', () => {
    const hash = writeEnrichmentsToUrl(['heatmap'], '#gs.s=tbl1:0.5');
    expect(hash).toContain('gs.s=tbl1:0.5');
    expect(hash).toContain('gs.e=heatmap');
  });
});

describe('localStorage round-trip', () => {
  it('writes versioned wrapper with entries:string[]', () => {
    writeEnrichmentsToStorage(['sliders', 'heatmap']);
    const stem = location.origin + location.pathname;
    const raw = localStorage.getItem(`gs:${stem}:enrichments`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.version).toBe(1);
    expect(parsed.entries).toEqual(['heatmap', 'sliders']);
  });

  it('round-trips', () => {
    writeEnrichmentsToStorage(['heatmap', 'sliders']);
    expect(readEnrichmentsFromStorage()).toEqual(['heatmap', 'sliders']);
  });

  it('returns undefined when key absent', () => {
    expect(readEnrichmentsFromStorage()).toBeUndefined();
  });

  it('empty array removes the key', () => {
    writeEnrichmentsToStorage(['heatmap']);
    expect(readEnrichmentsFromStorage()).toBeDefined();
    writeEnrichmentsToStorage([]);
    expect(readEnrichmentsFromStorage()).toBeUndefined();
  });

  it('version mismatch falls back to undefined', () => {
    const stem = location.origin + location.pathname;
    localStorage.setItem(
      `gs:${stem}:enrichments`,
      JSON.stringify({ version: 999, entries: ['heatmap'] })
    );
    expect(readEnrichmentsFromStorage()).toBeUndefined();
  });

  it('malformed JSON falls back to undefined', () => {
    const stem = location.origin + location.pathname;
    localStorage.setItem(`gs:${stem}:enrichments`, '{not valid');
    expect(readEnrichmentsFromStorage()).toBeUndefined();
  });
});

describe('resolveVisitorEnrichments precedence', () => {
  it('URL fragment wins over localStorage', () => {
    writeEnrichmentsToStorage(['statistics']);
    history.replaceState(null, '', location.pathname + '#gs.e=heatmap');
    expect(Array.from(resolveVisitorEnrichments() as Set<string>)).toEqual(['heatmap']);
  });

  it('falls back to localStorage when URL absent', () => {
    writeEnrichmentsToStorage(['heatmap']);
    const out = resolveVisitorEnrichments();
    expect(out).toBeDefined();
    expect(Array.from(out as Set<string>)).toEqual(['heatmap']);
  });

  it('returns undefined when neither source is set', () => {
    expect(resolveVisitorEnrichments()).toBeUndefined();
  });
});

describe('persistVisitorEnrichments', () => {
  it('writes to URL and storage', () => {
    persistVisitorEnrichments(['heatmap', 'sliders']);
    expect(location.hash).toContain('gs.e=heatmap,sliders');
    expect(readEnrichmentsFromStorage()).toEqual(['heatmap', 'sliders']);
  });

  it('empty list clears both surfaces', () => {
    persistVisitorEnrichments(['heatmap']);
    persistVisitorEnrichments([]);
    expect(location.hash).not.toContain('gs.e');
    expect(readEnrichmentsFromStorage()).toBeUndefined();
  });
});
