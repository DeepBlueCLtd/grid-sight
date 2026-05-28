import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import { createFindController } from '../enrichments/find-in-table';

function lookupTable(): string {
  return `
    <table id="find-story-table">
      <thead><tr><th>Code</th><th>Name</th><th>Region</th></tr></thead>
      <tbody>
        <tr><td>A1</td><td>Alpha</td><td>admin</td></tr>
        <tr><td>B2</td><td>Bravo</td><td>ADMIN</td></tr>
        <tr><td>C3</td><td>Charlie</td><td>user</td></tr>
        <tr><td>D4</td><td>Delta</td><td>admin</td></tr>
      </tbody>
    </table>`;
}

const meta: Meta = {
  title: 'Features/Find in table (spec 014)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Search a table; all visible matches get a cell-level highlight (no <mark>/text-node ' +
          'surgery), with the active match emphasised. Next/Prev wrap; clear is byte-identical. (spec 014)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '480px';
    container.innerHTML = `<h2>Find in table</h2>${lookupTable()}`;
    return container;
  },
};

export default meta;
type Story = StoryObj;

export const HighlightAndStep: Story = {
  name: 'highlight all matches → step → byte-identical clear',
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const table = (await root.findByRole('table')) as HTMLTableElement;
    const before = table.outerHTML;

    const controller = createFindController(table);
    controller.search('admin'); // case-insensitive → 3 matches

    expect(table.querySelectorAll('.gs-find-match').length).toBe(3);
    expect(table.querySelectorAll('.gs-find-current').length).toBe(1);
    expect(controller.currentOrdinal()).toBe(1);

    controller.next();
    expect(controller.currentOrdinal()).toBe(2);
    controller.next();
    controller.next(); // wrap back to 1
    expect(controller.currentOrdinal()).toBe(1);

    controller.clear();
    expect(table.querySelectorAll('.gs-find-match, .gs-find-current').length).toBe(0);
    expect(table.outerHTML).toBe(before);
  },
};
