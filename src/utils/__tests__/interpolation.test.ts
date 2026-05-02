import { describe, it, expect } from 'vitest';
import { linear1D, bilinear } from '../interpolation';

describe('linear1D', () => {
  const headers = [10, 20, 30, 40, 50];
  const values = [100, 200, 300, 400, 500];

  it('interpolates between two headers', () => {
    expect(linear1D(headers, values, 15)).toBe(150);
    expect(linear1D(headers, values, 25)).toBe(250);
  });

  it('returns exact cell value at header positions (FR-006)', () => {
    expect(linear1D(headers, values, 10)).toBe(100);
    expect(linear1D(headers, values, 30)).toBe(300);
    expect(linear1D(headers, values, 50)).toBe(500);
  });

  it('returns NaN for out-of-range x', () => {
    expect(linear1D(headers, values, 5)).toBeNaN();
    expect(linear1D(headers, values, 60)).toBeNaN();
  });

  it('handles non-uniform header spacing', () => {
    const h = [1000, 6000, 21000];
    const v = [10, 20, 50];
    expect(linear1D(h, v, 3500)).toBeCloseTo(15, 5);
    expect(linear1D(h, v, 13500)).toBeCloseTo(35, 5);
  });

  it('handles decreasing headers', () => {
    const h = [50, 40, 30, 20, 10];
    const v = [500, 400, 300, 200, 100];
    expect(linear1D(h, v, 25)).toBe(250);
    expect(linear1D(h, v, 50)).toBe(500);
  });

  it('returns NaN when interpolation hits a non-finite cell value', () => {
    const v = [100, NaN, 300, 400, 500];
    expect(linear1D(headers, v, 15)).toBeNaN();
    expect(linear1D(headers, v, 25)).toBeNaN();
    expect(linear1D(headers, v, 35)).toBe(350);
  });
});

describe('bilinear', () => {
  const rows = [10, 20, 30];
  const cols = [100, 200, 300];
  const matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  it('returns exact cell value at corners', () => {
    expect(bilinear(rows, cols, matrix, 10, 100)).toBe(1);
    expect(bilinear(rows, cols, matrix, 30, 300)).toBe(9);
  });

  it('interpolates the centre of a 2x2 cell', () => {
    expect(bilinear(rows, cols, matrix, 15, 150)).toBeCloseTo((1 + 2 + 4 + 5) / 4, 5);
  });

  it('returns NaN for out-of-range coordinates', () => {
    expect(bilinear(rows, cols, matrix, 5, 150)).toBeNaN();
    expect(bilinear(rows, cols, matrix, 15, 50)).toBeNaN();
  });

  it('returns NaN when surrounding matrix cell is missing', () => {
    const m = [
      [1, 2, 3],
      [4, NaN, 6],
      [7, 8, 9],
    ];
    expect(bilinear(rows, cols, m, 15, 150)).toBeNaN();
  });
});
