/**
 * Slider DOM control. Wraps `<input type="range" step="any">` with:
 *   - manual keyboard handling (arrow=1%, PgUp/Dn=10%, Home/End=endpoints)
 *   - RAF-throttled value handling
 *   - polite ARIA-live readout, rate-limited to 250 ms during drag
 * See research §R-2 / §R-7.
 */

const READOUT_RATE_MS = 250;

export interface SliderControlOptions {
  id: string;
  min: number;
  max: number;
  initial: number;
  label: string;
  unitSuffix?: string;
  axis?: 'row' | 'col' | 'threshold';
  onInput: (_value: number) => void;
  onChange?: (_value: number) => void;
  formatValue?: (_value: number) => string;
}

export interface SliderControlHandle {
  root: HTMLElement;
  input: HTMLInputElement;
  readoutInterpolated: HTMLSpanElement;
  readoutEquation: HTMLSpanElement | null;
  setEquationReadout(_text: string | null): void;
  setInterpolatedReadout(_text: string): void;
  setValue(value: number, opts?: { silent?: boolean }): void;
  getValue(): number;
  destroy(): void;
}

function defaultFormat(v: number): string {
  if (!isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 100) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

export function createSliderControl(opts: SliderControlOptions): SliderControlHandle {
  const root = document.createElement('div');
  root.setAttribute('data-gs-slider', '');
  if (opts.axis) root.setAttribute('data-gs-slider-axis', opts.axis);
  root.setAttribute('data-gs-slider-id', opts.id);

  const labelEl = document.createElement('label');
  labelEl.textContent = opts.label;
  labelEl.style.fontSize = '12px';
  labelEl.style.color = '#444';
  const inputId = `gs-slider-${opts.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  labelEl.setAttribute('for', inputId);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = inputId;
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = 'any';
  input.value = String(clamp(opts.initial, opts.min, opts.max));
  input.setAttribute('aria-label', opts.label);

  const readoutInterpolated = document.createElement('span');
  readoutInterpolated.setAttribute('data-gs-slider-readout', 'interpolated');
  readoutInterpolated.setAttribute('aria-live', 'polite');
  readoutInterpolated.setAttribute('role', 'status');
  readoutInterpolated.textContent = '—';

  const readoutLabelInterp = document.createElement('span');
  readoutLabelInterp.setAttribute('data-gs-slider-readout-label', 'interpolated');
  readoutLabelInterp.textContent = 'Interpolated:';

  root.appendChild(labelEl);
  root.appendChild(input);
  root.appendChild(readoutLabelInterp);
  root.appendChild(readoutInterpolated);

  // Equation readout is added on demand via setEquationReadout.
  let readoutEquation: HTMLSpanElement | null = null;
  let readoutEquationLabel: HTMLSpanElement | null = null;

  const formatValue = opts.formatValue ?? defaultFormat;

  // RAF throttling for the input handler.
  let pendingValue: number | null = null;
  let scheduled = false;
  let rafHandle: number | null = null;

  const fireInput = () => {
    scheduled = false;
    rafHandle = null;
    if (pendingValue !== null) {
      const v = pendingValue;
      pendingValue = null;
      opts.onInput(v);
    }
  };

  const scheduleInput = (value: number) => {
    pendingValue = value;
    if (scheduled) return;
    scheduled = true;
    rafHandle = requestAnimationFrame(fireInput);
  };

  // Live-region rate limiting.
  let lastAnnouncementAt = 0;
  let lastAnnouncedText = '';
  const updateLiveRegion = (text: string, force = false) => {
    const now = Date.now();
    if (!force && now - lastAnnouncementAt < READOUT_RATE_MS) {
      // Mute the live region temporarily by writing aria-live="off" via the parent.
      // Simpler: just write only periodically.
      return;
    }
    if (text !== lastAnnouncedText) {
      readoutInterpolated.textContent = text;
      lastAnnouncedText = text;
      lastAnnouncementAt = now;
    }
  };

  const onInputEvent = () => {
    const v = parseFloat(input.value);
    if (!isFinite(v)) return;
    scheduleInput(v);
  };

  const onChangeEvent = () => {
    const v = parseFloat(input.value);
    if (!isFinite(v)) return;
    if (opts.onChange) opts.onChange(v);
  };

  // Keyboard: spec calls for 1% / 10% / endpoint steps regardless of native step.
  const computeKeyTarget = (key: string, cur: number, min: number, max: number): number | null => {
    const range = max - min;
    const step1 = range * 0.01;
    const step10 = range * 0.1;
    const map: Record<string, number> = {
      ArrowRight: cur + step1,
      ArrowUp: cur + step1,
      ArrowLeft: cur - step1,
      ArrowDown: cur - step1,
      PageUp: cur + step10,
      PageDown: cur - step10,
      Home: min,
      End: max,
    };
    return key in map ? map[key] : null;
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    if (max - min <= 0) return;
    const cur = parseFloat(input.value);
    let next = computeKeyTarget(ev.key, cur, min, max);
    if (next === null) {
      return;
    }
    ev.preventDefault();
    next = clamp(next, min, max);
    input.value = String(next);
    scheduleInput(next);
    if (opts.onChange) opts.onChange(next);
  };

  input.addEventListener('input', onInputEvent);
  input.addEventListener('change', onChangeEvent);
  input.addEventListener('keydown', onKeyDown);

  const handle: SliderControlHandle = {
    root,
    input,
    readoutInterpolated,
    get readoutEquation() {
      return readoutEquation;
    },
    setInterpolatedReadout(text: string) {
      const suffix = opts.unitSuffix ? ' ' + opts.unitSuffix : '';
      const finalText = text === '—' ? text : text + suffix;
      updateLiveRegion(finalText);
    },
    setEquationReadout(text: string | null) {
      if (text === null) {
        if (readoutEquation) {
          readoutEquation.remove();
          readoutEquation = null;
        }
        if (readoutEquationLabel) {
          readoutEquationLabel.remove();
          readoutEquationLabel = null;
        }
        return;
      }
      if (!readoutEquation) {
        readoutEquationLabel = document.createElement('span');
        readoutEquationLabel.setAttribute('data-gs-slider-readout-label', 'equation');
        readoutEquationLabel.textContent = 'From equation:';
        readoutEquation = document.createElement('span');
        readoutEquation.setAttribute('data-gs-slider-readout', 'equation');
        readoutEquation.setAttribute('aria-live', 'polite');
        readoutEquation.setAttribute('role', 'status');
        root.appendChild(readoutEquationLabel);
        root.appendChild(readoutEquation);
      }
      const suffix = opts.unitSuffix ? ' ' + opts.unitSuffix : '';
      readoutEquation.textContent = text === '—' ? text : text + suffix;
    },
    setValue(value: number, options) {
      const v = clamp(value, parseFloat(input.min), parseFloat(input.max));
      input.value = String(v);
      if (!options?.silent) {
        scheduleInput(v);
      } else {
        // Silent: still keep last reported value in sync without firing onInput.
        pendingValue = null;
      }
    },
    getValue() {
      return parseFloat(input.value);
    },
    destroy() {
      input.removeEventListener('input', onInputEvent);
      input.removeEventListener('change', onChangeEvent);
      input.removeEventListener('keydown', onKeyDown);
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      root.remove();
    },
  };

  // Initial readout: format with the formatter (interpolated text comes from caller later).
  // Caller is expected to call setInterpolatedReadout once it has the initial interpolated value.
  void formatValue; // formatter passed for caller use; default provided
  return handle;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Default value formatter (exposed for tests/consumers). */
export const formatNumber = defaultFormat;
