import type { Meta, StoryObj } from '@storybook/html';
import { addSlider, removeAllSliders } from '../enrichments/slider';
import { addThresholdSlider } from '../enrichments/slider-threshold';
import { ensureHeatmapMarkerListener, refreshHeatmapMarkers } from '../ui/heatmap-marker';
import { applyHeatmap } from '../enrichments/heatmap';
import { expect } from '@storybook/test';

const meta: Meta = {
  title: 'Features/Slider Heatmap (US4)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Dual-axis sliders drive a position marker over a heatmap-coloured table. ' +
          'A threshold slider fades cells whose value is below the slider position. ' +
          '(spec 001-dynamic-sliders, FR-015 / FR-024)',
      },
    },
  },
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.padding = '16px';
    wrap.innerHTML = `
      <h2>Heatmap with marker + threshold</h2>
      <div style="position:relative; max-width:600px;">
        <table id="story-heatmap" class="grid-sight-table">
          <tr><th></th>  <th>10</th><th>20</th><th>30</th><th>40</th><th>50</th></tr>
          <tr><th>1000</th> <td>4.2</td><td>5.1</td><td>5.9</td><td>6.4</td><td>6.7</td></tr>
          <tr><th>6000</th> <td>3.6</td><td>4.4</td><td>5.0</td><td>5.5</td><td>5.8</td></tr>
          <tr><th>11000</th><td>3.0</td><td>3.7</td><td>4.2</td><td>4.6</td><td>4.9</td></tr>
          <tr><th>16000</th><td>2.5</td><td>3.0</td><td>3.5</td><td>3.9</td><td>4.2</td></tr>
          <tr><th>21000</th><td>2.0</td><td>2.5</td><td>2.9</td><td>3.3</td><td>3.6</td></tr>
        </table>
      </div>
    `;
    return wrap;
  },
};

export default meta;
type Story = StoryObj;

export const MarkerAndThreshold: Story = {
  name: 'Dual-axis marker + threshold',
  play: async ({ canvasElement }) => {
    removeAllSliders();
    ensureHeatmapMarkerListener();
    const tbl = canvasElement.querySelector('#story-heatmap') as HTMLTableElement;
    // Heatmap colour the table so the threshold slider has cells to fade.
    applyHeatmap(tbl, 0, 'table');
    addSlider(tbl, 'row');
    addSlider(tbl, 'col');
    refreshHeatmapMarkers();
    const marker = canvasElement.querySelector('[data-gs-marker]');
    expect(marker).not.toBeNull();

    const t = addThresholdSlider(tbl);
    t.setPosition(4.0);
    const faded = tbl.querySelectorAll('[data-gs-cell-fade]');
    expect(faded.length).toBeGreaterThan(0);

    removeAllSliders();
  },
};
