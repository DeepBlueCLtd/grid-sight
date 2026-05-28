import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import { applySummaryRow, removeSummaryRow } from '../enrichments/summary-row';

function salesTable(): string {
  return `
    <table id="summary-story-table" data-gs-key="story-sales">
      <thead><tr><th>Region</th><th>Units</th><th>Revenue</th></tr></thead>
      <tbody>
        <tr><td>North</td><td>10</td><td>100</td></tr>
        <tr><td>South</td><td>20</td><td>200</td></tr>
        <tr><td>East</td><td>30</td><td>300</td></tr>
        <tr><td>West</td><td>40</td><td>400</td></tr>
      </tbody>
    </table>`;
}

const meta: Meta = {
  title: 'Features/Summary row (spec 014)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A per-column aggregate footer (sum / avg / min / max / count) over the visible rows. ' +
          'Cycle a numeric column through aggregates; teardown is byte-identical. (spec 014)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '480px';
    container.innerHTML = `<h2>Aggregate footer</h2>${salesTable()}`;
    return container;
  },
};

export default meta;
type Story = StoryObj;

export const FooterAggregates: Story = {
  name: 'sum over visible → switch to average → byte-identical teardown',
  play: async ({ canvasElement }) => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    const root = within(canvasElement);
    const table = (await root.findByRole('table')) as HTMLTableElement;
    const before = table.outerHTML;

    applySummaryRow(table);
    const footRow = table.tFoot!.querySelector('tr.gs-summary-row') as HTMLTableRowElement;
    const unitsValue = () =>
      footRow.cells[1].querySelector('.gs-summary-value')!.textContent;

    // Default numeric aggregate is the sum over all visible rows.
    expect(unitsValue()).toBe('100');

    // Cycle the Units column to average.
    const btn = footRow.cells[1].querySelector('.gs-summary-agg') as HTMLButtonElement;
    btn.click();
    expect(btn.textContent).toBe('avg');
    expect(unitsValue()).toBe('25');

    // Teardown restores the original markup.
    removeSummaryRow(table);
    expect(table.outerHTML).toBe(before);
  },
};
