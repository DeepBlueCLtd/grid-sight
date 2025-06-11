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
const COPY_BUTTON_CLASS = 'gs-statistics-popup__copy';
const COPY_ICON = '⎘';
const CHECK_ICON = '✓';

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

.${COPY_BUTTON_CLASS} {
  background: none;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  padding: 2px 6px;
  margin-left: 8px;
  font-size: 11px;
  cursor: pointer;
  color: #666;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
}

.${COPY_BUTTON_CLASS}:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.${COPY_BUTTON_CLASS}.copied {
  background: #e8f5e9;
  border-color: #81c784;
  color: #2e7d32;
}
`;

export class StatisticsPopup {
  private element: HTMLElement;
  private contentElement: HTMLElement;
  private closeButton: HTMLButtonElement;
  private copyButton: HTMLButtonElement;
  private stats: StatisticsResult | null = null;
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
    
    // Create copy button
    this.copyButton = document.createElement('button');
    this.copyButton.className = COPY_BUTTON_CLASS;
    this.copyButton.textContent = 'Copy All';
    this.copyButton.addEventListener('click', () => this.copyAllToClipboard());
    
    // Assemble the popup
    this.element.appendChild(header);
    this.element.appendChild(this.contentElement);
    this.element.appendChild(this.copyButton);
    
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

  private createStatItem(label: string, value: string | number, copyValue?: string): HTMLElement {
    const item = document.createElement('div');
    item.className = STAT_ITEM_CLASS;
    
    const labelSpan = document.createElement('span');
    labelSpan.className = STAT_LABEL_CLASS;
    labelSpan.textContent = label;
    
    const valueSpan = document.createElement('span');
    valueSpan.className = STAT_VALUE_CLASS;
    valueSpan.textContent = String(value);
    
    const valueContainer = document.createElement('div');
    valueContainer.style.display = 'flex';
    valueContainer.style.alignItems = 'center';
    valueContainer.appendChild(valueSpan);
    
    if (copyValue !== undefined) {
      const copyButton = document.createElement('button');
      copyButton.className = COPY_BUTTON_CLASS;
      copyButton.innerHTML = COPY_ICON;
      copyButton.setAttribute('aria-label', `Copy ${label}`);
      copyButton.title = `Copy ${label}`;
      
      copyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(copyValue, copyButton);
      });
      
      valueContainer.appendChild(copyButton);
    }
    
    item.appendChild(labelSpan);
    item.appendChild(valueContainer);
    
    return item;
  }

  private async copyToClipboard(text: string, button?: HTMLButtonElement): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = CHECK_ICON;
        button.classList.add('copied');
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('copied');
        }, 2000);
      }
      
      return true;
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  }

  private copyAllToClipboard() {
    if (!this.stats) return;
    
    const formattedStats = [
      `Count: ${this.stats.count}`,
      `Sum: ${this.formatNumber(this.stats.sum)}`,
      `Min: ${this.formatNumber(this.stats.min)}`,
      `Max: ${this.formatNumber(this.stats.max)}`,
      `Mean: ${this.formatNumber(this.stats.mean)}`,
      `Median: ${this.formatNumber(this.stats.median)}`,
      `Std Dev: ${this.formatNumber(this.stats.stdDev)}`,
      `Variance: ${this.formatNumber(this.stats.variance)}`
    ].join('\n');
    
    this.copyToClipboard(formattedStats, this.copyButton);
    this.copyButton.textContent = 'Copied!';
    
    setTimeout(() => {
      this.copyButton.textContent = 'Copy All';
    }, 2000);
  }

  private formatNumber(value: number, decimals: number = 2): string {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  show(stats: StatisticsResult, anchor: HTMLElement): void {
    this.stats = stats;
    
    // Clear previous content
    this.contentElement.innerHTML = '';
    
    // Add stats items
    this.contentElement.appendChild(this.createStatItem('Count', stats.count, String(stats.count)));
    this.contentElement.appendChild(this.createStatItem('Sum', this.formatNumber(stats.sum), String(stats.sum)));
    this.contentElement.appendChild(this.createStatItem('Min', this.formatNumber(stats.min), String(stats.min)));
    this.contentElement.appendChild(this.createStatItem('Max', this.formatNumber(stats.max), String(stats.max)));
    this.contentElement.appendChild(this.createStatItem('Mean', this.formatNumber(stats.mean), String(stats.mean)));
    this.contentElement.appendChild(this.createStatItem('Median', this.formatNumber(stats.median), String(stats.median)));
    this.contentElement.appendChild(this.createStatItem('Std Dev', this.formatNumber(stats.stdDev), String(stats.stdDev)));
    this.contentElement.appendChild(this.createStatItem('Variance', this.formatNumber(stats.variance), String(stats.variance)));
    
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
