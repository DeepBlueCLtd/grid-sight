import type { StatisticsResult } from '../enrichments/statistics';

const POPUP_CLASS = 'gs-statistics-popup';
const POPUP_VISIBLE_CLASS = 'gs-statistics-popup--visible';
const POPUP_HEADER_CLASS = 'gs-statistics-popup__header';
const POPUP_TITLE_CLASS = 'gs-statistics-popup__title';
const POPUP_CLOSE_BUTTON_CLASS = 'gs-statistics-popup__close';
const POPUP_CONTENT_CLASS = 'gs-statistics-popup__content';
const STAT_ITEM_CLASS = 'gs-statistics-popup__stat';
const STAT_LABEL_CLASS = 'gs-statistics-popup__stat-label';
const STAT_VALUE_CLASS = 'gs-statistics-popup__stat-value';

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
    
    // Add statistics items
    this.contentElement.appendChild(this.createStatItem('Count', stats.count.toString()));
    this.contentElement.appendChild(this.createStatItem('Sum', this.formatNumber(stats.sum)));
    this.contentElement.appendChild(this.createStatItem('Min', this.formatNumber(stats.min)));
    this.contentElement.appendChild(this.createStatItem('Max', this.formatNumber(stats.max)));
    this.contentElement.appendChild(this.createStatItem('Mean', this.formatNumber(stats.mean)));
    this.contentElement.appendChild(this.createStatItem('Median', this.formatNumber(stats.median)));
    this.contentElement.appendChild(this.createStatItem('Std Dev', this.formatNumber(stats.stdDev)));
    this.contentElement.appendChild(this.createStatItem('Variance', this.formatNumber(stats.variance)));
    
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
