import { describe, it, expect } from 'vitest';
import { ENRICHMENT_REGISTRY, ENRICHMENT_IDS } from '../enrichment-registry';
import { ENRICHMENT_ITEMS } from '../../ui/enrichment-menu';

describe('enrichment-registry', () => {
  it('every id matches /^[a-z][a-z0-9-]*$/', () => {
    const pattern = /^[a-z][a-z0-9-]*$/;
    for (const e of ENRICHMENT_REGISTRY) {
      expect(pattern.test(e.id), `id "${e.id}" must match the slug pattern`).toBe(true);
    }
  });

  it('ids are unique', () => {
    const seen = new Set<string>();
    for (const e of ENRICHMENT_REGISTRY) {
      expect(seen.has(e.id), `duplicate id "${e.id}"`).toBe(false);
      seen.add(e.id);
    }
  });

  it('every label is non-empty', () => {
    for (const e of ENRICHMENT_REGISTRY) {
      expect(e.label.length, `id "${e.id}" must have a non-empty label`).toBeGreaterThan(0);
    }
  });

  it('registry array is frozen', () => {
    expect(Object.isFrozen(ENRICHMENT_REGISTRY)).toBe(true);
    expect(Object.isFrozen(ENRICHMENT_REGISTRY[0])).toBe(true);
  });

  it('ENRICHMENT_IDS is a frozen array of every registered id', () => {
    expect(Object.isFrozen(ENRICHMENT_IDS)).toBe(true);
    expect(ENRICHMENT_IDS.length).toBe(ENRICHMENT_REGISTRY.length);
    for (let i = 0; i < ENRICHMENT_IDS.length; i++) {
      expect(ENRICHMENT_IDS[i]).toBe(ENRICHMENT_REGISTRY[i].id);
    }
  });

  it('contains every id named in data-model.md "Initial contents"', () => {
    const expected = [
      'heatmap', 'sliders', 'slider-threshold',
      'statistics', 'frequency', 'frequency-chart',
      'annotations', 'copy-as-csv', 'cumulative',
      'diff-compare', 'filter', 'outlier',
      'sort', 'sparkline', 'units-toggle',
    ];
    const ids = new Set(ENRICHMENT_REGISTRY.map(e => e.id));
    for (const id of expected) {
      expect(ids.has(id), `registry missing id "${id}"`).toBe(true);
    }
  });

  it('shipped enrichments have tearDown hooks', () => {
    const shipped = ['heatmap', 'sliders', 'slider-threshold', 'statistics', 'frequency', 'frequency-chart', 'sort', 'filter', 'annotations', 'cumulative', 'diff-compare', 'sparkline'];
    for (const id of shipped) {
      const e = ENRICHMENT_REGISTRY.find(x => x.id === id);
      expect(e?.tearDown, `shipped enrichment "${id}" must have tearDown`).toBeDefined();
    }
  });

  it('spec-only enrichments have no tearDown hooks', () => {
    const specOnly = ['copy-as-csv', 'outlier', 'units-toggle'];
    for (const id of specOnly) {
      const e = ENRICHMENT_REGISTRY.find(x => x.id === id);
      expect(e?.tearDown, `spec-only enrichment "${id}" must not have tearDown`).toBeUndefined();
    }
  });

  it('spec-only enrichments have no apply hooks', () => {
    for (const e of ENRICHMENT_REGISTRY) {
      if (e.shipped) continue;
      expect(e.apply, `spec-only enrichment "${e.id}" must not have apply`).toBeUndefined();
    }
  });

  // Drift guard (docs/adding-an-enrichment.md §4): the per-column enrichment
  // menu must not reference an enrichment id that isn't a shipped registry
  // entry. Catches the "parallel id lists fell out of sync" failure mode.
  it('every ENRICHMENT_ITEMS id is a shipped registry enrichment', () => {
    const shipped = new Set(ENRICHMENT_REGISTRY.filter(e => e.shipped).map(e => e.id));
    for (const item of ENRICHMENT_ITEMS) {
      expect(shipped.has(item.id), `menu item "${item.id}" is not a shipped registry enrichment`).toBe(true);
    }
  });
});
