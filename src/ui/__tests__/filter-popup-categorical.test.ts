import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openCategoricalFilterPopup } from '../filter-popup-categorical';

let anchor: HTMLButtonElement;

beforeEach(() => {
  document.body.innerHTML = '';
  anchor = document.createElement('button');
  anchor.type = 'button';
  anchor.textContent = '▽';
  document.body.appendChild(anchor);
});

function openPopup(
  counts: ReadonlyMap<string, number> = new Map([['EU', 3], ['US', 2], ['JP', 1]]),
  current: { allowed: ReadonlySet<string>; hideEmpty: boolean } | null = null
) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  openCategoricalFilterPopup({
    anchorEl: anchor,
    columnIndex: 2,
    columnKey: 'region',
    current,
    valueCounts: counts,
    onApply,
    onClose,
  });
  const popup = document.querySelector('.gs-filter-popup--categorical') as HTMLElement;
  return { onApply, onClose, popup };
}

describe('openCategoricalFilterPopup', () => {
  it('renders one checkbox per value with count labels', () => {
    const { popup } = openPopup();
    const labels = popup.querySelectorAll<HTMLLabelElement>('.gs-filter-popup__list label');
    expect(labels.length).toBe(3);
    const texts = Array.from(labels).map((l) => l.textContent ?? '');
    expect(texts.some((t) => t.includes('EU (3)'))).toBe(true);
    expect(texts.some((t) => t.includes('US (2)'))).toBe(true);
    expect(texts.some((t) => t.includes('JP (1)'))).toBe(true);
  });

  it('initial selection: all checked when current is null', () => {
    const { popup } = openPopup();
    const checkboxes = popup.querySelectorAll<HTMLInputElement>('.gs-filter-popup__list input[type="checkbox"]');
    expect(Array.from(checkboxes).every((c) => c.checked)).toBe(true);
  });

  it('search narrows the displayed list without changing checkbox state', () => {
    const { popup } = openPopup();
    const search = popup.querySelector<HTMLInputElement>('.gs-filter-popup__search')!;
    search.value = 'eu';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const labels = popup.querySelectorAll<HTMLLabelElement>('.gs-filter-popup__list label');
    const visible = Array.from(labels).filter((l) => l.style.display !== 'none');
    expect(visible.length).toBe(1);
    expect((visible[0].textContent ?? '').toLowerCase()).toContain('eu');
    // All boxes still checked.
    const checked = popup.querySelectorAll<HTMLInputElement>('.gs-filter-popup__list input[type="checkbox"]');
    expect(Array.from(checked).every((c) => c.checked)).toBe(true);
  });

  it('Apply emits a categorical predicate restricted to checked items', () => {
    const { popup, onApply } = openPopup();
    const checkboxes = popup.querySelectorAll<HTMLInputElement>('.gs-filter-popup__list input[type="checkbox"]');
    // Uncheck JP and US — keep EU only.
    for (const cb of Array.from(checkboxes)) {
      if (cb.value !== 'EU') cb.checked = false;
    }
    const applyBtn = Array.from(popup.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'Apply')!;
    applyBtn.click();
    expect(onApply).toHaveBeenCalledTimes(1);
    const pred = onApply.mock.calls[0][0];
    expect(pred).not.toBeNull();
    expect(pred.toDirective()).toMatchObject({ kind: 'categorical', columnKey: 'region', allowed: ['EU'] });
  });

  it('"Select all" / "Select none" act only on currently-visible rows', () => {
    const { popup } = openPopup();
    // Narrow visibility to "EU".
    const search = popup.querySelector<HTMLInputElement>('.gs-filter-popup__search')!;
    search.value = 'eu';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    const noneBtn = Array.from(popup.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'Select none')!;
    noneBtn.click();

    // EU is unchecked; US / JP still checked because they were hidden.
    const checkboxes = popup.querySelectorAll<HTMLInputElement>('.gs-filter-popup__list input[type="checkbox"]');
    const byValue: Record<string, boolean> = {};
    for (const cb of Array.from(checkboxes)) byValue[cb.value] = cb.checked;
    expect(byValue['EU']).toBe(false);
    expect(byValue['US']).toBe(true);
    expect(byValue['JP']).toBe(true);
  });

  it('Escape closes the popup and fires onClose', () => {
    const { popup, onClose } = openPopup();
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.querySelector('.gs-filter-popup--categorical')).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('seeds selection from `current.allowed`', () => {
    const { popup } = openPopup(undefined, { allowed: new Set(['EU']), hideEmpty: false });
    const checkboxes = popup.querySelectorAll<HTMLInputElement>('.gs-filter-popup__list input[type="checkbox"]');
    const byValue: Record<string, boolean> = {};
    for (const cb of Array.from(checkboxes)) byValue[cb.value] = cb.checked;
    expect(byValue['EU']).toBe(true);
    expect(byValue['US']).toBe(false);
    expect(byValue['JP']).toBe(false);
  });
});
