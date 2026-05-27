/**
 * Composition matrix for the table-grid addressing layer (spec 013, US2).
 *
 * For every point in {none,row,col,both} × {none,+cumulative,+sparkline} ×
 * {unsorted,sorted}, run the activations under BOTH orders (enrichment-first
 * vs slider-first) and assert the addressing layer resolves the same author
 * cells, headers, and values for each source column. Encodes SC-001/SC-002/
 * SC-003 (INV-2/INV-3).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { columnCells, cellValue, headerCellFor } from '../table-grid';
import { removeAllSliders } from '../../enrichments/slider';
import {
  buildNumericGrid,
  captureIdentity,
  expectIdentityPreserved,
  activateInOrder,
  type ActivationStep,
} from './helpers/grid-fixture';

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  removeAllSliders();
  document.body.innerHTML = '';
});

type SliderPoint = 'none' | 'row' | 'col' | 'both';
type EnrichPoint = 'none' | 'cumulative' | 'sparkline';
type SortPoint = 'unsorted' | 'sorted';

const SLIDER_STEPS: Record<SliderPoint, ActivationStep[]> = {
  none: [],
  row: ['row'],
  col: ['col'],
  both: ['row', 'col'],
};
const ENRICH_STEPS: Record<EnrichPoint, ActivationStep[]> = {
  none: [],
  cumulative: ['cumulative'],
  sparkline: ['sparkline'],
};

const SLIDERS: SliderPoint[] = ['none', 'row', 'col', 'both'];
const ENRICHMENTS: EnrichPoint[] = ['none', 'cumulative', 'sparkline'];
const SORTS: SortPoint[] = ['unsorted', 'sorted'];
const ORDERS: Array<'enrichment-first' | 'slider-first'> = [
  'enrichment-first',
  'slider-first',
];

function buildOrder(
  slider: SliderPoint,
  enrich: EnrichPoint,
  sort: SortPoint,
  order: 'enrichment-first' | 'slider-first',
): ActivationStep[] {
  const sliderSteps = SLIDER_STEPS[slider];
  const enrichSteps = ENRICH_STEPS[enrich];
  const steps =
    order === 'enrichment-first'
      ? [...enrichSteps, ...sliderSteps]
      : [...sliderSteps, ...enrichSteps];
  if (sort === 'sorted') steps.push('sort');
  return steps;
}

describe('addressing composition matrix (both activation orders)', () => {
  for (const slider of SLIDERS) {
    for (const enrich of ENRICHMENTS) {
      for (const sort of SORTS) {
        for (const order of ORDERS) {
          it(`slider=${slider} enrich=${enrich} ${sort} (${order})`, () => {
            const { table } = buildNumericGrid();
            const captured = captureIdentity(table);
            activateInOrder(table, buildOrder(slider, enrich, sort, order));
            expectIdentityPreserved(table, captured);
          });
        }
      }
    }
  }

  it('produces identical resolution for the same end state reached two ways (SC-002)', () => {
    // enrichment-first
    const a = buildNumericGrid();
    const capA = captureIdentity(a.table);
    activateInOrder(a.table, ['cumulative', 'row', 'col']);

    // slider-first
    const b = buildNumericGrid();
    const capB = captureIdentity(b.table);
    activateInOrder(b.table, ['row', 'col', 'cumulative']);

    for (let k = 0; k < capA.sourceCols; k++) {
      const colA = columnCells(a.table, k).map(cellValue);
      const colB = columnCells(b.table, k).map(cellValue);
      expect(colA).toEqual(colB);
      expect(cellValue(headerCellFor(a.table, k)!)).toBe(
        cellValue(headerCellFor(b.table, k)!),
      );
    }
    // Both gained exactly one virtual column at the same logical position.
    expect(columnCells(a.table, capA.sourceCols)).toHaveLength(a.bodyRowCount);
    expect(columnCells(b.table, capB.sourceCols)).toHaveLength(b.bodyRowCount);
  });
});
