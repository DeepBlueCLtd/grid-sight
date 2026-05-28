import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import { applyFreezePanes, removeFreezePanes } from '../enrichments/freeze-panes';

function scrollableTable(): string {
  const rows: string[] = [];
  for (let r = 1; r <= 18; r++) {
    const cells = [`<th>S-${String(r).padStart(3, '0')}</th>`];
    for (let c = 1; c <= 7; c++) cells.push(`<td>${(r * c) % 97}</td>`);
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  const head = ['<th>Sample</th>'];
  for (let c = 1; c <= 7; c++) head.push(`<th>M${c}</th>`);
  return `
    <div class="gs-scroll" style="max-height:240px; max-width:480px; overflow:auto; border:1px solid #ccc;">
      <table id="freeze-story-table" style="border-collapse:separate; border-spacing:0; --gs-freeze-bg:#eef2f7;">
        <thead><tr>${head.join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

const meta: Meta = {
  title: 'Features/Freeze panes (spec 014)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Sticky header row + frozen key column for large tables. Pure position: sticky, ' +
          'no DOM wrapping; teardown is byte-identical. (spec 014-navigation-and-analysis)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '560px';
    container.innerHTML = `<h2>Scroll the region</h2>${scrollableTable()}`;
    return container;
  },
};

export default meta;
type Story = StoryObj;

export const StickyHeaderAndKeyColumn: Story = {
  name: 'apply tags header + key column with position:sticky; teardown is clean',
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const table = (await root.findByRole('table')) as HTMLTableElement;

    const before = table.outerHTML;
    applyFreezePanes(table);

    // Header band is sticky.
    const headerCell = table.tHead!.rows[0].cells[1];
    expect(headerCell.classList.contains('gs-freeze-header')).toBe(true);
    expect(getComputedStyle(headerCell).position).toBe('sticky');

    // Key column is sticky.
    const keyCell = table.tBodies[0].rows[0].cells[0];
    expect(keyCell.classList.contains('gs-freeze-col')).toBe(true);
    expect(getComputedStyle(keyCell).position).toBe('sticky');

    // Corner carries both classes and sits above the rest.
    const corner = table.tHead!.rows[0].cells[0];
    expect(corner.classList.contains('gs-freeze-header')).toBe(true);
    expect(corner.classList.contains('gs-freeze-col')).toBe(true);

    // Teardown restores the original markup.
    removeFreezePanes(table);
    expect(table.outerHTML).toBe(before);
  },
};
