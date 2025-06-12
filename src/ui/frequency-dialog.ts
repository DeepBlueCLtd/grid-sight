import type { FrequencyResult } from '../utils/frequency';

// CSS class names
const DIALOG_CLASS = 'gs-frequency-dialog';
const DIALOG_VISIBLE_CLASS = 'gs-frequency-dialog--visible';
const DIALOG_HEADER_CLASS = 'gs-frequency-dialog__header';
const DIALOG_TITLE_CLASS = 'gs-frequency-dialog__title';
const DIALOG_CLOSE_BUTTON_CLASS = 'gs-frequency-dialog__close';
const DIALOG_CONTENT_CLASS = 'gs-frequency-dialog__content';
const DIALOG_TABLE_CLASS = 'gs-frequency-dialog__table';
const DIALOG_TABLE_HEAD_CLASS = 'gs-frequency-dialog__table-head';
const DIALOG_TABLE_BODY_CLASS = 'gs-frequency-dialog__table-body';

// CSS styles for the dialog
const DIALOG_STYLES = `
.${DIALOG_CLASS} {
  position: absolute;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  min-width: 300px;
  max-width: 500px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

.${DIALOG_VISIBLE_CLASS} {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.${DIALOG_HEADER_CLASS} {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.${DIALOG_TITLE_CLASS} {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.${DIALOG_CLOSE_BUTTON_CLASS} {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1;
}

.${DIALOG_CLOSE_BUTTON_CLASS}:hover {
  background: #f5f5f5;
  color: #666;
}

.${DIALOG_CONTENT_CLASS} {
  padding: 0;
  overflow-y: auto;
}

.${DIALOG_TABLE_CLASS} {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.${DIALOG_TABLE_HEAD_CLASS} {
  position: sticky;
  top: 0;
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #e9ecef;
}

.${DIALOG_TABLE_HEAD_CLASS} th {
  padding: 10px 12px;
  text-align: left;
}

.${DIALOG_TABLE_BODY_CLASS} tr:not(:last-child) {
  border-bottom: 1px solid #e9ecef;
}

.${DIALOG_TABLE_BODY_CLASS} td {
  padding: 8px 12px;
  vertical-align: middle;
}

.${DIALOG_TABLE_BODY_CLASS} tr:hover {
  background-color: #f8f9fa;
}

/* Scrollbar styling */
.${DIALOG_CONTENT_CLASS}::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.${DIALOG_CONTENT_CLASS}::-webkit-scrollbar-thumb {
  background-color: #c1c1c1;
  border-radius: 3px;
}

.${DIALOG_CONTENT_CLASS}::-webkit-scrollbar-thumb:hover {
  background-color: #a8a8a8;
}

.${DIALOG_CONTENT_CLASS}::-webkit-scrollbar-track {
  background-color: #f1f1f1;
  border-radius: 3px;
}
`;

type FrequencyDialogOptions = {
  columnName?: string;
};

export class FrequencyDialog {
  private element: HTMLElement;
  private contentElement: HTMLElement;
  private tableBody: HTMLTableSectionElement;
  private closeButton: HTMLButtonElement;
  private onCloseCallback: (() => void) | null = null;
  private handleOutsideClickBound: (event: MouseEvent) => void;
  private handleKeyDownBound: (event: KeyboardEvent) => void;

