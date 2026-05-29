import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatisticsPopup } from '../statistics-popup';
import { calculateStatistics } from '../../enrichments/statistics';

let popup: StatisticsPopup;
let anchor: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  anchor = document.createElement('button');
  document.body.appendChild(anchor);
  popup = new StatisticsPopup();
});

afterEach(() => {
  popup.destroy();
});

function labels(): string[] {
  return Array.from(
    document.querySelectorAll('.gs-statistics-popup__stat-label'),
  ).map((e) => e.textContent ?? '');
}

describe('StatisticsPopup — spec 014 extension', () => {
  it('renders the new Missing / Distinct / Q1 / Q3 rows alongside the existing ones', () => {
    popup.show(calculateStatistics([1, 2, 2, 3, 4, 5, 5, 5, 9, 10], 2), anchor);
    const ls = labels();
    expect(ls).toContain('Missing');
    expect(ls).toContain('Distinct');
    expect(ls).toContain('Q1');
    expect(ls).toContain('Q3');
    // existing rows still present
    expect(ls).toContain('Median');
    expect(ls).toContain('Std Dev');
  });

  it('renders an inline SVG mini histogram with a <title> per bar', () => {
    const stats = calculateStatistics([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    popup.show(stats, anchor);
    const svg = document.querySelector('.gs-statistics-popup__histogram svg');
    expect(svg).not.toBeNull();
    const rects = svg!.querySelectorAll('rect');
    expect(rects.length).toBe(stats.histogram.length);
    for (const rect of Array.from(rects)) {
      const title = rect.querySelector('title');
      expect(title, 'each bar must carry a <title>').not.toBeNull();
      expect((title!.textContent ?? '').length).toBeGreaterThan(0);
    }
    // One upright value label per bin, plus bin-edge tick markers.
    expect(svg!.querySelectorAll('text').length).toBe(stats.histogram.length);
    expect(svg!.querySelectorAll('line').length).toBeGreaterThan(0);
  });

  it('shows the empty-state copy and no histogram when count is 0', () => {
    popup.show(calculateStatistics([], 4), anchor);
    const empty = document.querySelector('.gs-statistics-popup__empty');
    expect(empty?.textContent).toBe('No numeric values');
    expect(document.querySelector('.gs-statistics-popup__histogram')).toBeNull();
    // The missing figure still surfaces in the empty state.
    expect(labels()).toContain('Missing');
  });

  it('never renders NaN text (empty state shows N/A or nothing, not NaN)', () => {
    popup.show(calculateStatistics([], 4), anchor);
    const content = document.querySelector('.gs-statistics-popup__content')!;
    expect(content.textContent).not.toMatch(/NaN/);
  });
});
