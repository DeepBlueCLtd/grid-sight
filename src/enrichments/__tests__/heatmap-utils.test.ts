import { describe, it, expect } from 'vitest';
import { getColorForValue, normalizeValue } from '../heatmap-utils';

describe('Heatmap Utils', () => {
  describe('normalizeValue', () => {
    it('should normalize a value within range', () => {
      expect(normalizeValue(5, 0, 10)).toBe(0.5);
      expect(normalizeValue(2, 0, 10)).toBe(0.2);
      expect(normalizeValue(8, 0, 10)).toBe(0.8);
    });

    it('should handle min and max values', () => {
      expect(normalizeValue(0, 0, 10)).toBe(0);
      expect(normalizeValue(10, 0, 10)).toBe(1);
    });

    it('should handle values outside range', () => {
      expect(normalizeValue(-5, 0, 10)).toBe(0);
      expect(normalizeValue(15, 0, 10)).toBe(1);
    });

    it('should handle zero range', () => {
      expect(normalizeValue(5, 5, 5)).toBe(0);
    });
  });

  describe('getColorForValue', () => {
    const colorScale = ['#000000', '#888888', '#FFFFFF'];
    
    it('should return first color for min value', () => {
      expect(getColorForValue(0, 0, 1, colorScale)).toBe(colorScale[0]);
    });

    it('should return last color for max value', () => {
      expect(getColorForValue(1, 0, 1, colorScale)).toBe(colorScale[2]);
    });

    it('should return middle color for middle value', () => {
      expect(getColorForValue(0.5, 0, 1, colorScale)).toBe(colorScale[1]);
    });

    it('should handle custom min/max values', () => {
      expect(getColorForValue(50, 0, 100, colorScale)).toBe(colorScale[1]);
    });

    it('should handle values outside range', () => {
      expect(getColorForValue(-10, 0, 10, colorScale)).toBe(colorScale[0]);
      expect(getColorForValue(20, 0, 10, colorScale)).toBe(colorScale[2]);
    });
  });
});
