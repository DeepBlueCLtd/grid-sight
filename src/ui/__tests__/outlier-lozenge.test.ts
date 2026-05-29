import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOutlierLozenge, type OutlierLozengeArgs } from '../outlier-lozenge';
import type { OutlierThreshold } from '../../enrichments/outlier-marks';

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Build a lozenge whose `getCurrent` is backed by a mutable cell, with a spy
 *  `onChange` that writes the next value back (so refresh() sees the update). */
function makeLozenge(overrides: Partial<OutlierLozengeArgs> = {}) {
  let current: OutlierThreshold | null = overrides.getCurrent?.() ?? null;
  const onChange = vi.fn((next: OutlierThreshold | null) => {
    current = next;
  });
  const onShowList = vi.fn();
  const el = createOutlierLozenge({
    columnIndex: 1,
    columnKey: 'latency',
    inert: false,
    columnLabel: 'Latency',
    getCurrent: () => current,
    onChange,
    onShowList,
    ...overrides,
  });
  document.body.appendChild(el);
  const btn = el.querySelector<HTMLButtonElement>('[data-gs-lozenge-id="outlier"]')!;
  const listBtn = el.querySelector<HTMLButtonElement>('[data-gs-outlier-list]')!;
  return { el, btn, listBtn, onChange, onShowList, getCurrent: () => current };
}

describe('createOutlierLozenge — single activation (US1)', () => {
  it('renders the ! glyph with the outlier id and class', () => {
    const { btn } = makeLozenge();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toBe('!');
    expect(btn.classList.contains('gs-lozenge--outlier')).toBe(true);
    expect(btn.getAttribute('data-gs-lozenge-id')).toBe('outlier');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('idle accessible name describes the next action (2σ)', () => {
    const { btn } = makeLozenge();
    expect(btn.getAttribute('aria-label')).toBe("Mark outliers in column 'Latency' at 2σ");
  });

  it('first click activates 2σ and updates the glyph + aria-pressed', () => {
    const { btn, onChange } = makeLozenge();
    btn.click();
    expect(onChange).toHaveBeenCalledWith(2);
    expect(btn.textContent).toBe('!2');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toContain('at 2σ');
    expect(btn.getAttribute('aria-label')).toContain('click for 1σ');
  });
});

describe('createOutlierLozenge — full cycle (US2)', () => {
  it('cycles idle → 2 → 1 → 3 → idle with glyph + aria updates each step', () => {
    const { btn, onChange } = makeLozenge();
    btn.click();
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(btn.textContent).toBe('!2');

    btn.click();
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(btn.textContent).toBe('!1');
    expect(btn.getAttribute('aria-label')).toContain('click for 3σ');

    btn.click();
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(btn.textContent).toBe('!3');
    expect(btn.getAttribute('aria-label')).toContain('click to clear');

    btn.click();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(btn.textContent).toBe('!');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('createOutlierLozenge — inert (σ = 0, FR-009)', () => {
  it('click is a no-op and the title explains why', () => {
    const { btn, onChange } = makeLozenge({ inert: true });
    expect(btn.title).toBe('All values equal; no outliers to flag');
    btn.click();
    expect(onChange).not.toHaveBeenCalled();
    expect(btn.textContent).toBe('!');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('createOutlierLozenge — secondary affordance (US3, FR-011)', () => {
  it('the list button is hidden while idle and shown while active', () => {
    const { btn, listBtn } = makeLozenge();
    expect(listBtn.style.display).toBe('none');
    btn.click(); // → 2σ
    expect(listBtn.style.display).toBe('');
  });

  it('clicking the list button invokes onShowList', () => {
    const { btn, listBtn, onShowList } = makeLozenge();
    btn.click(); // activate
    listBtn.click();
    expect(onShowList).toHaveBeenCalledTimes(1);
  });

  it('Shift+Enter on the lozenge opens the list when active', () => {
    const { btn, onShowList } = makeLozenge();
    btn.click(); // activate
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(onShowList).toHaveBeenCalledTimes(1);
  });

  it('Shift+Enter is a no-op while idle', () => {
    const { btn, onShowList } = makeLozenge();
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(onShowList).not.toHaveBeenCalled();
  });
});
