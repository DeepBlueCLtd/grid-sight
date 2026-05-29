import type { StatisticsResult } from '../enrichments/statistics';
import { formatNumber } from '../enrichments/statistics';

const SVG_NS = 'http://www.w3.org/2000/svg';

const POPUP_CLASS = 'gs-statistics-popup';
const POPUP_VISIBLE_CLASS = 'gs-statistics-popup--visible';
const POPUP_HEADER_CLASS = 'gs-statistics-popup__header';
const POPUP_TITLE_CLASS = 'gs-statistics-popup__title';
const POPUP_CLOSE_BUTTON_CLASS = 'gs-statistics-popup__close';
const POPUP_CONTENT_CLASS = 'gs-statistics-popup__content';
const STAT_ITEM_CLASS = 'gs-statistics-popup__stat';
const STAT_LABEL_CLASS = 'gs-statistics-popup__stat-label';
const STAT_VALUE_CLASS = 'gs-statistics-popup__stat-value';
const HISTOGRAM_CLASS = 'gs-statistics-popup__histogram';
const EMPTY_CLASS = 'gs-statistics-popup__empty';
const GRID_CLASS = 'gs-statistics-popup__grid';

/** Inline-SVG mini histogram. Bars scale to the tallest bin; each bar carries
 *  a <title> (value range + count) so the shape is legible without colour and
 *  to a screen reader (spec 014 §R-4).
 *
 *  Bin edges get short vertical tick markers rising from the baseline and each
 *  bin's centre value is drawn as small upright text just above the baseline —
 *  so it reads within a shaded bar (or over the gap for an empty bin), adding no
 *  vertical height. Labels/ticks use white glyphs with a navy halo
 *  (paint-order: stroke) so they read over both the blue bars and the gaps. */
function buildHistogramSvg(histogram: number[], minV: number, maxV: number): SVGElement {
  const width = 256;
  const height = 56;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Value distribution histogram');

  const n = histogram.length;
  if (n === 0) return svg;
  const maxCount = Math.max(...histogram, 1);
  const binW = width / n;
  const range = maxV - minV;

  // Bars (full bin width; edge ticks below provide the separation).
  for (let i = 0; i < n; i++) {
    const c = histogram[i];
    const h = c === 0 ? 0 : Math.max(1, (c / maxCount) * height);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(i * binW));
    rect.setAttribute('y', String(height - h));
    rect.setAttribute('width', String(binW));
    rect.setAttribute('height', String(h));
    rect.setAttribute('fill', '#4a90e2');

    const title = document.createElementNS(SVG_NS, 'title');
    const lo = n === 1 ? minV : minV + (range * i) / n;
    const hi = n === 1 ? maxV : minV + (range * (i + 1)) / n;
    title.textContent =
      n === 1 ? `${formatNumber(minV)}: ${c}` : `${formatNumber(lo)}–${formatNumber(hi)}: ${c}`;
    rect.appendChild(title);
    svg.appendChild(rect);
  }

  // Short bin-edge tick markers rising from the baseline (haloed for contrast).
  for (let e = 0; e <= n; e++) {
    const x = Math.min(width - 0.5, Math.max(0.5, e * binW));
    appendHaloedLine(svg, x, height, x, height - 7);
  }

  // Upright bin-centre value labels sitting just above the baseline.
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * binW;
    const centre = n === 1 ? minV : minV + (range * (i + 0.5)) / n;
    appendBinLabel(svg, cx, height - 3, formatNumber(centre, range < 5 ? 1 : 0));
  }
  return svg;
}

/** A vertical line drawn twice — a white casing under a thin navy line — so it
 *  stays visible over both the blue bars and the white gaps. */
function appendHaloedLine(svg: SVGElement, x1: number, y1: number, x2: number, y2: number): void {
  for (const [stroke, w] of [['#ffffff', 2.4], ['#2b4a6b', 0.9]] as const) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', String(w));
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
  }
}

/** Small upright value label centred horizontally at `x` with its baseline at
 *  `y`; white glyph with a navy halo so it reads inside a bar or over the empty
 *  baseline gap. */
