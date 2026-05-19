import type { Meta, StoryObj } from '@storybook/html';
import { expect, waitFor, within } from '@storybook/test';
import { mountTogglePanel, unmountTogglePanel } from '../ui/toggle-panel';
import { setPageConfig, setVisitorOverride } from '../core/enabled-set-state';
import { ENRICHMENT_REGISTRY } from '../core/enrichment-registry';

const meta: Meta = {
  title: 'Spec 012 / Toggle Panel',
  render: () => {
    // Reset state between stories.
    setVisitorOverride(undefined);
    setPageConfig({ enrichments: undefined, showToggleUi: true });
    unmountTogglePanel();

    const container = document.createElement('div');
    container.style.padding = '20px';
    container.innerHTML = `
      <div data-gs-toggle-panel id="panel-slot"></div>
      <table id="story-table" style="margin-top:24px; border-collapse:collapse;">
        <tr><th></th><th>10</th><th>20</th></tr>
        <tr><th>1000</th><td>1</td><td>2</td></tr>
        <tr><th>2000</th><td>3</td><td>4</td></tr>
      </table>
    `;
    requestAnimationFrame(() => {
      const slot = container.querySelector<HTMLElement>('#panel-slot')!;
      mountTogglePanel(slot);
    });
    return container;
  },
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const RendersOneRowPerRegisteredId: Story = {
  name: 'Renders one row per registered id',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const checkboxes = canvasElement.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(ENRICHMENT_REGISTRY.length);
    });
    // Each enrichment id is rendered.
    for (const e of ENRICHMENT_REGISTRY) {
      const cb = canvasElement.querySelector(`input[value="${e.id}"]`);
      expect(cb, `checkbox for "${e.id}" must exist`).not.toBeNull();
    }
    void canvas;
  },
};

export const CheckboxChangeUpdatesPersistedSet: Story = {
  name: 'Unticking heatmap removes it from persisted set',
  play: async () => {
    const heatmap = (await waitFor(() =>
      document.querySelector<HTMLInputElement>('#panel-slot input[value="heatmap"]')!
    )) as HTMLInputElement;
    expect(heatmap.checked).toBe(true);
    heatmap.checked = false;
    heatmap.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => {
      expect(location.hash).toMatch(/gs\.e=/);
      expect(location.hash).not.toMatch(/heatmap/);
    });
  },
};
