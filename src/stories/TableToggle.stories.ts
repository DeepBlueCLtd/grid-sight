import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import { initializeGridSight } from '../main';

// Import table HTML content
import numericTable from './tables/numeric-and-categorical.html?raw';
import categoricalTable from './tables/categorical.html?raw';
import mixedTable from './tables/mixed.html?raw';
import twoDimTable from './tables/two-dim-data.html?raw';
import unsuitableTable from './tables/unsuitable.html?raw';

// Define the metadata for the story
const meta: Meta = {
  title: 'Features/Table Detection & Toggle Injection',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Grid-Sight automatically detects suitable tables and injects a toggle button. ' +
                 'A table is considered suitable if it has both a thead and tbody, contains at least ' +
                 'one data row, and has at least two columns that can be identified as numeric or categorical.'
      }
    }
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '800px';
    container.style.margin = '0 auto';
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';
    
    container.innerHTML = `
      <style>
        .demo-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .demo-table th, .demo-table td {
          border: 1px solid #ddd;
          padding: 8px 12px;
          text-align: left;
        }
        .demo-table th {
          background-color: #f4f4f4;
          font-weight: bold;
        }
        .demo-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .demo-table tr:hover {
          background-color: #f1f1f1;
        }
        .example {
          margin-bottom: 40px;
          padding: 20px;
          border: 1px solid #eee;
          border-radius: 4px;
          background: #fff;
        }
        .example h3 {
          margin-top: 0;
          color: #333;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
        }
        .status {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: bold;
          margin-left: 10px;
        }
        .status-suitable {
          background-color: #d4edda;
          color: #155724;
        }
        .status-unsuitable {
          background-color: #f8d7da;
          color: #721c24;
        }
      </style>

      <h1>Grid-Sight Table Detection</h1>
      <p>Grid-Sight automatically analyzes HTML tables and injects a toggle button for suitable tables.</p>
      
      <div class="example">
        <h3>Numeric Data Table <span class="status status-suitable">Suitable</span></h3>
        <p>This table contains multiple numeric columns (Price, Stock, Rating). The GS toggle should appear.</p>
        ${numericTable}
      </div>

      <div class="example">
        <h3>Two-Dimensional Data Table <span class="status status-suitable">Suitable</span></h3>
        <p>This table two dimensional array of data. The GS toggle should appear.</p>
        ${twoDimTable}
      </div>



      <div class="example">
        <h3>Categorical Data Table <span class="status status-suitable">Suitable</span></h3>
        <p>This table contains categorical data (Department, Status). The GS toggle should appear.</p>
        ${categoricalTable}
      </div>

      <div class="example">
        <h3>Mixed Data Table <span class="status status-suitable">Suitable</span></h3>
        <p>This table contains both numeric (Population, Area) and categorical (City, Country) data. The GS toggle should appear.</p>
        ${mixedTable}
      </div>

      <div class="example">
        <h3>Unsuitable Table <span class="status status-unsuitable">Not Suitable</span></h3>
        <p>This table doesn't have enough suitable columns (only one row). The GS toggle should NOT appear.</p>
        ${unsuitableTable}
      </div>
    `;
    
    return container;
  },
};

export default meta;

type Story = StoryObj;

// Define the actual story
export const Default: Story = {
  name: 'Table Detection Examples',
  play: async () => {
    // Run the main logic to inject the toggles
    initializeGridSight();

    // Helper function to test if a table has the toggle
    const expectToggle = async (tableId: string, shouldHaveToggle: boolean) => {
      const table = document.getElementById(tableId) as HTMLTableElement;
      const canvas = within(table);
      
      if (shouldHaveToggle) {
        const toggle = await canvas.findByText('GS');
        expect(toggle).toBeInTheDocument();
        expect(table.classList.contains('grid-sight-enabled')).toBe(true);
      } else {
        const toggle = canvas.queryByText('GS');
        expect(toggle).not.toBeInTheDocument();
        expect(table.classList.contains('grid-sight-enabled')).toBe(false);
      }
    };

    // Test each table
    await expectToggle('test-table', true); // numeric-and-categorical.html
    await expectToggle('categorical-table', true);
    await expectToggle('mixed-table', true);
    await expectToggle('unsuitable-table', false);
  },
};

// Add a story to test the toggle interaction
export const ToggleInteraction: Story = {
  name: 'Toggle Interaction',
  play: async () => {
    // Run the main logic to inject the toggles
    initializeGridSight();
    
    // Get the first suitable table
    const table = document.getElementById('test-table') as HTMLTableElement; // numeric-and-categorical.html
    const canvas = within(table);
    
    // Find the toggle and click it
    const toggle = await canvas.findByText('GS');
    
    // Test initial state
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    
    // Click the toggle
    toggle.click();
    
    // Test that the active class is added and aria-expanded is updated
    const container = toggle.closest('.grid-sight-toggle-container');
    expect(container?.classList.contains('grid-sight-toggle--active')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    
    // Click again to toggle off
    toggle.click();
    expect(container?.classList.contains('grid-sight-toggle--active')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  },
};