function appendBinLabel(svg: SVGElement, x: number, y: number, text: string): void {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('font-size', '8');
  t.setAttribute('font-weight', '700');
  t.setAttribute('font-family', '-apple-system, system-ui, sans-serif');
  t.setAttribute('fill', '#ffffff');
  t.setAttribute('stroke', '#2b4a6b');
  t.setAttribute('stroke-width', '2.2');
  t.setAttribute('paint-order', 'stroke');
  t.setAttribute('stroke-linejoin', 'round');
  t.textContent = text;
  svg.appendChild(t);
}

// CSS styles for the popup
const POPUP_STYLES = `
.${POPUP_CLASS} {
  position: absolute;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  min-width: 360px;
  max-width: 440px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.${POPUP_VISIBLE_CLASS} {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.${POPUP_HEADER_CLASS} {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.${POPUP_TITLE_CLASS} {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.${POPUP_CLOSE_BUTTON_CLASS} {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1;
}

.${POPUP_CLOSE_BUTTON_CLASS}:hover {
  background: #f5f5f5;
  color: #666;
}

.${POPUP_CONTENT_CLASS} {
  padding: 12px;
}

/* Two-column profile: figures flow column-major so the left column is
   counts + central tendency and the right column is spread / quartiles /
   dispersion. Halves the popup height versus a single stacked list. */
.${GRID_CLASS} {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: repeat(6, auto);
  grid-auto-flow: column;
  column-gap: 18px;
}

.${STAT_ITEM_CLASS} {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  padding: 4px 0;
  border-bottom: 1px solid #f1f1f1;
}

/* Drop the rule under the last cell of each column (rows 6 and 12). */
.${GRID_CLASS} .${STAT_ITEM_CLASS}:nth-child(6),
.${GRID_CLASS} .${STAT_ITEM_CLASS}:nth-child(12) {
  border-bottom: none;
}

.${STAT_LABEL_CLASS} {
  color: #666;
  margin-right: 12px;
  white-space: nowrap;
}

.${STAT_VALUE_CLASS} {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  color: #333;
  text-align: right;
  flex: 1;
}

.${HISTOGRAM_CLASS} {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}
.${HISTOGRAM_CLASS} svg { display: block; width: 100%; height: auto; }

.${EMPTY_CLASS} {
  padding: 4px 0;
  color: #777;
  font-style: italic;
}
`;

export class StatisticsPopup {
  private element: HTMLElement;
  private contentElement: HTMLElement;
  private closeButton: HTMLButtonElement;

  private onCloseCallback: (() => void) | null = null;

