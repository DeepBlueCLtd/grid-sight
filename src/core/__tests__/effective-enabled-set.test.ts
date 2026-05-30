import { describe, it, expect } from 'vitest';
import { resolveEnabledSet } from '../effective-enabled-set';
import type { EnrichmentRegistryEntry } from '../enrichment-registry';

const REGISTRY: readonly EnrichmentRegistryEntry[] = Object.freeze([
  { id: 'heatmap', label: 'Heatmap', defaultOn: true,  shipped: true  },
  { id: 'sliders', label: 'Sliders', defaultOn: true,  shipped: true  },
  { id: 'sort',    label: 'Sort',    defaultOn: false, shipped: false },
  { id: 'filter',  label: 'Filter',  defaultOn: true,  shipped: false },
]);

describe('resolveEnabledSet — precedence', () => {
  it('visitor override wins over page config', () => {
    const out = resolveEnabledSet({
      visitorOverride: new Set(['heatmap']),
      pageConfig: { enrichments: new Set(['sliders']) },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['heatmap']));
  });

  it('page config wins when no visitor override', () => {
    const out = resolveEnabledSet({
      visitorOverride: undefined,
      pageConfig: { enrichments: new Set(['sliders']) },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['sliders']));
  });

  it('falls back to registry default-on when neither is set', () => {
    const out = resolveEnabledSet({
      visitorOverride: undefined,
      pageConfig: { enrichments: undefined },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['heatmap', 'sliders', 'filter']));
  });

  it('empty pageConfig.enrichments honoured as "no enrichments"', () => {
    const out = resolveEnabledSet({
      visitorOverride: undefined,
      pageConfig: { enrichments: new Set() },
      registry: REGISTRY,
    });
    expect(out.size).toBe(0);
  });

  it('empty visitorOverride honoured as "no enrichments"', () => {
    const out = resolveEnabledSet({
      visitorOverride: new Set(),
      pageConfig: { enrichments: new Set(['heatmap']) },
      registry: REGISTRY,
    });
    expect(out.size).toBe(0);
  });
});

describe('resolveEnabledSet — unknown id filtering', () => {
  it('drops unknown ids from visitor override', () => {
    const out = resolveEnabledSet({
      visitorOverride: new Set(['heatmap', 'unknown-id']),
      pageConfig: { enrichments: undefined },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['heatmap']));
  });

  it('drops unknown ids from page config', () => {
    const out = resolveEnabledSet({
      visitorOverride: undefined,
      pageConfig: { enrichments: new Set(['heatmap', 'not-a-real-id']) },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['heatmap']));
  });
});

describe('resolveEnabledSet — per-table tier (spec 015)', () => {
  it('per-table set wins over page config when no visitor override', () => {
    const out = resolveEnabledSet({
      visitorOverride: undefined,
      perTableEnrichments: new Set(['heatmap']),
      pageConfig: { enrichments: new Set(['sliders']) },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['heatmap']));
  });

  it('visitor override still wins over the per-table set (precedence)', () => {
    const out = resolveEnabledSet({
      visitorOverride: new Set(['sliders']),
      perTableEnrichments: new Set(['heatmap']),
      pageConfig: { enrichments: new Set(['filter']) },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['sliders']));
  });

  it('undefined per-table tier falls through to page config (INV-1)', () => {
    const out = resolveEnabledSet({
      visitorOverride: undefined,
      perTableEnrichments: undefined,
      pageConfig: { enrichments: new Set(['sliders']) },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['sliders']));
  });

  it('empty per-table set honoured as "offer none" (not fall-through)', () => {
    const out = resolveEnabledSet({
      visitorOverride: undefined,
      perTableEnrichments: new Set(),
      pageConfig: { enrichments: new Set(['heatmap']) },
      registry: REGISTRY,
    });
    expect(out.size).toBe(0);
  });

  it('drops unknown ids at the per-table tier (INV-2)', () => {
    const out = resolveEnabledSet({
      visitorOverride: undefined,
      perTableEnrichments: new Set(['heatmap', 'not-a-real-id']),
      pageConfig: { enrichments: undefined },
      registry: REGISTRY,
    });
    expect(out).toEqual(new Set(['heatmap']));
  });
});

describe('resolveEnabledSet — output isolation', () => {
  it('output is a fresh Set, not aliased to input', () => {
    const visitor = new Set(['heatmap']);
    const out = resolveEnabledSet({
      visitorOverride: visitor,
      pageConfig: { enrichments: undefined },
      registry: REGISTRY,
    });
    expect(out).not.toBe(visitor);
    out.add('extra');
    expect(visitor.has('extra')).toBe(false);
  });
});
