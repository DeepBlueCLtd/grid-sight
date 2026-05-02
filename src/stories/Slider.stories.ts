import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import { addSlider, getSliders, removeAllSliders } from '../enrichments/slider';

const meta: Meta = {
  title: 'Features/Dynamic Slider (US1)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Slider attached to a numeric axis. Drag the slider; the readout updates ' +
          'within one animation frame and matches a hand-computed linear ' +
          'interpolation at any chosen position. (spec 001-dynamic-sliders)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '720px';
    container.style.padding = '16px';
    container.innerHTML = `
      <h2>Range × SL lookup table</h2>
      <table id="slider-story-table" class="grid-sight-table">
        <tr><th></th>  <th>10</th><th>20</th><th>30</th><th>40</th><th>50</th></tr>
        <tr><th>1000</th> <td>4.2</td><td>5.1</td><td>5.9</td><td>6.4</td><td>6.7</td></tr>
        <tr><th>6000</th> <td>3.6</td><td>4.4</td><td>5.0</td><td>5.5</td><td>5.8</td></tr>
        <tr><th>11000</th><td>3.0</td><td>3.7</td><td>4.2</td><td>4.6</td><td>4.9</td></tr>
        <tr><th>16000</th><td>2.5</td><td>3.0</td><td>3.5</td><td>3.9</td><td>4.2</td></tr>
        <tr><th>21000</th><td>2.0</td><td>2.5</td><td>2.9</td><td>3.3</td><td>3.6</td></tr>
      </table>
    `;
    return container;
  },
};

export default meta;

type Story = StoryObj;

export const AddDragRemove: Story = {
  name: 'Add → drag → remove',
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const table = await root.findByRole('table');
    const tbl = table as HTMLTableElement;

    // 1. Cleanup state from prior story.
    removeAllSliders();

    // 2. Add a row-axis slider programmatically (the "+" menu does this; the story
    //    exercises the underlying API directly to keep the test deterministic).
    const slider = addSlider(tbl, 'row');
    expect(slider.kind).toBe('axis');
    expect(getSliders(tbl).length).toBe(1);

    // 3. Drag (programmatic) to a between-headers position and verify the readout updated.
    slider.setPosition(3500);
    const readout = canvasElement.querySelector('[data-gs-slider-readout="interpolated"]');
    expect(readout).not.toBeNull();
    expect(readout!.textContent).not.toBe('—');
    expect(readout!.textContent).not.toBe('');

    // 4. Remove and verify cleanup.
    slider.destroy();
    expect(getSliders(tbl).length).toBe(0);
    expect(canvasElement.querySelector('[data-gs-slider]')).toBeNull();
  },
};
