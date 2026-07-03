import { describe, it, expect } from 'vitest';
import { evalBlock, headerRange } from '../twin-interp';

const SUMMER_ROWS = [30, 40, 50, 60, 70, 80];
const WINTER_ROWS = [20, 30, 40, 60];
const COLS = [0, 45, 90, 135, 180];
// Simple ascending matrices so interpolation is easy to reason about.
const summer = SUMMER_ROWS.map((_, i) => COLS.map((_, j) => i * 10 + j));
const winter = WINTER_ROWS.map((_, i) => COLS.map((_, j) => 100 + i * 10 + j));

describe('evalBlock', () => {
  it('interpolates within range', () => {
    // Speed 35 (between rows 30/40 ⇒ i=0), Dir 22.5 (between cols 0/45 ⇒ j=0).
    const e = evalBlock(SUMMER_ROWS, COLS, summer, 35, 22.5);
    expect(e.inRange).toBe(true);
    expect(e.rowBracket).toEqual([0, 1]);
    expect(e.colBracket).toEqual([0, 1]);
    // corners 0,1,10,11 → bilinear at midpoints = 5.5
    expect(e.value).toBeCloseTo(5.5, 6);
  });

  it('is out of range above the block max', () => {
    // 70 is inside Summer (30–80) but outside Winter (20–60).
    const e = evalBlock(WINTER_ROWS, COLS, winter, 70, 45);
    expect(e.inRange).toBe(false);
    expect(Number.isNaN(e.value)).toBe(true);
    expect(e.rowBracket).toBeNull();
  });

  it('is out of range below the block min', () => {
    // 25 is inside Winter (20–60) but outside Summer (30–80).
    const e = evalBlock(SUMMER_ROWS, COLS, summer, 25, 45);
    expect(e.inRange).toBe(false);
    expect(e.rowBracket).toBeNull();
  });

  it('both blocks are in range within the overlap (30–60)', () => {
    const s = evalBlock(SUMMER_ROWS, COLS, summer, 45, 45);
    const w = evalBlock(WINTER_ROWS, COLS, winter, 45, 45);
    expect(s.inRange).toBe(true);
    expect(w.inRange).toBe(true);
  });

  it('exact header hit interpolates to the literal cell', () => {
    const e = evalBlock(SUMMER_ROWS, COLS, summer, 50, 90); // row i=2, col j=2 → value 22
    expect(e.inRange).toBe(true);
    expect(e.value).toBeCloseTo(22, 6);
  });
});

describe('headerRange', () => {
  it('returns inclusive min/max regardless of order', () => {
    expect(headerRange([30, 40, 80, 50])).toEqual([30, 80]);
    expect(headerRange([60, 20, 40, 30])).toEqual([20, 60]);
  });
});
