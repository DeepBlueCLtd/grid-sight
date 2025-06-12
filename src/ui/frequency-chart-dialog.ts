import type { FrequencyResult } from '../utils/frequency';

// CSS class names
const DIALOG_CLASS = 'gs-frequency-chart-dialog';
const DIALOG_VISIBLE_CLASS = 'gs-frequency-chart-dialog--visible';
const DIALOG_HEADER_CLASS = 'gs-frequency-chart-dialog__header';
const DIALOG_TITLE_CLASS = 'gs-frequency-chart-dialog__title';
const DIALOG_CLOSE_BUTTON_CLASS = 'gs-frequency-chart-dialog__close';
const DIALOG_CONTENT_CLASS = 'gs-frequency-chart-dialog__content';
const DIALOG_CHART_CLASS = 'gs-frequency-chart-dialog__chart';

// SVG chart specific classes
const DIALOG_SVG_CHART_CLASS = 'gs-frequency-chart-dialog__svg-chart';
const DIALOG_SVG_AXIS_CLASS = 'gs-frequency-chart-dialog__svg-axis';
const DIALOG_SVG_BAR_CLASS = 'gs-frequency-chart-dialog__svg-bar';
const DIALOG_SVG_LABEL_CLASS = 'gs-frequency-chart-dialog__svg-label';

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
  max-width: 600px;
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
  padding: 12px;
  overflow-y: auto;
}

.${DIALOG_CHART_CLASS} {
  width: 100%;
  font-family: monospace;
}

.${DIALOG_SVG_CHART_CLASS} {
  width: 100%;
  height: 300px;
  margin-top: 10px;
}

.${DIALOG_SVG_AXIS_CLASS} {
  stroke: #999;
  stroke-width: 1px;
}

.${DIALOG_SVG_BAR_CLASS} {
  fill: #0066cc;
  transition: fill 0.2s ease;
}

.${DIALOG_SVG_BAR_CLASS}:hover {
  fill: #004c99;
}

