import { describe, it, expect, beforeEach } from 'vitest';
import '../../enrichments/sort';
import { setFilter, clearFilters, teardown } from '../../utils/visible-rows';
import { numericRange, categoricalInclusion } from '../filter';
import { mountFilterChip, unmountFilterChip } from '../filter-chip';

function tableWith(rows: readonly (readonly string[])[]): HTMLTableElement {
  const t = document.createElement('table');
  t.id = `tbl-${Math.random().toString(36).slice(2)}`;
  const hr = t.createTHead().insertRow();
  hr.insertCell().textContent = 'Amount';
  hr.insertCell().textContent = 'Region';
  const tb = t.createTBody();
  for (const r of rows) {
    const tr = tb.insertRow();
    for (const c of r) tr.insertCell().textContent = c;
  }
  document.body.appendChild(t);
  return t;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('filter-chip', () => {
  it('mounts a chip container after the table', () => {
    const t = tableWith([['10', 'EU']]);
    mountFilterChip(t);
    expect(t.nextSibling).toBeInstanceOf(HTMLElement);
    expect((t.nextSibling as HTMLElement).className).toBe('gs-filter-chip-container');
  });

  it('lists one chip per active filter and removes the chip when no filters remain', () => {
    const t = tableWith([['10', 'EU'], ['20', 'US']]);
    mountFilterChip(t);
    setFilter(t, 0, numericRange({ columnIndex: 0, columnKey: 'amount', min: 15, max: null, hideEmpty: false }));
    setFilter(t, 1, categoricalInclusion({ columnIndex: 1, columnKey: 'region', allowed: ['US'], hideEmpty: false }));
    const container = t.nextSibling as HTMLElement;
    expect(container.querySelectorAll('.gs-filter-chip').length).toBe(2);
    expect(container.querySelector('.gs-filter-chip__clear-all')).not.toBeNull();
    clearFilters(t);
    expect(container.querySelectorAll('.gs-filter-chip').length).toBe(0);
  });

  it('renders the empty-state message when no row is visible', () => {
    const t = tableWith([['10', 'EU']]);
    mountFilterChip(t);
    setFilter(t, 0, numericRange({ columnIndex: 0, columnKey: 'amount', min: 1000, max: null, hideEmpty: false }));
    const container = t.nextSibling as HTMLElement;
    expect(container.querySelector('.gs-filter-empty-state')?.textContent).toContain('No rows match');
  });

  it('per-chip remove restores that column', () => {
    const t = tableWith([['10', 'EU'], ['20', 'US']]);
    mountFilterChip(t);
    setFilter(t, 0, numericRange({ columnIndex: 0, columnKey: 'amount', min: 15, max: null, hideEmpty: false }));
    const container = t.nextSibling as HTMLElement;
    const removeBtn = container.querySelector<HTMLButtonElement>('.gs-filter-chip__remove');
    expect(removeBtn).not.toBeNull();
    removeBtn!.click();
    expect(container.querySelectorAll('.gs-filter-chip').length).toBe(0);
  });

  it('unmount removes container and stops updating', () => {
    const t = tableWith([['10', 'EU']]);
    mountFilterChip(t);
    unmountFilterChip(t);
    expect(t.nextSibling).toBeNull();
    teardown(t);
  });
});
