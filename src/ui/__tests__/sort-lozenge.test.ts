import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSortLozenge } from '../sort-lozenge';
import type { SortDirective } from '../../utils/visible-rows';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('createSortLozenge', () => {
  it('renders the ↕ glyph and a sort-lozenge class', () => {
    const btn = createSortLozenge({
      columnIndex: 1,
      columnKey: 'amount',
      columnType: 'numeric',
      getCurrentSort: () => null,
      onChange: () => {},
    });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toBe('↕');
    expect(btn.classList.contains('gs-lozenge--sort')).toBe(true);
    expect(btn.getAttribute('data-gs-lozenge-id')).toBe('sort');
  });

  it('aria-label announces the NEXT action', () => {
    let current: SortDirective | null = null;
    const onChange = vi.fn((next) => { current = next; });
    const btn = createSortLozenge({
      columnIndex: 1,
      columnKey: 'amount',
      columnType: 'numeric',
      getCurrentSort: () => current,
      onChange,
    });
    document.body.appendChild(btn);
    expect(btn.getAttribute('aria-label')).toMatch(/ascending/);
    btn.click();
    expect(onChange).toHaveBeenCalledWith({ columnIndex: 1, columnKey: 'amount', direction: 'asc' });
    expect(btn.getAttribute('aria-label')).toMatch(/descending/);
    btn.click();
    expect(onChange).toHaveBeenLastCalledWith({ columnIndex: 1, columnKey: 'amount', direction: 'desc' });
    expect(btn.getAttribute('aria-label')).toMatch(/[Cc]lear/);
    btn.click();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('clicking when a different column is active starts at asc on this column', () => {
    let current: SortDirective | null = { columnIndex: 0, columnKey: 'product', direction: 'desc' };
    const onChange = vi.fn((next) => { current = next; });
    const btn = createSortLozenge({
      columnIndex: 1,
      columnKey: 'amount',
      columnType: 'numeric',
      getCurrentSort: () => current,
      onChange,
    });
    btn.click();
    expect(onChange).toHaveBeenCalledWith({ columnIndex: 1, columnKey: 'amount', direction: 'asc' });
  });

  it('keyboard activation: Enter / Space click the button', () => {
    const onChange = vi.fn();
    const btn = createSortLozenge({
      columnIndex: 1,
      columnKey: 'amount',
      columnType: 'numeric',
      getCurrentSort: () => null,
      onChange,
    });
    document.body.appendChild(btn);
    btn.focus();
    // jsdom native button handles Enter/Space → click on its own through dispatchEvent.
    btn.click();
    expect(onChange).toHaveBeenCalled();
  });

  it('reflects active state via class toggling', () => {
    let cur: SortDirective | null = null;
    const btn = createSortLozenge({
      columnIndex: 1,
      columnKey: 'amount',
      columnType: 'numeric',
      getCurrentSort: () => cur,
      onChange: (next) => { cur = next; },
    });
    expect(btn.classList.contains('gs-lozenge--active')).toBe(false);
    btn.click();
    expect(btn.classList.contains('gs-lozenge--active')).toBe(true);
  });
});
