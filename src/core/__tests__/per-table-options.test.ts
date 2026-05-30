import { describe, it, expect } from 'vitest';
import { matchTableEntries, resolveTableConfig } from '../per-table-options';
import type { ParsedTableOptionEntry } from '../page-config';
import type { EnrichmentRegistryEntry } from '../enrichment-registry';

const REGISTRY: readonly EnrichmentRegistryEntry[] = Object.freeze([
  { id: 'heatmap', label: 'Heatmap', defaultOn: true, shipped: true },
  { id: 'sliders', label: 'Sliders', defaultOn: true, shipped: true },
  { id: 'sort', label: 'Sort', defaultOn: false, shipped: true },
  { id: 'filter', label: 'Filter', defaultOn: true, shipped: true },
]);

function entry(partial: Partial<ParsedTableOptionEntry> & { selector: string }): ParsedTableOptionEntry {
  return { enrichments: undefined, startActive: false, ...partial };
}

function makeTable(html: string): HTMLTableElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.querySelector('table') as HTMLTableElement;
}

describe('matchTableEntries — selector matching', () => {
  it('matches by id selector', () => {
    const t = makeTable('<table id="temps"><tr><td>1</td></tr></table>');
    const folded = matchTableEntries(t, [entry({ selector: '#temps', enrichments: new Set(['heatmap']) })]);
    expect(folded.matched).toBe(true);
    expect(folded.enrichments).toEqual(new Set(['heatmap']));
  });

  it('matches by class selector', () => {
    const t = makeTable('<table class="measurements"><tr><td>1</td></tr></table>');
    const folded = matchTableEntries(t, [entry({ selector: 'table.measurements', enrichments: new Set(['sort']) })]);
    expect(folded.matched).toBe(true);
    expect(folded.enrichments).toEqual(new Set(['sort']));
  });

  it('matches by structural selector', () => {
    const host = document.createElement('section');
    host.className = 'demo';
    host.innerHTML = '<table><tr><td>1</td></tr></table>';
    const t = host.querySelector('table') as HTMLTableElement;
    // Attach to a parent so the descendant combinator can resolve.
    const folded = matchTableEntries(t, [entry({ selector: 'section.demo > table', enrichments: new Set(['filter']) })]);
    // `Element.matches` evaluates against ancestors in the live tree.
    expect(folded.matched).toBe(true);
  });

  it('no matching entry → matched:false, enrichments undefined', () => {
    const t = makeTable('<table id="other"><tr><td>1</td></tr></table>');
    const folded = matchTableEntries(t, [entry({ selector: '#temps', enrichments: new Set(['heatmap']) })]);
    expect(folded.matched).toBe(false);
    expect(folded.enrichments).toBeUndefined();
  });

  it('invalid selector is skipped (never throws)', () => {
    const t = makeTable('<table id="temps"><tr><td>1</td></tr></table>');
    expect(() =>
      matchTableEntries(t, [entry({ selector: '###bad', enrichments: new Set(['heatmap']) })])
    ).not.toThrow();
    const folded = matchTableEntries(t, [entry({ selector: '###bad' })]);
    expect(folded.matched).toBe(false);
  });
});

describe('matchTableEntries — fold (last-match-wins per field, R-7)', () => {
  it('later entry overrides enrichments', () => {
    const t = makeTable('<table id="a" class="x"><tr><td>1</td></tr></table>');
    const folded = matchTableEntries(t, [
      entry({ selector: '.x', enrichments: new Set(['heatmap']) }),
      entry({ selector: '#a', enrichments: new Set(['sort']) }),
    ]);
    expect(folded.enrichments).toEqual(new Set(['sort']));
  });

  it('a later entry that omits enrichments leaves the earlier value (per-field)', () => {
    const t = makeTable('<table id="a" class="x"><tr><td>1</td></tr></table>');
    const folded = matchTableEntries(t, [
      entry({ selector: '.x', enrichments: new Set(['heatmap']) }),
      entry({ selector: '#a', startActive: true }), // no enrichments field
    ]);
    expect(folded.enrichments).toEqual(new Set(['heatmap']));
    expect(folded.startActive).toBe(true);
  });

  it('last matching entry sets startActive', () => {
    const t = makeTable('<table id="a" class="x"><tr><td>1</td></tr></table>');
    const folded = matchTableEntries(t, [
      entry({ selector: '.x', startActive: true }),
      entry({ selector: '#a', startActive: false }),
    ]);
    expect(folded.startActive).toBe(false);
  });
});

describe('matchTableEntries — data-gs-ignore is absolute (R-8)', () => {
  it('an ignored table never matches even if a selector applies', () => {
    const t = makeTable('<table id="temps" data-gs-ignore><tr><td>1</td></tr></table>');
    const folded = matchTableEntries(t, [entry({ selector: '#temps', enrichments: new Set(['heatmap']), startActive: true })]);
    expect(folded.matched).toBe(false);
    expect(folded.enrichments).toBeUndefined();
    expect(folded.startActive).toBe(false);
  });
});

describe('resolveTableConfig — resolution through precedence', () => {
  const base = {
    visitorOverride: undefined,
    pageConfig: { enrichments: new Set(['sliders']) },
    registry: REGISTRY,
  };

  it('matched table uses its per-table set (unknown ids dropped)', () => {
    const t = makeTable('<table id="temps"><tr><td>1</td></tr></table>');
    const cfg = resolveTableConfig(t, {
      ...base,
      entries: [entry({ selector: '#temps', enrichments: new Set(['heatmap', 'nope']), startActive: true })],
    });
    expect(cfg.matched).toBe(true);
    expect(cfg.enrichments).toEqual(new Set(['heatmap']));
    expect(cfg.startActive).toBe(true);
  });

  it('unmatched table falls back to page-global set (INV-1)', () => {
    const t = makeTable('<table id="other"><tr><td>1</td></tr></table>');
    const cfg = resolveTableConfig(t, {
      ...base,
      entries: [entry({ selector: '#temps', enrichments: new Set(['heatmap']) })],
    });
    expect(cfg.matched).toBe(false);
    expect(cfg.enrichments).toEqual(new Set(['sliders']));
    expect(cfg.startActive).toBe(false);
  });

  it('matched entry without enrichments falls through to page tier', () => {
    const t = makeTable('<table id="temps"><tr><td>1</td></tr></table>');
    const cfg = resolveTableConfig(t, {
      ...base,
      entries: [entry({ selector: '#temps', startActive: true })],
    });
    expect(cfg.matched).toBe(true);
    expect(cfg.enrichments).toEqual(new Set(['sliders'])); // page-level
    expect(cfg.startActive).toBe(true);
  });

  it('visitor override wins over a matched per-table set', () => {
    const t = makeTable('<table id="temps"><tr><td>1</td></tr></table>');
    const cfg = resolveTableConfig(t, {
      ...base,
      visitorOverride: new Set(['filter']),
      entries: [entry({ selector: '#temps', enrichments: new Set(['heatmap']) })],
    });
    expect(cfg.enrichments).toEqual(new Set(['filter']));
  });
});
