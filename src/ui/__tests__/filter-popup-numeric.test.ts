import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openNumericFilterPopup } from '../filter-popup-numeric';

let anchor: HTMLButtonElement;

beforeEach(() => {
  document.body.innerHTML = '';
  anchor = document.createElement('button');
  anchor.type = 'button';
  anchor.textContent = '▽';
  document.body.appendChild(anchor);
});

function openPopup(overrides: Partial<Parameters<typeof openNumericFilterPopup>[0]> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const dispose = openNumericFilterPopup({
    anchorEl: anchor,
    columnIndex: 1,
    columnKey: 'amount',
    current: null,
    onApply,
    onClose,
    ...overrides,
  });
  return { onApply, onClose, dispose };
}

describe('openNumericFilterPopup', () => {
  it('renders inputs for Min, Max and a "Hide empty cells" checkbox', () => {
    openPopup();
    const popup = document.querySelector('.gs-filter-popup--numeric') as HTMLElement;
    expect(popup).not.toBeNull();
    expect(popup.querySelectorAll('input[type="number"]').length).toBe(2);
    expect(popup.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('Apply emits a predicate built from the input values', () => {
    const { onApply } = openPopup();
    const popup = document.querySelector('.gs-filter-popup--numeric') as HTMLElement;
    const [minInput, maxInput] = Array.from(popup.querySelectorAll<HTMLInputElement>('input[type="number"]'));
    minInput.value = '100';
    maxInput.value = '500';
    const applyBtn = Array.from(popup.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'Apply')!;
    applyBtn.click();
    expect(onApply).toHaveBeenCalledTimes(1);
    const pred = onApply.mock.calls[0][0];
    expect(pred).not.toBeNull();
    expect(pred.toDirective()).toEqual({
      kind: 'numeric-range',
      columnKey: 'amount',
      min: 100,
      max: 500,
      hideEmpty: false,
    });
  });

  it('Clear button emits null', () => {
    const { onApply } = openPopup();
    const popup = document.querySelector('.gs-filter-popup--numeric') as HTMLElement;
    const clearBtn = Array.from(popup.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'Clear')!;
    clearBtn.click();
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('Escape closes the popup and fires onClose', () => {
    const { onClose } = openPopup();
    const popup = document.querySelector('.gs-filter-popup--numeric') as HTMLElement;
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.querySelector('.gs-filter-popup--numeric')).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('hideEmpty checkbox is forwarded into the predicate', () => {
    const { onApply } = openPopup();
    const popup = document.querySelector('.gs-filter-popup--numeric') as HTMLElement;
    const hide = popup.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    hide.checked = true;
    const applyBtn = Array.from(popup.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'Apply')!;
    applyBtn.click();
    expect(onApply.mock.calls[0][0].toDirective().hideEmpty).toBe(true);
  });

  it('seeds Min / Max / hideEmpty from `current`', () => {
    openPopup({ current: { min: 10, max: 20, hideEmpty: true } });
    const popup = document.querySelector('.gs-filter-popup--numeric') as HTMLElement;
    const [minInput, maxInput] = Array.from(popup.querySelectorAll<HTMLInputElement>('input[type="number"]'));
    const hide = popup.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(minInput.value).toBe('10');
    expect(maxInput.value).toBe('20');
    expect(hide.checked).toBe(true);
  });
});
