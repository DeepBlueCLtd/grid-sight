import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import { addSlider, getSliders, removeAllSliders } from '../enrichments/slider';

const meta: Meta = {
  title: 'Features/Slider Sync (US3)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Two tables on the same page whose numeric axis headers match auto-sync. ' +
          'Moving a slider on one table moves the matching slider on the other. ' +
          '(spec 001-dynamic-sliders, FR-010 / FR-023)',
      },
    },
  },
  render: () => {
    const c = document.createElement('div');
    c.style.padding = '12px';
    c.innerHTML = `
      <h2>Synced tables (matching row headers)</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <table id="story-A" class="grid-sight-table">
          <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
          <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
          <tr><th>2000</th><td>4</td><td>5</td><td>6</td></tr>
          <tr><th>3000</th><td>7</td><td>8</td><td>9</td></tr>
        </table>
        <table id="story-B" class="grid-sight-table">
          <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
          <tr><th>1000</th><td>10</td><td>20</td><td>30</td></tr>
          <tr><th>2000</th><td>40</td><td>50</td><td>60</td></tr>
          <tr><th>3000</th><td>70</td><td>80</td><td>90</td></tr>
        </table>
      </div>
    `;
    return c;
  },
};

export default meta;

type Story = StoryObj;

export const SyncedDrag: Story = {
  name: 'Drag A → B follows',
  play: async ({ canvasElement }) => {
    removeAllSliders();
    const root = within(canvasElement);
    void root;
    const a = canvasElement.querySelector('#story-A') as HTMLTableElement;
    const b = canvasElement.querySelector('#story-B') as HTMLTableElement;
    const sA = addSlider(a, 'row');
    const sB = addSlider(b, 'row');
    expect(sA.syncKey).toBe(sB.syncKey);
    sA.setPosition(2500);
    expect(sB.position).toBeCloseTo(2500, 5);
    // Cleanup so subsequent stories start fresh.
    removeAllSliders();
    expect(getSliders().length).toBe(0);
  },
};