  constructor() {
    // Create and inject styles
    this.injectStyles();
    
    // Create popup element
    this.element = document.createElement('div');
    this.element.className = POPUP_CLASS;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-labelledby', 'gs-statistics-popup-title');
    
    // Create header
    const header = document.createElement('div');
    header.className = POPUP_HEADER_CLASS;
    
    const title = document.createElement('h3');
    title.className = POPUP_TITLE_CLASS;
    title.id = 'gs-statistics-popup-title';
    title.textContent = 'Column Statistics';
    
    this.closeButton = document.createElement('button');
    this.closeButton.className = POPUP_CLOSE_BUTTON_CLASS;
    this.closeButton.innerHTML = '&times;';
    this.closeButton.setAttribute('aria-label', 'Close');
    this.closeButton.addEventListener('click', () => this.hide());
    
    header.appendChild(title);
    header.appendChild(this.closeButton);
    
    // Create content area
    this.contentElement = document.createElement('div');
    this.contentElement.className = POPUP_CONTENT_CLASS;
    

    // Assemble the popup
    this.element.appendChild(header);
    this.element.appendChild(this.contentElement);
    
    // Add to document
    document.body.appendChild(this.element);
    
    // Close when clicking outside
    document.addEventListener('click', this.handleOutsideClick);
    
    // Close on Escape key
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private injectStyles() {
    // Only inject styles once
    if (document.getElementById('gs-statistics-popup-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'gs-statistics-popup-styles';
    style.textContent = POPUP_STYLES;
    document.head.appendChild(style);
  }

  private handleOutsideClick = (event: MouseEvent) => {
    if (this.element.classList.contains(POPUP_VISIBLE_CLASS) && 
        !this.element.contains(event.target as Node)) {
      this.hide();
    }
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.element.classList.contains(POPUP_VISIBLE_CLASS)) {
      this.hide();
    }
  };

  private createStatItem(label: string, value: string | number): HTMLElement {
    const item = document.createElement('div');
    item.className = STAT_ITEM_CLASS;
    
    const labelSpan = document.createElement('span');
    labelSpan.className = STAT_LABEL_CLASS;
    labelSpan.textContent = label;
    
    const valueSpan = document.createElement('span');
    valueSpan.className = STAT_VALUE_CLASS;
    valueSpan.textContent = String(value);
    
    item.appendChild(labelSpan);
    item.appendChild(valueSpan);
    
    return item;
  }

  private formatNumber(value: number, decimals: number = 2): string {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  show(stats: StatisticsResult, anchor: HTMLElement): void {
    // Clear previous content
    this.contentElement.innerHTML = '';

    const missingValue = `${stats.missing} (${this.formatNumber(stats.missingPct, 1)}%)`;

    if (stats.count === 0) {
      // Empty state — no numeric values to profile. Never a NaN row.
      const empty = document.createElement('div');
      empty.className = EMPTY_CLASS;
      empty.textContent = 'No numeric values';
      this.contentElement.appendChild(empty);
      if (stats.missing > 0) {
        this.contentElement.appendChild(this.createStatItem('Missing', missingValue));
      }
    } else {
      // Two-column profile (column-major): the grid fills the left column first,
      // so column 1 = counts + central tendency and column 2 = spread / quartiles
      // / dispersion. Six rows instead of twelve ≈ half the height.
      const grid = document.createElement('div');
      grid.className = GRID_CLASS;
      const rows: Array<[string, string]> = [
        // Left column (counts + central tendency)
        ['Count', stats.count.toString()],
        ['Missing', missingValue],
        ['Distinct', stats.distinct.toString()],
        ['Sum', this.formatNumber(stats.sum)],
        ['Mean', this.formatNumber(stats.mean)],
        ['Median', this.formatNumber(stats.median)],
        // Right column (spread / quartiles / dispersion)
        ['Min', this.formatNumber(stats.min)],
        ['Q1', this.formatNumber(stats.q1)],
        ['Q3', this.formatNumber(stats.q3)],
        ['Max', this.formatNumber(stats.max)],
        ['Std Dev', this.formatNumber(stats.stdDev)],
        ['Variance', this.formatNumber(stats.variance)],
      ];
      for (const [label, value] of rows) {
        grid.appendChild(this.createStatItem(label, value));
      }
      this.contentElement.appendChild(grid);

      if (stats.histogram.length > 0) {
        const histWrap = document.createElement('div');
        histWrap.className = HISTOGRAM_CLASS;
        histWrap.appendChild(buildHistogramSvg(stats.histogram, stats.min, stats.max));
        this.contentElement.appendChild(histWrap);
      }
    }

    // Position the popup
    this.positionPopup(anchor);

    // Show the popup
    this.element.classList.add(POPUP_VISIBLE_CLASS);

    // Focus the close button for keyboard navigation
    this.closeButton.focus();
  }

  hide(): void {
    this.element.classList.remove(POPUP_VISIBLE_CLASS);
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  private positionPopup(anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    // Position below the anchor element
    const top = rect.bottom + scrollY + 5;
    const left = rect.left + scrollX;
    
    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
    
    // Adjust if going off the right edge of the viewport
    const viewportWidth = window.innerWidth;
    const popupWidth = this.element.offsetWidth;
    
    if (left + popupWidth > viewportWidth) {
      this.element.style.left = `${viewportWidth - popupWidth - 10}px`;
    }
  }

  onClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  destroy(): void {
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
