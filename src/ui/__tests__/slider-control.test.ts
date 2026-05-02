import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSliderControl } from '../slider-control';

beforeEach(() => {
  document.body.innerHTML = '';
  // Stub RAF to fire synchronously for determinism.
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  };
  (globalThis as any).cancelAnimationFrame = () => undefined;
});

function fireKey(input: HTMLInputElement, key: string) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  input.dispatchEvent(ev);
}

function fireInputEvent(input: HTMLInputElement, value: number) {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('createSliderControl', () => {
  it('renders an <input type="range" step="any"> with ARIA label', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't1', min: 0, max: 100, initial: 50, label: 'Test', onInput });
    expect(h.input.tagName).toBe('INPUT');
    expect(h.input.type).toBe('range');
    expect(h.input.step).toBe('any');
    expect(h.input.min).toBe('0');
    expect(h.input.max).toBe('100');
    expect(h.input.getAttribute('aria-label')).toBe('Test');
    expect(h.root.getAttribute('data-gs-slider')).toBe('');
  });

  it('fires onInput with the new value on input event', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't2', min: 0, max: 100, initial: 0, label: 'X', onInput });
    document.body.appendChild(h.root);
    fireInputEvent(h.input, 42);
    expect(onInput).toHaveBeenCalledWith(42);
  });

  it('keyboard: arrow keys step by 1% of range', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't3', min: 0, max: 100, initial: 50, label: 'X', onInput });
    document.body.appendChild(h.root);
    fireKey(h.input, 'ArrowRight');
    // 1% of 100 = 1; new value should be 51
    expect(onInput).toHaveBeenLastCalledWith(51);
    fireKey(h.input, 'ArrowLeft');
    expect(onInput).toHaveBeenLastCalledWith(50);
  });

  it('keyboard: PageUp/PageDown step by 10%', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't4', min: 0, max: 100, initial: 50, label: 'X', onInput });
    document.body.appendChild(h.root);
    fireKey(h.input, 'PageUp');
    expect(onInput).toHaveBeenLastCalledWith(60);
    fireKey(h.input, 'PageDown');
    expect(onInput).toHaveBeenLastCalledWith(50);
  });

  it('keyboard: Home/End jump to endpoints', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't5', min: 10, max: 90, initial: 50, label: 'X', onInput });
    document.body.appendChild(h.root);
    fireKey(h.input, 'Home');
    expect(onInput).toHaveBeenLastCalledWith(10);
    fireKey(h.input, 'End');
    expect(onInput).toHaveBeenLastCalledWith(90);
  });

  it('keyboard input is clamped to [min,max]', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't6', min: 0, max: 100, initial: 99, label: 'X', onInput });
    document.body.appendChild(h.root);
    fireKey(h.input, 'PageUp'); // 99 + 10 = 109 → clamp 100
    expect(onInput).toHaveBeenLastCalledWith(100);
  });

  it('exposes ARIA-live readout span', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't7', min: 0, max: 1, initial: 0, label: 'X', onInput });
    expect(h.readoutInterpolated.getAttribute('aria-live')).toBe('polite');
    expect(h.readoutInterpolated.getAttribute('data-gs-slider-readout')).toBe('interpolated');
  });

  it('setEquationReadout adds and removes the equation readout span', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't8', min: 0, max: 1, initial: 0, label: 'X', onInput });
    expect(h.readoutEquation).toBeNull();
    h.setEquationReadout('5');
    expect(h.readoutEquation).not.toBeNull();
    expect(h.root.querySelector('[data-gs-slider-readout="equation"]')?.textContent).toContain('5');
    h.setEquationReadout(null);
    expect(h.readoutEquation).toBeNull();
  });

  it('destroy() removes the DOM and listeners', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 't9', min: 0, max: 1, initial: 0, label: 'X', onInput });
    document.body.appendChild(h.root);
    h.destroy();
    expect(document.body.contains(h.root)).toBe(false);
    fireInputEvent(h.input, 0.5);
    expect(onInput).not.toHaveBeenCalled();
  });

  it('rate-limits live-region updates', () => {
    const onInput = vi.fn();
    const h = createSliderControl({ id: 'tA', min: 0, max: 100, initial: 0, label: 'X', onInput });
    h.setInterpolatedReadout('1');
    h.setInterpolatedReadout('2'); // suppressed (within 250 ms)
    expect(h.readoutInterpolated.textContent).toBe('1');
  });
});
