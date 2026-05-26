import { describe, it, expect, beforeEach } from 'vitest';
import {
  mountAffordance,
  renderMarker,
  clearMarker,
  removeAffordance,
} from '../annotation-affordance';

function makeCell(): HTMLTableCellElement {
  document.body.innerHTML = `<table><tbody><tr><td>1200</td></tr></tbody></table>`;
  return document.querySelector('td') as HTMLTableCellElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('mountAffordance', () => {
  it('adds a Tab-reachable pin button that activates on click', () => {
    const cell = makeCell();
    let activated = false;
    mountAffordance(cell, () => {
      activated = true;
    });
    const pin = cell.querySelector('.gs-annotation-pin') as HTMLButtonElement;
    expect(pin).not.toBeNull();
    expect(pin.tagName).toBe('BUTTON'); // natively focusable / Tab-reachable
    expect(pin.getAttribute('aria-label')).toBeTruthy();
    pin.click();
    expect(activated).toBe(true);
  });

  it('is idempotent (no duplicate pins)', () => {
    const cell = makeCell();
    mountAffordance(cell, () => {});
    mountAffordance(cell, () => {});
    expect(cell.querySelectorAll('.gs-annotation-pin')).toHaveLength(1);
  });

  it('shims the cell to position:relative via a class', () => {
    const cell = makeCell();
    mountAffordance(cell, () => {});
    expect(cell.classList.contains('gs-annotation-cell')).toBe(true);
  });
});

describe('renderMarker / clearMarker', () => {
  it('paints a marker with an accessible name and wires aria-describedby', () => {
    const cell = makeCell();
    renderMarker(cell, 'check this');
    const marker = cell.querySelector('.gs-annotation-marker') as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.getAttribute('aria-label')).toContain('check this');

    const describedById = cell.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const descNode = cell.querySelector(`#${describedById}`);
    expect(descNode?.textContent).toBe('check this');
  });

  it('clearMarker removes the marker and aria-describedby', () => {
    const cell = makeCell();
    renderMarker(cell, 'note');
    clearMarker(cell);
    expect(cell.querySelector('.gs-annotation-marker')).toBeNull();
    expect(cell.hasAttribute('aria-describedby')).toBe(false);
    expect(cell.querySelector('.gs-annotation-aria')).toBeNull();
  });

  it('marker click invokes the cell activator from mountAffordance', () => {
    const cell = makeCell();
    let count = 0;
    mountAffordance(cell, () => {
      count++;
    });
    renderMarker(cell, 'note');
    (cell.querySelector('.gs-annotation-marker') as HTMLButtonElement).click();
    expect(count).toBe(1);
  });
});

describe('removeAffordance', () => {
  it('restores a byte-identical cell', () => {
    const cell = makeCell();
    const snapshot = cell.outerHTML;
    mountAffordance(cell, () => {});
    renderMarker(cell, 'note');
    removeAffordance(cell);
    expect(cell.outerHTML).toBe(snapshot);
  });
});
