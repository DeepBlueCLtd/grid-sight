import type { Meta, StoryObj } from '@storybook/html';
import { expect, userEvent, within } from '@storybook/test';
import { initializeGridSight } from '../main';
import testTable from './tables/numeric-and-categorical.html?raw';

const meta: Meta = {
  title: 'Enrichment Menu',
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.innerHTML = `
      <h2>Test Table with Numeric and Categorical Columns</h2>
      <div id="table-container">
        ${testTable}
      </div>
    `;
    requestAnimationFrame(() => initializeGridSight());
    return container;
  },
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: '#f5f5f5' },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Validate that the H (heatmap) lozenge is present (numeric) or absent
 *  (categorical) on a given column header. */
async function testHeatmapLozengeForColumn(
  canvasElement: HTMLElement,
  columnName: string,
  shouldBePresent: boolean
) {
  await new Promise((r) => setTimeout(r, 100));
  const canvas = within(canvasElement);
  const gsToggle = canvasElement.querySelector('.grid-sight-toggle');
  if (!gsToggle) throw new Error('GridSight toggle not found');
  await userEvent.click(gsToggle);
  await new Promise((r) => setTimeout(r, 100));

  const header = canvas.getByText(columnName).closest('th');
  if (!header) throw new Error(`${columnName} header not found`);

  const heatmapLozenge = header.querySelector('.gs-lozenge[data-gs-lozenge-id="heatmap"]');
  if (shouldBePresent) {
    expect(heatmapLozenge).not.toBeNull();
  } else {
    expect(heatmapLozenge).toBeNull();
  }
}

export const ShowsHeatmapForNumericColumns: Story = {
  name: 'Shows heatmap lozenge for numeric columns',
  play: async ({ canvasElement }) => {
    await testHeatmapLozengeForColumn(canvasElement, 'Price', true);
  },
};

export const NoHeatmapForCategoricalColumns: Story = {
  name: 'No heatmap lozenge for categorical columns',
  play: async ({ canvasElement }) => {
    await testHeatmapLozengeForColumn(canvasElement, 'Category', false);
  },
};