  constructor() {
    // Create and inject styles
    this.injectStyles();
    
    // Create dialog element
    this.element = document.createElement('div');
    this.element.className = DIALOG_CLASS;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-labelledby', 'gs-frequency-dialog-title');
    
    // Create header
    const header = document.createElement('div');
    header.className = DIALOG_HEADER_CLASS;
    
    const title = document.createElement('h3');
    title.className = DIALOG_TITLE_CLASS;
    title.id = 'gs-frequency-dialog-title';
    title.textContent = 'Frequency Analysis';
    
    this.closeButton = document.createElement('button');
    this.closeButton.className = DIALOG_CLOSE_BUTTON_CLASS;
    this.closeButton.innerHTML = '&times;';
    this.closeButton.setAttribute('aria-label', 'Close');
    this.closeButton.addEventListener('click', () => this.hide());
    
    header.appendChild(title);
    header.appendChild(this.closeButton);
    
    // Create content area
    this.contentElement = document.createElement('div');
    this.contentElement.className = DIALOG_CONTENT_CLASS;
    
    // Create table
    const table = document.createElement('table');
    table.className = DIALOG_TABLE_CLASS;
    
    const thead = document.createElement('thead');
    thead.className = DIALOG_TABLE_HEAD_CLASS;
    
    const headerRow = document.createElement('tr');
    
    // Add table headers
    ['Value', 'Count', 'Percentage'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    
    // Create table body
    this.tableBody = document.createElement('tbody');
    this.tableBody.className = DIALOG_TABLE_BODY_CLASS;
    
    table.appendChild(thead);
    table.appendChild(this.tableBody);
    
    this.contentElement.appendChild(table);
    
    // Assemble the dialog
    this.element.appendChild(header);
    this.element.appendChild(this.contentElement);
    
    // Add to document
    document.body.appendChild(this.element);
    
    // Bind event handlers
    this.handleOutsideClickBound = this.handleOutsideClick.bind(this);
    this.handleKeyDownBound = this.handleKeyDown.bind(this);
  }

  private injectStyles() {
    // Only inject styles once
    if (document.getElementById('gs-frequency-dialog-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'gs-frequency-dialog-styles';
    style.textContent = DIALOG_STYLES;
    document.head.appendChild(style);
  }

  private handleOutsideClick(event: MouseEvent) {
    if (this.element.classList.contains(DIALOG_VISIBLE_CLASS) && 
        !this.element.contains(event.target as Node)) {
      this.hide();
    }
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.element.classList.contains(DIALOG_VISIBLE_CLASS)) {
      this.hide();
    }
  }

  private renderTable(results: FrequencyResult[]) {
    // Clear existing rows
    this.tableBody.innerHTML = '';
    
    // Add rows for each result
    results.forEach(([value, count, percentage]) => {
      const row = document.createElement('tr');
      
      const valueCell = document.createElement('td');
      valueCell.textContent = value;
      
      const countCell = document.createElement('td');
      countCell.textContent = count.toString();
      
      const percentageCell = document.createElement('td');
      percentageCell.textContent = `${percentage.toFixed(1)}%`;
      
      row.appendChild(valueCell);
      row.appendChild(countCell);
      row.appendChild(percentageCell);
      
      this.tableBody.appendChild(row);
    });
  }



  public show(results: FrequencyResult[], anchor: HTMLElement, options: FrequencyDialogOptions = {}) {
    // Update title if column name is provided
    if (options.columnName) {
      const title = this.element.querySelector(`.${DIALOG_TITLE_CLASS}`);
      if (title) {
        title.textContent = `Frequency: ${options.columnName}`;
      }
    }
    
    // Render the table with results
    this.renderTable(results);
    
    // Position the dialog relative to the anchor
    this.positionDialog(anchor);
    
    // Show the dialog
    this.element.classList.add(DIALOG_VISIBLE_CLASS);
    
    // Add event listeners
    document.addEventListener('click', this.handleOutsideClickBound);
    document.addEventListener('keydown', this.handleKeyDownBound);
    
    // Focus the close button for keyboard navigation
    this.closeButton.focus();
  }

  /**
   * Hides the dialog
   */
  public hide() {
    this.element.classList.remove(DIALOG_VISIBLE_CLASS);
    
    // Remove event listeners
    document.removeEventListener('click', this.handleOutsideClickBound);
    document.removeEventListener('keydown', this.handleKeyDownBound);
    
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  /**
   * Positions the dialog relative to the anchor element
   */
  private positionDialog(anchor: HTMLElement) {
    const anchorRect = anchor.getBoundingClientRect();
    const dialogRect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    // Default position: below the anchor, right-aligned
    let top = anchorRect.bottom + scrollY + 5;
    let left = anchorRect.right + scrollX - dialogRect.width;
    
    // Adjust if going off the right edge of the viewport
    if (left + dialogRect.width > viewportWidth + scrollX) {
      left = viewportWidth + scrollX - dialogRect.width - 10;
    }
    
    // Adjust if going off the left edge of the viewport
    if (left < scrollX) {
      left = scrollX + 10;
    }
    
    // Adjust if going off the bottom of the viewport
    if (top + dialogRect.height > viewportHeight + scrollY) {
      // Try to position above the anchor
      if (anchorRect.top - dialogRect.height > scrollY) {
        top = anchorRect.top + scrollY - dialogRect.height - 5;
      } else {
        // If not enough space above, constrain to viewport height
        top = viewportHeight + scrollY - dialogRect.height - 10;
      }
    }
    
    this.element.style.top = `${Math.max(scrollY + 10, top)}px`;
    this.element.style.left = `${left}px`;
  }

  /**
   * Sets a callback to be called when the dialog is closed
   */
  public onClose(callback: () => void) {
    this.onCloseCallback = callback;
  }

  /**
   * Cleans up the dialog and removes it from the DOM
   */
  public destroy() {
    // Remove event listeners
    document.removeEventListener('click', this.handleOutsideClickBound);
    document.removeEventListener('keydown', this.handleKeyDownBound);
    
    // Remove the dialog from the DOM
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
