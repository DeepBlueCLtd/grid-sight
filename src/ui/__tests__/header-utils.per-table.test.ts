/**
 * spec 015 — table-aware lozenge injection.
 *
 * Two tables on one page, each addressed by a per-table entry with a different
 * enrichment set, must receive different lozenge clusters. A third table
 * matched by no entry must follow the page-global set exactly as before
 * (INV-1, no regression).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { injectPlusIcons } from '../header-utils';
import { setPageConfig, setVisitorOverride } from '../../core/enabled-set-state';

beforeEach(() => {
  document.body.innerHTML = '';
  setVisitorOverride(undefined);
  setPageConfig({ enrichments: undefined, showToggleUi: false, tables: [] });
});

function makeTable(id: string): HTMLTableElement {
  const t = document.createElement('table');
  t.id = id;
  t.innerHTML = `
    <tr><th></th><th>10</th><th>20</th></tr>
    <tr><th>1000</th><td>1</td><td>2</td></tr>
    <tr><th>2000</th><td>3</td><td>4</td></tr>
  `;
  document.body.appendChild(t);
  return t;
}

function lozengeIds(table: HTMLTableElement): Set<string> {
  const els = table.querySelectorAll<HTMLElement>('[data-gs-lozenge-id]');
  return new Set(Array.from(els, (el) => el.getAttribute('data-gs-lozenge-id') as string));
}

const NUMERIC: Array<'numeric' | 'categorical'> = ['numeric', 'numeric', 'numeric'];

describe('table-aware lozenge injection (spec 015)', () => {
  it('two tables with different per-table sets get different clusters', () => {
    const heat = makeTable('heat');
    const slide = makeTable('slide');
    setPageConfig({
      enrichments: undefined,
      showToggleUi: false,
      tables: [
        { selector: '#heat', enrichments: new Set(['heatmap']), startActive: false },
        { selector: '#slide', enrichments: new Set(['sliders']), startActive: false },
      ],
    });

    injectPlusIcons(heat, NUMERIC);
    injectPlusIcons(slide, NUMERIC);

    expect(lozengeIds(heat).has('heatmap')).toBe(true);
    expect(lozengeIds(heat).has('sliders')).toBe(false);

    expect(lozengeIds(slide).has('sliders')).toBe(true);
    expect(lozengeIds(slide).has('heatmap')).toBe(false);
  });

  it('an empty per-table set yields no lozenges (offer none)', () => {
    const none = makeTable('none');
    setPageConfig({
      enrichments: undefined,
      showToggleUi: false,
      tables: [{ selector: '#none', enrichments: new Set(), startActive: false }],
    });

    injectPlusIcons(none, NUMERIC);
    expect(lozengeIds(none).size).toBe(0);
  });

  it('an unmatched table follows the page-global set (INV-1)', () => {
    const matched = makeTable('matched');
    const other = makeTable('other');
    setPageConfig({
      enrichments: new Set(['heatmap']),
      showToggleUi: false,
      tables: [{ selector: '#matched', enrichments: new Set(['sliders']), startActive: false }],
    });

    injectPlusIcons(matched, NUMERIC);
    injectPlusIcons(other, NUMERIC);

    // The matched table uses its per-table set...
    expect(lozengeIds(matched).has('sliders')).toBe(true);
    expect(lozengeIds(matched).has('heatmap')).toBe(false);
    // ...while the unmatched table uses the page-level set (heatmap only).
    expect(lozengeIds(other).has('heatmap')).toBe(true);
    expect(lozengeIds(other).has('sliders')).toBe(false);
  });
});
