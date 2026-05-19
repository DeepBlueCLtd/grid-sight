/**
 * Slider CSS injection — extracted from slider.ts so the orchestrator stays
 * under the file-size budget. Idempotent: guarded by `data-gs-slider-styles`.
 *
 * `style.css` is only loaded by the dev entry (`main.ts`); the published IIFE
 * built from `index.ts` does not pull it, so we ship slider styles by injecting
 * a `<style>` tag from JS.
 */

const SLIDER_CSS = `
[data-gs-slider] { display:flex; align-items:center; gap:8px; padding:4px 6px; font:13px/1.2 system-ui,sans-serif; }
[data-gs-slider][data-gs-slider-orientation="vertical"] { flex-direction:column; }

/* Horizontal slider — custom-styled. Fill the left portion up to the thumb
   so it matches the native fill the vertical slider already shows. The
   --gs-fill variable (0-100%) is updated by JS on input. */
[data-gs-slider] input[type="range"],
th[data-gs-col-slot] input[type="range"] {
  appearance: none; -webkit-appearance: none; outline: none; margin: 0;
  cursor: pointer; border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--gs-slider-fill-color, #1976d2) 0%,
    var(--gs-slider-fill-color, #1976d2) var(--gs-fill, 0%),
    #d0d0d0 var(--gs-fill, 0%),
    #d0d0d0 100%
  );
}
th[data-gs-col-slot] input[type="range"] { width: 100%; height: 4px; }

[data-gs-slider] input[type="range"]::-webkit-slider-thumb,
th[data-gs-col-slot] input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
  background: var(--gs-slider-thumb-color, #1976d2); cursor: pointer;
  border: 2px solid #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
}
[data-gs-slider] input[type="range"]::-moz-range-thumb,
th[data-gs-col-slot] input[type="range"]::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--gs-slider-thumb-color, #1976d2); cursor: pointer;
  border: 2px solid #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
}

/* Vertical slider — let the native renderer handle styling so the thumb
   and track stay aligned. \`writing-mode: vertical-lr\` is supported in
   all evergreen browsers ≤ 2 years old; legacy WebKit also accepts
   \`-webkit-appearance: slider-vertical\` as a fallback. */
th[data-gs-row-slot] input[type="range"] {
  -webkit-appearance: slider-vertical;
  appearance: slider-vertical;
  writing-mode: vertical-lr;
  height: 200px;
  width: 18px;
  margin: 0;
  cursor: pointer;
  outline: none;
  background: transparent;
}
th[data-gs-corner] { font-weight: 600; font-size: 14px; background: #f4f4f4; }
th[data-gs-corner] [data-gs-slider-readout="interpolated"],
th[data-gs-corner] [data-gs-slider-readout="equation"] { display: block; min-height: 1.2em; }
th[data-gs-corner] [data-gs-slider-readout="equation"] { font-size: 11px; color: #6a1b9a; }
th[data-gs-row-header] { background: #fafafa; }
th[data-gs-row-slot] { background: #fafafa; }
[data-gs-injected] { background: #fafafa; }
td.gs-slider-highlight, th.gs-slider-highlight {
  position: relative;
}
td.gs-slider-highlight::after, th.gs-slider-highlight::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 10;
  border: 0 solid #1976d2;
}
td.gs-slider-highlight-t::after, th.gs-slider-highlight-t::after { border-top-width: 5px; }
td.gs-slider-highlight-r::after, th.gs-slider-highlight-r::after { border-right-width: 5px; }
td.gs-slider-highlight-b::after, th.gs-slider-highlight-b::after { border-bottom-width: 5px; }
td.gs-slider-highlight-l::after, th.gs-slider-highlight-l::after { border-left-width: 5px; }
[data-gs-marker] {
  position: absolute; width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid #1976d2; background: rgb(255 255 255 / 40%);
  pointer-events: none; transform: translate(-50%, -50%); z-index: 5;
  box-shadow: 0 0 0 2px rgb(255 255 255 / 70%);
  transition: top 60ms linear, left 60ms linear;
}
.gs-threshold-host.gs-threshold-active [data-gs-cell-fade] {
  opacity: var(--gs-cell-fade, 1); transition: opacity 80ms linear;
}
`;

let injected = false;

export function injectSliderStyles(): void {
  if (injected) return;
  if (typeof document === 'undefined') return;
  if (document.head.querySelector('style[data-gs-slider-styles]')) {
    injected = true;
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-gs-slider-styles', '');
  style.textContent = SLIDER_CSS;
  document.head.appendChild(style);
  injected = true;
}
