import type { Meta, StoryObj } from '@storybook/html';
import { within, userEvent, expect } from '@storybook/test';
import { initializeGridSight } from '../main';
// Import HTML table from external file
import testTable from './tables/numeric-and-categorical.html?raw';

const meta: Meta = {
  title: 'Enrichment Menu',
  render: () => {
    // Create container for the table
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.innerHTML = `
      <h2>Test Table with Numeric and Categorical Columns</h2>
      <div id="table-container">
        ${testTable}
      </div>
    `;

    // Initialize GridSight after a short delay to ensure the table is in the DOM
    requestAnimationFrame(() => {
      initializeGridSight();
    });

    return container;
  },
  parameters: {
    // Disable Storybook's default padding
    layout: 'fullscreen',
    // Add a background color to make the table stand out
    backgrounds: { default: '#f5f5f5' }
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

// Helper function to test if heatmap option is available for a column
async function testHeatmapOptionForColumn(canvasElement: HTMLElement, columnName: string, shouldBeAvailable: boolean) {
  // Wait for GridSight to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const canvas = within(canvasElement);
  
  // First, find and click the GS toggle to enable GridSight
  const gsToggle = canvasElement.querySelector('.grid-sight-toggle');
  if (!gsToggle) {
    throw new Error('GridSight toggle not found');
  }
  await userEvent.click(gsToggle);
  
  // Wait for GridSight to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Find the header for the specified column
  const header = canvas.getByText(columnName).closest('th');
  if (!header) {
    throw new Error(`${columnName} header not found`);
  }
  
  // Find the plus icon in the header
  const plusIcon = header.querySelector('.gs-plus-icon');
  if (!plusIcon) {
    throw new Error(`Plus icon not found in ${columnName} header. Make sure GridSight is enabled.`);
  }
  
  // Click the plus icon to open the menu
  await userEvent.click(plusIcon);
  
  try {
    // Check if the enrichment menu is shown
    const menu = document.querySelector('.gs-enrichment-menu');
    expect(menu).toBeInTheDocument();
    
    // Check if heatmap option is in the menu as expected
    const heatmapOption = within(menu as HTMLElement).queryByText('Heatmap');
    
    if (shouldBeAvailable) {
      expect(heatmapOption).toBeInTheDocument();
    } else {
      expect(heatmapOption).not.toBeInTheDocument();
    }
  } finally {
    // Always close the menu
    await userEvent.click(document.body);
  }
}

export const ShowsHeatmapForNumericColumns: Story = {
  name: 'Shows heatmap for numeric columns',
  play: async ({ canvasElement }) => {
    await testHeatmapOptionForColumn(canvasElement, 'Price', true);
  },
};

export const NoHeatmapForCategoricalColumns: Story = {
  name: 'No heatmap for categorical columns',
  play: async ({ canvasElement }) => {
    await testHeatmapOptionForColumn(canvasElement, 'Category', false);
  },
};
