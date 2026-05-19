import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import '../enrichments/sparkline-column';
import { activateDirective, removeDirective, detachAll } from '../enrichments/virtual-column';

const meta: Meta = {
  title: 'Features/Sparkline Column (US2)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '⌇ lozenge appends a `Trend` column with inline-SVG mini-bar-charts. (spec 012-virtual-columns)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '720px';
    container.style.padding = '16px';
    container.innerHTML = `
      <h2>Sales by region — sparkline trend</h2>
      <table id="spark-story-table">
        <thead>
          <tr><th>Region</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th></tr>
        </thead>
        <tbody>
          <tr><td>North</td><td>100</td><td>120</td><td>150</td><td>190</td></tr>
          <tr><td>South</td><td>80</td><td>90</td><td>95</td><td>110</td></tr>
          <tr><td>East</td><td>60</td><td>70</td><td>80</td><td>90</td></tr>
        </tbody>
      </table>
    `;
    return container;
  },
};

export default meta;
type Story = StoryObj;

export const Activate: Story = {
  name: '⌇ adds Trend column',
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const table = (await root.findByRole('table')) as HTMLTableElement;
    detachAll();

    const record = activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    expect(record).not.toBeNull();
    const svgs = table.querySelectorAll('td[data-gs-virtual-column="sparkline"] svg');
    expect(svgs.length).toBe(3);
    // Each row has 4 numeric columns, so 4 rects.
    expect(svgs[0].querySelectorAll('rect').length).toBe(4);

    removeDirective('spark');
    expect(table.querySelector('[data-gs-virtual-column]')).toBeNull();
  },
};
