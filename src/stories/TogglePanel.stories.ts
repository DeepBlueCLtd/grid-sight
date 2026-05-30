import type { Meta, StoryObj } from '@storybook/html';
import { expect, waitFor } from '@storybook/test';
import { mountTogglePanel, unmountTogglePanel } from '../ui/toggle-panel';
import { setPageConfig, setVisitorOverride } from '../core/enabled-set-state';
import { SHIPPED_ENRICHMENTS } from '../core/enrichment-registry';

const meta: Meta = {
  title: 'Spec 012 / Toggle Panel',
  render: () => {
    // Reset state between stories.
    setVisitorOverride(undefined);
    setPageConfig({ enrichments: undefined, showToggleUi: true, tables: [] });
    unmountTogglePanel();
    // Clear any persisted URL/storage state from a previous story run.
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      history.replaceState(null, '', location.pathname + location.search);
    }

    const container = document.createElement('div');
    container.style.padding = '20px';
    container.innerHTML = `
      <div data-gs-toggle-panel class="gs-story-panel-slot"></div>
      <table style="margin-top:24px; border-collapse:collapse;">
        <tr><th></th><th>10</th><th>20</th></tr>
        <tr><th>1000</th><td>1</td><td>2</td></tr>
        <tr><th>2000</th><td>3</td><td>4</td></tr>
      </table>
    `;
    requestAnimationFrame(() => {
      const slot = container.querySelector<HTMLElement>('.gs-story-panel-slot');
      if (slot) mountTogglePanel(slot);
    });
    return container;
  },
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof meta>;

async function waitForCheckbox(
  canvasElement: HTMLElement,
  value: string
): Promise<HTMLInputElement> {
  return await waitFor(() => {
    const el = canvasElement.querySelector<HTMLInputElement>(
      `input[type="checkbox"][value="${value}"]`
    );
    if (!el) throw new Error(`checkbox for "${value}" not yet mounted`);
    return el;
  });
}

export const RendersOneRowPerShippedId: Story = {
  name: 'Renders one row per shipped enrichment id',
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const checkboxes = canvasElement.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(SHIPPED_ENRICHMENTS.length);
    });
    for (const e of SHIPPED_ENRICHMENTS) {
      const cb = canvasElement.querySelector(`input[value="${e.id}"]`);
      expect(cb, `checkbox for "${e.id}" must exist`).not.toBeNull();
    }
  },
};

export const CheckboxChangeUpdatesPersistedSet: Story = {
  name: 'Unticking heatmap removes it from persisted set',
  play: async ({ canvasElement }) => {
    const heatmap = await waitForCheckbox(canvasElement, 'heatmap');
    expect(heatmap.checked).toBe(true);
    heatmap.checked = false;
    heatmap.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => {
      expect(location.hash).toMatch(/gs\.e=/);
      expect(location.hash).not.toMatch(/heatmap/);
    });
  },
};
