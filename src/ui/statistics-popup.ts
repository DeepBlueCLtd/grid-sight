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

/** Inline-SVG mini histogram. Bars scale to the tallest bin; each bar carries
 *  a <title> (value range + count) so the shape is legible without colour and
 *  to a screen reader (spec 014 §R-4). */
function buildHistogramSvg(histogram: number[], minV: number, maxV: number): SVGElement {
  const width = 256;
  const height = 56;
  const gap = 1;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Value distribution histogram');

  const n = histogram.length;
  if (n === 0) return svg;
  const maxCount = Math.max(...histogram, 1);
  const barW = Math.max(1, (width - gap * (n - 1)) / n);
  const range = maxV - minV;

  for (let i = 0; i < n; i++) {
    const c = histogram[i];
    const x = i * (barW + gap);
    const h = c === 0 ? 0 : Math.max(1, (c / maxCount) * height);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(height - h));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(h));
    rect.setAttribute('fill', '#4a90e2');

    const title = document.createElementNS(SVG_NS, 'title');
    if (n === 1) {
      title.textContent = `${formatNumber(minV)}: ${c}`;
    } else {
      const lo = minV + (range * i) / n;
      const hi = minV + (range * (i + 1)) / n;
      title.textContent = `${formatNumber(lo)}–${formatNumber(hi)}: ${c}`;
    }
    rect.appendChild(title);
    svg.appendChild(rect);
  }
  return svg;
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
  min-width: 280px;
  max-width: 320px;
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

.${STAT_ITEM_CLASS} {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f8f8f8;
}

.${STAT_ITEM_CLASS}:last-child {
  border-bottom: none;
}

.${STAT_LABEL_CLASS} {
  color: #666;
  margin-right: 12px;
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
      // Profile rows. Q1/Q3 sit either side of the median; the new Missing /
      // Distinct figures lead so the data-quality read is immediate.
      this.contentElement.appendChild(this.createStatItem('Count', stats.count.toString()));
      this.contentElement.appendChild(this.createStatItem('Missing', missingValue));
      this.contentElement.appendChild(this.createStatItem('Distinct', stats.distinct.toString()));
      this.contentElement.appendChild(this.createStatItem('Sum', this.formatNumber(stats.sum)));
      this.contentElement.appendChild(this.createStatItem('Min', this.formatNumber(stats.min)));
      this.contentElement.appendChild(this.createStatItem('Q1', this.formatNumber(stats.q1)));
      this.contentElement.appendChild(this.createStatItem('Median', this.formatNumber(stats.median)));
      this.contentElement.appendChild(this.createStatItem('Q3', this.formatNumber(stats.q3)));
      this.contentElement.appendChild(this.createStatItem('Max', this.formatNumber(stats.max)));
      this.contentElement.appendChild(this.createStatItem('Mean', this.formatNumber(stats.mean)));
      this.contentElement.appendChild(this.createStatItem('Std Dev', this.formatNumber(stats.stdDev)));
      this.contentElement.appendChild(this.createStatItem('Variance', this.formatNumber(stats.variance)));

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
