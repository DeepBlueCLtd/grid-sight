import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parsePageConfig } from '../page-config';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('parsePageConfig — happy path', () => {
  it('absent config returns defaults', () => {
    const r = parsePageConfig(undefined);
    expect(r.enrichments).toBeUndefined();
    expect(r.showToggleUi).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('null config returns defaults silently', () => {
    const r = parsePageConfig(null);
    expect(r.enrichments).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('normalises string entries to lowercase + trimmed', () => {
    const r = parsePageConfig({ enrichments: ['  Heatmap  ', 'SLIDERS', 'Statistics'] });
    expect(r.enrichments).toEqual(new Set(['heatmap', 'sliders', 'statistics']));
  });

  it('dedupes case-insensitively', () => {
    const r = parsePageConfig({ enrichments: ['heatmap', 'HEATMAP', 'Heatmap'] });
    expect(r.enrichments?.size).toBe(1);
    expect(r.enrichments?.has('heatmap')).toBe(true);
  });

  it('honours empty array as "no enrichments" (distinct from absent)', () => {
    const r = parsePageConfig({ enrichments: [] });
    expect(r.enrichments).toEqual(new Set());
    expect(r.enrichments).not.toBeUndefined();
  });

  it('reads showToggleUi:true', () => {
    const r = parsePageConfig({ showToggleUi: true });
    expect(r.showToggleUi).toBe(true);
  });
});

describe('parsePageConfig — FR-022 fallbacks', () => {
  it('non-object raw → warns + rejects whole config', () => {
    const r = parsePageConfig('not an object');
    expect(r.enrichments).toBeUndefined();
    expect(r.showToggleUi).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/pageConfig must be an object/);
  });

  it('number raw → warns + rejects', () => {
    const r = parsePageConfig(42);
    expect(r.enrichments).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('enrichments non-array → warns + ignores the field', () => {
    const r = parsePageConfig({ enrichments: 'heatmap,sliders', showToggleUi: true });
    expect(r.enrichments).toBeUndefined();
    expect(r.showToggleUi).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/enrichments must be an array/);
  });

  it('non-string entries dropped with one warning', () => {
    const r = parsePageConfig({ enrichments: ['heatmap', 42, null, 'sliders', { x: 1 }] });
    expect(r.enrichments).toEqual(new Set(['heatmap', 'sliders']));
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/non-string entries/);
  });

  it('showToggleUi non-boolean → coerces via Boolean() with warn', () => {
    const r = parsePageConfig({ showToggleUi: 1 as unknown as boolean });
    expect(r.showToggleUi).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/showToggleUi must be a boolean/);
  });

  it('showToggleUi="false" coerces to true via Boolean (truthy string)', () => {
    const r = parsePageConfig({ showToggleUi: 'false' as unknown as boolean });
    expect(r.showToggleUi).toBe(true);
  });
});

describe('parsePageConfig — per-table options (spec 015)', () => {
  it('absent tables → empty array', () => {
    expect(parsePageConfig(undefined).tables).toEqual([]);
    expect(parsePageConfig({ enrichments: ['heatmap'] }).tables).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses a valid entry with all fields', () => {
    const r = parsePageConfig({
      tables: [{ selector: '#a', enrichments: ['Heatmap', ' SORT '], startActive: true }],
    });
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0].selector).toBe('#a');
    expect(r.tables[0].enrichments).toEqual(new Set(['heatmap', 'sort']));
    expect(r.tables[0].startActive).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('selector is preserved as authored (not lowercased)', () => {
    const r = parsePageConfig({ tables: [{ selector: 'table.Measurements' }] });
    expect(r.tables[0].selector).toBe('table.Measurements');
  });

  it('selector is trimmed', () => {
    const r = parsePageConfig({ tables: [{ selector: '  #a  ' }] });
    expect(r.tables[0].selector).toBe('#a');
  });

  it('absent enrichments stays undefined (distinct from empty)', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a' }] });
    expect(r.tables[0].enrichments).toBeUndefined();
  });

  it('empty enrichments honoured as "offer none"', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a', enrichments: [] }] });
    expect(r.tables[0].enrichments).toEqual(new Set());
  });

  it('absent startActive defaults to false', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a' }] });
    expect(r.tables[0].startActive).toBe(false);
  });

  it('startActive non-boolean → Boolean()-coerced with one warning', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a', startActive: 1 as unknown as boolean }] });
    expect(r.tables[0].startActive).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/startActive must be a boolean/);
  });

  it('tables non-array → warns once + ignores the field', () => {
    const r = parsePageConfig({ tables: 'nope' });
    expect(r.tables).toEqual([]);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/tables must be an array/);
  });

  it('entry without a string selector is dropped (one warning)', () => {
    const r = parsePageConfig({
      tables: [{ selector: '#keep' }, { selector: '' }, { selector: 42 }, {}, null, 'x'],
    });
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0].selector).toBe('#keep');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/must be objects with a string selector/);
  });

  it('per-table enrichments non-array → ignores field, keeps entry', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a', enrichments: 'heatmap' }] });
    expect(r.tables).toHaveLength(1);
    expect(r.tables[0].enrichments).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/tables\[\]\.enrichments must be an array/);
  });

  it('per-table enrichments non-string members dropped with one warning', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a', enrichments: ['heatmap', 7, null] }] });
    expect(r.tables[0].enrichments).toEqual(new Set(['heatmap']));
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/tables\[\]\.enrichments contains non-string/);
  });

  it('keeps multiple valid entries in declaration order', () => {
    const r = parsePageConfig({
      tables: [
        { selector: '#a', enrichments: ['heatmap'] },
        { selector: '.b', startActive: true },
      ],
    });
    expect(r.tables.map((t) => t.selector)).toEqual(['#a', '.b']);
  });

  it('absent activate stays undefined', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a' }] });
    expect(r.tables[0].activate).toBeUndefined();
  });

  it('parses + normalises activate like the enrichment list', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a', activate: ['Heatmap', ' SLIDERS '] }] });
    expect(r.tables[0].activate).toEqual(new Set(['heatmap', 'sliders']));
  });

  it('activate non-array → ignores field, keeps entry', () => {
    const r = parsePageConfig({ tables: [{ selector: '#a', activate: 'heatmap' }] });
    expect(r.tables[0].activate).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/tables\[\]\.activate must be an array/);
  });
});
