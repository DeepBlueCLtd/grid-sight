import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openFindBox } from '../find-in-table-box';

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.innerHTML =
    '<thead><tr><th>Name</th><th>Role</th></tr></thead>' +
    '<tbody>' +
    '<tr><td>Alice</td><td>admin</td></tr>' +
    '<tr><td>Bob</td><td>ADMIN</td></tr>' +
    '<tr><td>Carol</td><td>user</td></tr>' +
    '<tr><td>Dave</td><td>admin</td></tr>' +
    '</tbody>';
  document.body.appendChild(t);
  return t;
}

function anchorButton(): HTMLButtonElement {
  const b = document.createElement('button');
  document.body.appendChild(b);
  return b;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll('.gs-find-box').forEach((e) => e.remove());
});

function typeAndDebounce(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  vi.advanceTimersByTime(120);
}

describe('find-in-table box', () => {
  it('opens with the search input focused', () => {
    openFindBox(makeTable(), anchorButton());
    const input = document.querySelector('.gs-find-box input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('renders the counter as "N of M" after a debounced search', () => {
    openFindBox(makeTable(), anchorButton());
    const box = document.querySelector('.gs-find-box') as HTMLElement;
    typeAndDebounce(box.querySelector('input') as HTMLInputElement, 'admin');
    expect(box.querySelector('.gs-find-count')!.textContent).toBe('1 of 3');
  });

  it('renders "0 matches" when nothing matches', () => {
    openFindBox(makeTable(), anchorButton());
    const box = document.querySelector('.gs-find-box') as HTMLElement;
    typeAndDebounce(box.querySelector('input') as HTMLInputElement, 'zzz');
    expect(box.querySelector('.gs-find-count')!.textContent).toBe('0 matches');
  });

  it('Enter steps to the next match and updates the counter', () => {
    openFindBox(makeTable(), anchorButton());
    const box = document.querySelector('.gs-find-box') as HTMLElement;
    const input = box.querySelector('input') as HTMLInputElement;
    typeAndDebounce(input, 'admin');
    expect(box.querySelector('.gs-find-count')!.textContent).toBe('1 of 3');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(box.querySelector('.gs-find-count')!.textContent).toBe('2 of 3');
  });

  it('Escape closes the box and returns focus to the anchor (popup-chrome)', () => {
    const t = makeTable();
    const anchor = anchorButton();
    openFindBox(t, anchor);
    const box = document.querySelector('.gs-find-box') as HTMLElement;
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.gs-find-box')).toBeNull();
    expect(document.activeElement).toBe(anchor);
    // Highlights cleared on close.
    expect(t.querySelectorAll('.gs-find-match').length).toBe(0);
  });
});
