import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import '../enrichments/compare-column';
import { activateDirective, mutateDirective, removeDirective, detachAll } from '../enrichments/virtual-column';

const meta: Meta = {
  title: 'Features/Compare Column (US3)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Δ lozenge picks two numeric columns and appends `Δ <colB> − <colA>` with abs / rel / percent modes. (spec 012-virtual-columns)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '720px';
    container.style.padding = '16px';
    container.innerHTML = `
      <h2>Quarterly comparison</h2>
      <table id="compare-story-table">
        <thead>
          <tr><th>Region</th><th>Q1</th><th>Q4</th></tr>
        </thead>
        <tbody>
          <tr><td>North</td><td>100</td><td>190</td></tr>
          <tr><td>South</td><td>50</td><td>50</td></tr>
          <tr><td>East</td><td>20</td><td>10</td></tr>
        </tbody>
      </table>
    `;
    return container;
  },
};

export default meta;
type Story = StoryObj;

export const ThreeModes: Story = {
  name: 'abs → rel → percent cycle',
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const table = (await root.findByRole('table')) as HTMLTableElement;
    detachAll();

    activateDirective({
      id: 'cmp-q1-q4',
      kind: 'compare',
      tableEl: table,
      colKeyA: 'q1',
      colKeyB: 'q4',
      mode: 'abs',
    });
    const header = table.querySelector('th[data-gs-virtual-column="compare"]');
    expect(header?.textContent).toBe('Δ Q4 − Q1');

    const cellTexts = () =>
      Array.from(table.querySelectorAll('td[data-gs-virtual-column="compare"]')).map((c) => c.textContent || '');
    expect(cellTexts()[0]).toMatch(/▲/);
    expect(cellTexts()[1]).toMatch(/=/);
    expect(cellTexts()[2]).toMatch(/▼/);

    mutateDirective('cmp-q1-q4', { mode: 'percent' });
    expect(cellTexts()[0]).toMatch(/%/);

    removeDirective('cmp-q1-q4');
    expect(table.querySelector('[data-gs-virtual-column]')).toBeNull();
  },
};
