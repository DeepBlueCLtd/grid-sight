import { describe, it, expect } from 'vitest';
import { buildSparklineSvg } from '../sparkline-svg';

describe('buildSparklineSvg', () => {
  it('returns an SVG with N <rect> children for N inputs', () => {
    const svg = buildSparklineSvg([1, 2, 3, 4]);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.querySelectorAll('rect').length).toBe(4);
  });

  it('respects the viewBox', () => {
    const svg = buildSparklineSvg([1, 2], 100, 20);
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 20');
  });

  it('renders a flat baseline for an all-zero row', () => {
    const svg = buildSparklineSvg([0, 0, 0], 30, 10);
    const rects = svg.querySelectorAll('rect');
    rects.forEach((r) => {
      expect(r.getAttribute('height')).toBe('1');
    });
  });

  it('scales bars proportionally with per-row max', () => {
    const svg = buildSparklineSvg([1, 2, 4], 12, 16);
    const rects = svg.querySelectorAll('rect');
    const heights = Array.from(rects).map((r) => parseFloat(r.getAttribute('height') || '0'));
    // Tallest should be the 3rd bar (value 4).
    expect(heights[2]).toBeGreaterThanOrEqual(heights[1]);
    expect(heights[1]).toBeGreaterThanOrEqual(heights[0]);
  });

  it('uses createElementNS — no innerHTML / templates', () => {
    const svg = buildSparklineSvg([1, 2, 3]);
    // SVG namespace check
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('produces an empty svg when every value is null', () => {
    const svg = buildSparklineSvg([null, null, null]);
    expect(svg.querySelectorAll('rect').length).toBe(0);
  });
});
