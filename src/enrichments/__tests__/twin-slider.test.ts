import { describe, it, expect, beforeEach } from 'vitest';
import {
  enableTwinSliders,
  disableTwinSliders,
  isTwinSlidersActive,
} from '../twin-slider';

beforeEach(() => {
  document.body.innerHTML = '';
});

function twinTable(): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.innerHTML = `
    <thead>
      <tr><th>Season</th><th>Speed</th><th>000°</th><th>045°</th><th>090°</th><th>135°</th><th>180°</th></tr>
    </thead>
    <tbody>
      <tr><th rowspan="6">Summer</th><th>30</th><td>18.2</td><td>17.4</td><td>15.9</td><td>14.1</td><td>13.0</td></tr>
      <tr><th>40</th><td>16.8</td><td>16.0</td><td>14.6</td><td>12.9</td><td>11.8</td></tr>
      <tr><th>50</th><td>15.1</td><td>14.4</td><td>13.1</td><td>11.5</td><td>10.5</td></tr>
      <tr><th>60</th><td>13.3</td><td>12.7</td><td>11.5</td><td>10.0</td><td>9.1</td></tr>
      <tr><th>70</th><td>11.4</td><td>10.9</td><td>9.8</td><td>8.5</td><td>7.7</td></tr>
      <tr><th>80</th><td>9.6</td><td>9.1</td><td>8.2</td><td>7.0</td><td>6.3</td></tr>
      <tr><th rowspan="4">Winter</th><th>20</th><td>15.0</td><td>14.3</td><td>13.0</td><td>11.4</td><td>10.4</td></tr>
      <tr><th>30</th><td>13.6</td><td>12.9</td><td>11.7</td><td>10.2</td><td>9.2</td></tr>
      <tr><th>40</th><td>12.0</td><td>11.4</td><td>10.3</td><td>8.9</td><td>8.0</td></tr>
      <tr><th>60</th><td>8.7</td><td>8.2</td><td>7.3</td><td>6.2</td><td>5.5</td></tr>
    </tbody>
  `;
  document.body.appendChild(tbl);
  return tbl;
}

function speedInputs(tbl: HTMLTableElement): HTMLInputElement[] {
  return Array.from(tbl.querySelectorAll<HTMLInputElement>('input[data-gs-twin-input="speed"]'));
}
function setValue(input: HTMLInputElement, v: number): void {
  input.value = String(v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('twin-slider controller', () => {
  it('injects one shared direction slider and one speed slider per block', () => {
    const tbl = twinTable();
    expect(enableTwinSliders(tbl)).toBe(true);
    expect(isTwinSlidersActive(tbl)).toBe(true);
    expect(tbl.querySelectorAll('input[data-gs-twin-input="dir"]').length).toBe(1);
    expect(speedInputs(tbl).length).toBe(2);
    // Speed sliders carry each block's own range.
    const [summer, winter] = speedInputs(tbl);
    expect([summer.min, summer.max]).toEqual(['30', '80']);
    expect([winter.min, winter.max]).toEqual(['20', '60']);
  });

  it('initialises inside the overlap so both blocks are live', () => {
    const tbl = twinTable();
    enableTwinSliders(tbl);
    const [summer, winter] = speedInputs(tbl);
    expect(summer.disabled).toBe(false);
    expect(winter.disabled).toBe(false);
    // Both readouts show a value, not the em-dash.
    const readouts = tbl.querySelectorAll('.gs-twin-readout');
    for (const r of readouts) expect(r.textContent).not.toBe('—');
    // Four highlighted cells per live block.
    expect(tbl.querySelectorAll('.gs-slider-highlight').length).toBe(8);
  });

  it('syncs the shared speed across blocks within the overlap', () => {
    const tbl = twinTable();
    enableTwinSliders(tbl);
    const [summer, winter] = speedInputs(tbl);
    setValue(summer, 45);
    expect(winter.value).toBe('45'); // synced by value
    expect(summer.disabled).toBe(false);
    expect(winter.disabled).toBe(false);
  });

  it('disables the out-of-range block and clears its marker/readout', () => {
    const tbl = twinTable();
    enableTwinSliders(tbl);
    const [summer, winter] = speedInputs(tbl);
    setValue(summer, 70); // inside Summer, outside Winter (20–60)
    expect(summer.disabled).toBe(false);
    expect(winter.disabled).toBe(true);

    const winterReadout = winter.closest('[data-gs-twin-block-ui]')!.querySelector('.gs-twin-readout')!;
    expect(winterReadout.textContent).toBe('—');
    // Winter's block cells carry no highlight; Summer still has its 4.
    const winterRow = tbl.querySelectorAll('tbody tr')[9]; // last Winter row (60)
    expect(winterRow.querySelectorAll('.gs-slider-highlight').length).toBe(0);
    expect(tbl.querySelectorAll('.gs-slider-highlight').length).toBe(4);
  });

  it('re-enables the block when the speed returns to its range', () => {
    const tbl = twinTable();
    enableTwinSliders(tbl);
    const [summer, winter] = speedInputs(tbl);
    setValue(summer, 75);
    expect(winter.disabled).toBe(true);
    setValue(summer, 50);
    expect(winter.disabled).toBe(false);
    expect(winter.value).toBe('50');
  });

  it('tears down cleanly, restoring the group cell and removing highlights', () => {
    const tbl = twinTable();
    enableTwinSliders(tbl);
    disableTwinSliders(tbl);
    expect(isTwinSlidersActive(tbl)).toBe(false);
    expect(tbl.querySelectorAll('[data-gs-twin-input]').length).toBe(0);
    expect(tbl.querySelectorAll('[data-gs-twin-row]').length).toBe(0);
    expect(tbl.querySelectorAll('.gs-slider-highlight').length).toBe(0);
    // Group label text survives.
    expect(tbl.querySelector('th[rowspan="6"]')!.textContent).toContain('Summer');
  });
});
