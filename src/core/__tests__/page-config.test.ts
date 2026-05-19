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
