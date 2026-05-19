/**
 * FR-010 acceptance: `createEnrichmentMenu` MUST omit menu items whose
 * registry id is not in the effective enabled set.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createEnrichmentMenu } from '../enrichment-menu';
import { setPageConfig, setVisitorOverride } from '../../core/enabled-set-state';

const FULL_CTX = {
  headerType: 'table' as const,
  axisIsSliderEligible: true,
  sliderExists: false,
  hasHeatmap: false,
  anySliderExists: false,
  bothAxesEligible: true,
  thresholdSliderExists: false,
};

function idsInMenu(menu: HTMLElement): Set<string> {
  return new Set(
    Array.from(menu.querySelectorAll<HTMLElement>('[data-gs-enrichment-id]')).map(
      el => el.getAttribute('data-gs-enrichment-id') as string
    )
  );
}

beforeEach(() => {
  setVisitorOverride(undefined);
  setPageConfig({ enrichments: undefined, showToggleUi: false });
});

describe('createEnrichmentMenu — effective enabled set filter (FR-010)', () => {
  it('numeric / table — full default set renders heatmap, sliders, statistics', () => {
    const menu = createEnrichmentMenu('numeric', () => {}, FULL_CTX);
    const ids = idsInMenu(menu);
    expect(ids.has('heatmap')).toBe(true);
    expect(ids.has('sliders')).toBe(true);
    expect(ids.has('statistics')).toBe(true);
  });

  it('omits items whose registry id is outside the enabled set', () => {
    setPageConfig({ enrichments: new Set(['heatmap', 'sliders']), showToggleUi: false });
    const menu = createEnrichmentMenu('numeric', () => {}, FULL_CTX);
    const ids = idsInMenu(menu);
    expect(ids.has('heatmap')).toBe(true);
    expect(ids.has('sliders')).toBe(true);
    expect(ids.has('statistics')).toBe(false);
    expect(ids.has('slider-threshold')).toBe(false);
  });

  it('renders no items when enabled set is empty', () => {
    setPageConfig({ enrichments: new Set(), showToggleUi: false });
    const menu = createEnrichmentMenu('numeric', () => {}, FULL_CTX);
    expect(idsInMenu(menu).size).toBe(0);
  });

  it('categorical row — heatmap absent regardless of enabled set (column-type filter wins)', () => {
    setPageConfig({ enrichments: new Set(['heatmap', 'frequency']), showToggleUi: false });
    const menu = createEnrichmentMenu('categorical', () => {}, {
      ...FULL_CTX,
      headerType: 'row',
    });
    const ids = idsInMenu(menu);
    expect(ids.has('heatmap')).toBe(false); // heatmap is numeric-only
    expect(ids.has('frequency')).toBe(true);
  });

  it('visitor override wins over page config', () => {
    setPageConfig({ enrichments: new Set(['heatmap', 'sliders', 'statistics']), showToggleUi: false });
    setVisitorOverride(new Set(['sliders']));
    const menu = createEnrichmentMenu('numeric', () => {}, FULL_CTX);
    const ids = idsInMenu(menu);
    expect(ids.has('heatmap')).toBe(false);
    expect(ids.has('statistics')).toBe(false);
    expect(ids.has('sliders')).toBe(true);
  });
});
