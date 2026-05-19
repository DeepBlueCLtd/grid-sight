import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import '../enrichments/cumulative-column';
import { activateDirective, mutateDirective, removeDirective, detachAll } from '../enrichments/virtual-column';

const meta: Meta = {
  title: 'Features/Cumulative Column (US1)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Σ lozenge appends a `Σ <header>` cumulative column with sum and percent-of-total modes. (spec 012-virtual-columns)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '720px';
    container.style.padding = '16px';
    container.innerHTML = `
      <h2>Sales by region — cumulative running sum</h2>
      <table id="cum-story-table">
        <thead>
          <tr><th>Region</th><th>Weight</th></tr>
        </thead>
        <tbody>
          <tr><td>North</td><td>10</td></tr>
          <tr><td>South</td><td>20</td></tr>
          <tr><td>East</td><td>30</td></tr>
          <tr><td>West</td><td>40</td></tr>
          <tr><td>Centre</td><td>50</td></tr>
        </tbody>
      </table>
    `;
    return container;
  },
};

export default meta;
type Story = StoryObj;

export const SumPercentOff: Story = {
  name: 'sum → percent → off cycle',
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const table = (await root.findByRole('table')) as HTMLTableElement;
    detachAll();

    // sum
    const record = activateDirective({
      id: 'cum-weight',
      kind: 'cumulative',
      tableEl: table,
      sourceColKey: 'weight',
      mode: 'sum',
      activationIndex: 0,
    });
    expect(record).not.toBeNull();
    const sumCells = Array.from(
      table.querySelectorAll('td[data-gs-virtual-column="cumulative"]'),
    ).map((c) => c.textContent);
    expect(sumCells).toEqual(['10', '30', '60', '100', '150']);

    // percent
    mutateDirective('cum-weight', { mode: 'percent' });
    const pctCells = Array.from(
      table.querySelectorAll('td[data-gs-virtual-column="cumulative"]'),
    ).map((c) => c.textContent);
    expect(pctCells[pctCells.length - 1]).toBe('100%');

    // off
    removeDirective('cum-weight');
    expect(table.querySelector('[data-gs-virtual-column]')).toBeNull();
  },
};