.${DIALOG_SVG_LABEL_CLASS} {
  font-size: 10px;
  fill: #666;
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

type FrequencyChartDialogOptions = {
  columnName?: string;
};



export class FrequencyChartDialog {
  private element: HTMLElement;
  private contentElement: HTMLElement;
  private chartElement: HTMLElement;
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
    this.element.setAttribute('aria-labelledby', 'gs-frequency-chart-dialog-title');
    
    // Create header
    const header = document.createElement('div');
    header.className = DIALOG_HEADER_CLASS;
    
    const title = document.createElement('h3');
    title.className = DIALOG_TITLE_CLASS;
    title.id = 'gs-frequency-chart-dialog-title';
    title.textContent = 'Frequency Chart';
    
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
    
    // Create chart container
    this.chartElement = document.createElement('div');
    this.chartElement.className = DIALOG_CHART_CLASS;
    
    this.contentElement.appendChild(this.chartElement);
    
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
    if (document.getElementById('gs-frequency-chart-dialog-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'gs-frequency-chart-dialog-styles';
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



  /**
   * Renders frequency data as an SVG bar chart
   */
  private renderChart(results: FrequencyResult[]) {
    // Clear existing chart
    this.chartElement.innerHTML = '';
    
    if (results.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No data available';
      emptyMessage.style.padding = '10px';
      emptyMessage.style.color = '#666';
      this.chartElement.appendChild(emptyMessage);
      return;
    }
    
    // SVG dimensions and margins
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', (width + margin.left + margin.right).toString());
    svg.setAttribute('height', (height + margin.top + margin.bottom).toString());
    svg.setAttribute('class', DIALOG_SVG_CHART_CLASS);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Frequency bar chart');
    
    // Create chart group with margins
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    
    // Find the maximum count for scaling
    const maxCount = Math.max(...results.map(([_, count]) => count));
    
    // Calculate bar width based on number of items
    const barWidth = Math.max(10, Math.min(60, width / results.length - 10));
    
    // Create Y axis
    const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxisLine.setAttribute('x1', '0');
    yAxisLine.setAttribute('y1', '0');
    yAxisLine.setAttribute('x2', '0');
    yAxisLine.setAttribute('y2', height.toString());
    yAxisLine.setAttribute('class', DIALOG_SVG_AXIS_CLASS);
    
    // Create X axis
    const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxisLine.setAttribute('x1', '0');
    xAxisLine.setAttribute('y1', height.toString());
    xAxisLine.setAttribute('x2', width.toString());
    xAxisLine.setAttribute('y2', height.toString());
    xAxisLine.setAttribute('class', DIALOG_SVG_AXIS_CLASS);
    
    g.appendChild(yAxisLine);
    g.appendChild(xAxisLine);
    
    // Add Y axis ticks and labels
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
      const tickValue = Math.round(maxCount * (i / numTicks));
      const yPos = height - (height * (i / numTicks));
      
      // Tick mark
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', '-5');
      tick.setAttribute('y1', yPos.toString());
      tick.setAttribute('x2', '0');
      tick.setAttribute('y2', yPos.toString());
      tick.setAttribute('class', DIALOG_SVG_AXIS_CLASS);
      
      // Tick label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '-10');
      label.setAttribute('y', yPos.toString());
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('alignment-baseline', 'middle');
      label.setAttribute('class', DIALOG_SVG_LABEL_CLASS);
      label.textContent = tickValue.toString();
      
      g.appendChild(tick);
      g.appendChild(label);
      
      // Grid line (optional)
      if (i > 0) {
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('x1', '0');
        gridLine.setAttribute('y1', yPos.toString());
        gridLine.setAttribute('x2', width.toString());
        gridLine.setAttribute('y2', yPos.toString());
        gridLine.setAttribute('stroke', '#eee');
        gridLine.setAttribute('stroke-dasharray', '2,2');
        g.appendChild(gridLine);
      }
    }
    
    // Y-axis label
    const yAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yAxisLabel.setAttribute('transform', `translate(-40,${height/2}) rotate(-90)`);
    yAxisLabel.setAttribute('text-anchor', 'middle');
    yAxisLabel.setAttribute('class', DIALOG_SVG_LABEL_CLASS);
    yAxisLabel.textContent = 'Count';
    g.appendChild(yAxisLabel);
    
    // X-axis label
    const xAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xAxisLabel.setAttribute('transform', `translate(${width/2},${height + 45})`);
    xAxisLabel.setAttribute('text-anchor', 'middle');
    xAxisLabel.setAttribute('class', DIALOG_SVG_LABEL_CLASS);
    xAxisLabel.textContent = 'Values';
    g.appendChild(xAxisLabel);
    
    // Create bars for each value
    results.forEach(([value, count, percentage], index) => {
      const barHeight = (count / maxCount) * height;
      const xPosition = (width / results.length) * index + (width / results.length - barWidth) / 2;
      
      // Create bar
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', xPosition.toString());
      bar.setAttribute('y', (height - barHeight).toString());
      bar.setAttribute('width', barWidth.toString());
      bar.setAttribute('height', barHeight.toString());
      bar.setAttribute('class', DIALOG_SVG_BAR_CLASS);
      
      // Add tooltip with data
      bar.setAttribute('data-value', value);
      bar.setAttribute('data-count', count.toString());
      bar.setAttribute('data-percentage', percentage.toFixed(1));
      
      // Add event listeners for interactive tooltips
      bar.addEventListener('mouseover', (e) => {
        const target = e.target as SVGRectElement;
        const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        tooltip.textContent = `${value}: ${count} (${percentage.toFixed(1)}%)`;
        target.appendChild(tooltip);
      });
      
      g.appendChild(bar);
      
      // Add x-axis label for the bar
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (xPosition + barWidth / 2).toString());
      label.setAttribute('y', (height + 15).toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', DIALOG_SVG_LABEL_CLASS);
      
      // Truncate long labels
      const maxLabelLength = 10;
      const displayValue = value.length > maxLabelLength 
        ? value.substring(0, maxLabelLength) + '...' 
        : value;
      
      label.textContent = displayValue;
      label.setAttribute('title', value); // For full text on hover
      
      g.appendChild(label);
    });
    
    svg.appendChild(g);
    this.chartElement.appendChild(svg);
  }



  public show(results: FrequencyResult[], anchor: HTMLElement, options: FrequencyChartDialogOptions = {}) {
    // Update title if column name is provided
    if (options.columnName) {
      const title = this.element.querySelector(`.${DIALOG_TITLE_CLASS}`);
      if (title) {
        title.textContent = `Frequency Chart: ${options.columnName}`;
      }
    }
    
    // Render the chart with results
    this.renderChart(results);
    
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
