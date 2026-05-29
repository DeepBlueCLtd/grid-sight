import { describe, it, expect, beforeEach } from 'vitest';
import { openOutlierPopup } from '../outlier-popup';
import type { OutlierMark } from '../../enrichments/outlier-marks';

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Build a table whose rows we can reference from marks, plus a lozenge anchor. */
function scaffold(): { table: HTMLTableElement; anchor: HTMLButtonElement } {
  const table = document.createElement('table');
  table.innerHTML = `
    <thead><tr><th>Label</th><th>Val</th></tr></thead>
    <tbody>
      <tr data-r="a"><th>a</th><td>10</td></tr>
      <tr data-r="big"><th>big</th><td>99</td></tr>
      <tr data-r="b"><th>b</th><td>20</td></tr>
      <tr data-r="small"><th>small</th><td>30</td></tr>
    </tbody>`;
  document.body.appendChild(table);
  const anchor = document.createElement('button');
  anchor.textContent = '!';
  document.body.appendChild(anchor);
  return { table, anchor };
}

function markFor(table: HTMLTableElement, r: string, value: number, sigmaDistance: number): OutlierMark {
  const cell = table.querySelector(`tr[data-r="${r}"] td`) as HTMLTableCellElement;
  return { cell, rowLabel: r, value, sigmaDistance };
}

describe('openOutlierPopup', () => {
  it('renders a labelled dialog listing entries by descending |σ| (doc-order ties)', () => {
    const { table, anchor } = scaffold();
    const marks: OutlierMark[] = [
      markFor(table, 'a', 10, 2),
      markFor(table, 'big', 99, -3),
      markFor(table, 'b', 20, -2),
      markFor(table, 'small', 30, 1),
    ];
    openOutlierPopup({
      table,
      columnIndex: 1,
      columnLabel: 'Latency',
      threshold: 1,
      anchor,
      getMarks: () => marks,
    });

    const popup = document.querySelector('.gs-outlier-popup')!;
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-label')).toBe("Outliers in column 'Latency' at 1σ");

    const labels = Array.from(popup.querySelectorAll('.gs-outlier-popup__label')).map(
      (el) => (el.textContent ?? '').split(' — ')[0],
    );
    // |σ|: big=3, a=2, b=2, small=1 → big, a, b, small (a before b: doc-order tie).
    expect(labels).toEqual(['big', 'a', 'b', 'small']);
  });

  it('activating an entry highlights its row and keeps the popup open (FR-013)', () => {
    const { table, anchor } = scaffold();
    const marks = [markFor(table, 'big', 99, -3)];
    openOutlierPopup({
      table,
      columnIndex: 1,
      columnLabel: 'Latency',
      threshold: 1,
      anchor,
      getMarks: () => marks,
    });
    const entry = document.querySelector('.gs-outlier-popup__entry') as HTMLButtonElement;
    entry.click();
    const row = table.querySelector('tr[data-r="big"]')!;
    expect(row.classList.contains('gs-outlier-row-highlight')).toBe(true);
    // Popup remains open.
    expect(document.querySelector('.gs-outlier-popup')).not.toBeNull();
  });

  it('Escape closes the popup and returns focus to the anchor (FR-014/FR-020)', () => {
    const { table, anchor } = scaffold();
    const marks = [markFor(table, 'big', 99, -3)];
    openOutlierPopup({
      table,
      columnIndex: 1,
      columnLabel: 'Latency',
      threshold: 1,
      anchor,
      getMarks: () => marks,
    });
    const popup = document.querySelector('.gs-outlier-popup') as HTMLElement;
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.gs-outlier-popup')).toBeNull();
    expect(document.activeElement).toBe(anchor);
  });

  it('outside-click closes the popup', async () => {
    const { table, anchor } = scaffold();
    const marks = [markFor(table, 'big', 99, -3)];
    const dispose = openOutlierPopup({
      table,
      columnIndex: 1,
      columnLabel: 'Latency',
      threshold: 1,
      anchor,
      getMarks: () => marks,
    });
    // The outside-click listener is attached on a 0ms timeout.
    await new Promise((r) => setTimeout(r, 5));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.querySelector('.gs-outlier-popup')).toBeNull();
    // dispose() is idempotent after an outside-click close.
    expect(() => dispose()).not.toThrow();
  });
});
