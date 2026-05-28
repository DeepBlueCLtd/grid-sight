/**
 * Outlier marker CSS injection (spec 004-outlier, FR-006).
 *
 * Mirrors `slider-styles.ts`: an idempotent `<style data-gs-outlier-styles>`
 * injector plus a remover for teardown. The published IIFE (built from
 * `index.ts`) does not pull `style.css`, so every enrichment ships its CSS by
 * injecting a `<style>` tag from JS.
 *
 * The cell marker uses TWO independent visual channels so it stays perceivable
 * without colour vision (FR-006, constitution §III):
 *   1. a DASHED outline — a shape/pattern channel, legible in greyscale; and
 *   2. an inset coloured ring (box-shadow) — the colour channel.
 * Bold text is layered on as a third, redundant weight channel.
 */

const OUTLIER_CSS = `
/* ── Two-channel cell marker (FR-006) ─────────────────────────────── */
td.gs-outlier-cell, th.gs-outlier-cell {
  position: relative;
  outline: 2px dashed var(--gs-outlier-color, #d32f2f);   /* shape channel */
  outline-offset: -2px;
  box-shadow: inset 0 0 0 2px var(--gs-outlier-ring, rgb(211 47 47 / 22%)); /* colour channel */
  font-weight: 700;                                        /* weight channel */
}
td.gs-outlier-cell:focus-visible, th.gs-outlier-cell:focus-visible {
  outline: 3px solid #1976d2;
  outline-offset: 1px;
}

/* ── Per-cell value/mean/σ tooltip (FR-007/FR-019) ────────────────── */
.gs-outlier-tooltip {
  position: absolute;
  z-index: 10001;
  max-width: 260px;
  background: #212121;
  color: #fff;
  font: 12px/1.4 system-ui, sans-serif;
  padding: 4px 8px;
  border-radius: 4px;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgb(0 0 0 / 30%);
}

/* ── Outliers list popup chrome (FR-012/FR-020) ───────────────────── */
.gs-outlier-popup {
  position: absolute;
  z-index: 10002;
  min-width: 240px;
  max-width: 360px;
  max-height: 320px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 15%);
  font: 13px/1.4 system-ui, sans-serif;
  color: #222;
  padding: 6px;
}
.gs-outlier-popup__title {
  margin: 2px 4px 6px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}
.gs-outlier-popup__list { list-style: none; margin: 0; padding: 0; }
.gs-outlier-popup__entry {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 5px 8px;
  margin: 0;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.gs-outlier-popup__entry:hover { background: #f0f0f0; }
.gs-outlier-popup__entry:focus-visible { outline: 2px solid #1976d2; outline-offset: -2px; }
.gs-outlier-popup__sigma { font-variant-numeric: tabular-nums; color: #d32f2f; font-weight: 600; }

/* ── Row highlight when an entry is activated (FR-013) ────────────── */
tr.gs-outlier-row-highlight > * {
  background: var(--gs-outlier-highlight, rgb(255 235 59 / 55%)) !important;
  transition: background-color 120ms ease;
}

/* ── Lozenge cluster + secondary "show list" button ───────────────── */
.gs-outlier-cluster { display: inline-flex; gap: 2px; align-items: center; }
.gs-lozenge--outlier-list { padding: 0 5px; font-size: 12px; }
`;

const STYLE_MARKER = 'data-gs-outlier-styles';

/** Inject the outlier stylesheet once. Idempotent (guarded by the marker). */
export function ensureOutlierStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector(`style[${STYLE_MARKER}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(STYLE_MARKER, '');
  style.textContent = OUTLIER_CSS;
  document.head.appendChild(style);
}

/** Remove the injected outlier stylesheet (teardown). */
export function removeOutlierStyles(): void {
  if (typeof document === 'undefined') return;
  document.head.querySelectorAll(`style[${STYLE_MARKER}]`).forEach((el) => el.remove());
}
