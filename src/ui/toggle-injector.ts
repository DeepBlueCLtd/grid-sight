import { injectPlusIcons, removePlusIcons, plusIconStyles } from './header-utils';
import type { HeaderType } from './header-utils';
import { analyzeTable } from '../core/table-detection';
import { setColumnTypes } from '../core/column-types-cache';
import { toggleHeatmap } from '../enrichments/heatmap';
import { addThresholdSlider } from '../enrichments/slider-threshold';
import { calculateStatistics } from '../enrichments/statistics';
import { analyzeFrequencies } from '../utils/frequency';
import { cleanNumericCell } from '../core/type-detection';
import {
  columnCells,
  gridCells,
  bodyRows,
  cellValue,
  logicalColIndexOf,
  logicalRowIndexOf,
} from '../core/table-grid';
import { getVisibleRows, onVisibleRowsChange } from '../utils/visible-rows';
import { StatisticsPopup } from './statistics-popup';
import { FrequencyDialog } from './frequency-dialog';
import { FrequencyChartDialog } from './frequency-chart-dialog';

// CSS class names for the toggle element
const TOGGLE_CLASS = 'grid-sight-toggle';
const TOGGLE_CONTAINER_CLASS = 'grid-sight-toggle-container';
const TOGGLE_ACTIVE_CLASS = 'grid-sight-toggle--active';
const TABLE_ENABLED_CLASS = 'grid-sight-enabled';

// Add type declarations for global popup instances
declare global {
  interface Window {
    _gsStatisticsPopup?: StatisticsPopup;
    _gsFrequencyDialog?: FrequencyDialog;
    _gsFrequencyChartDialog?: FrequencyChartDialog;
  }
}

// Add styles for plus icons
const styleElement = document.createElement('style');
styleElement.textContent = plusIconStyles;
document.head.appendChild(styleElement);

// Live subscription that keeps an open statistics popup recomputing over the
// VISIBLE rows while a filter/sort changes (spec 014). Torn down on close.
let statsUnsub: (() => void) | null = null;

interface NumericExtract {
  values: number[];
  /** Cells seen in scope that were blank / non-numeric (drives missing/%). */
  missing: number;
}

// ARIA labels for accessibility
const ARIA_LABEL = 'Toggle Grid-Sight';
const ARIA_EXPANDED = 'false';

/**
 * Creates the Grid-Sight toggle element.
 * @returns The HTMLElement for the toggle.
 */
export function createToggleElement(): HTMLElement {
  // Create container for the toggle
  const container = document.createElement('div');
  container.className = TOGGLE_CONTAINER_CLASS;
  
  // Create the toggle button
  const toggle = document.createElement('button');
  toggle.className = TOGGLE_CLASS;
  toggle.textContent = 'GS';
  
  // ARIA attributes for accessibility
  toggle.setAttribute('aria-label', ARIA_LABEL);
  toggle.setAttribute('aria-expanded', ARIA_EXPANDED);
  toggle.setAttribute('role', 'button');
  toggle.setAttribute('tabindex', '0');
  
  // Add hover and focus styles via JavaScript (can be overridden by CSS)
  toggle.style.cssText = `
    cursor: pointer;
    border: 1px solid #ccc;
    background: #f8f8f8;
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: bold;
    color: #555;
    margin-right: 8px;
    vertical-align: middle;
    transition: all 0.2s ease;
  `;
  
  // Add hover and active states
  toggle.addEventListener('mouseenter', () => {
    toggle.style.background = '#e8e8e8';
    toggle.style.borderColor = '#999';
  });
  
  toggle.addEventListener('mouseleave', () => {
    toggle.style.background = '#f8f8f8';
    toggle.style.borderColor = '#ccc';
  });
  
  // Click handler will be added in injectToggle
  
  // Add keyboard support
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle.click();
    }
  });
  
  container.appendChild(toggle);
  return container;
}

/**
 * Handles enrichment selection from the menu
 */
function handleEnrichmentSelected(event: Event) {
  const customEvent = event as CustomEvent<{
    type: HeaderType;
    enrichmentType: string;
    header: HTMLElement;
    headerIndex: number;
  }>;
  
  const { type, enrichmentType, header, headerIndex } = customEvent.detail;
  
  console.log(`Enrichment selected: ${enrichmentType} for ${type} header at index ${headerIndex}`);
  
  const table = header.closest('table');
  if (!table) return;

    // Create statistics popup instance if it doesn't exist
  if (!window._gsStatisticsPopup) {
    window._gsStatisticsPopup = new StatisticsPopup();
  }

  // Handle menu item selection
  if (enrichmentType === 'slider-threshold') {
    try { addThresholdSlider(table); }
    catch (e) { console.warn('[gridSight] addThresholdSlider failed:', e); }
    return;
  }
  if (enrichmentType === 'heatmap') {
    if (type === 'column') {
      // Logical column index via the addressing layer (not th.cellIndex, which
      // shifts when a slider injects cells).
      const columnIndex = logicalColIndexOf(header as HTMLTableCellElement);
      if (columnIndex >= 0) {
        toggleHeatmap(table, columnIndex, 'column');
      }
    } else if (type === 'row') {
      // 1-based body-row position (matches heatmap.ts::collectRowCells).
      const tr = header.closest('tr') as HTMLTableRowElement | null;
      const rowIndex = tr ? bodyRows(table).indexOf(tr) : -1;
      if (rowIndex >= 0) {
        toggleHeatmap(table, rowIndex + 1, 'row');
      }
    } else if (type === 'table') {
      // Toggle heatmap on all numeric cells in the table
      toggleHeatmap(table, -1, 'table');
    }
  } else if (enrichmentType === 'statistics') {
    // Build a scope-specific recompute that reads the VISIBLE rows and shows
    // the (extended) popup. Subscribe to visible-rows changes while the popup
    // is open so an applied/cleared filter updates it live; unsubscribe on
    // close. Empty scopes render the popup's empty state — never a throw.
    let recompute: (() => void) | null = null;
    if (type === 'column') {
      // `headerIndex` is the logical column index (set by dispatchEnrichmentEvent),
      // aligned with the clicked column even when a slider injected cells.
      const columnIndex = headerIndex;
      if (columnIndex >= 0) {
        recompute = () => {
          const { values, missing } = extractNumericColumnValues(table, columnIndex);
          window._gsStatisticsPopup!.show(calculateStatistics(values, missing), header);
        };
      }
    } else if (type === 'row') {
      const tr = header.closest('tr') as HTMLTableRowElement | null;
      if (tr) {
        recompute = () => {
          const { values, missing } = extractNumericRowValues(tr);
          window._gsStatisticsPopup!.show(calculateStatistics(values, missing), header);
        };
      }
    } else if (type === 'table') {
      recompute = () => {
        const { values, missing } = extractNumericTableValues(table);
        window._gsStatisticsPopup!.show(calculateStatistics(values, missing), header);
      };
    }

    if (recompute) {
      // Drop any prior subscription (a different lozenge/popup was open).
      if (statsUnsub) { statsUnsub(); statsUnsub = null; }
      try {
        recompute();
        const r = recompute;
        statsUnsub = onVisibleRowsChange(table, () => r());
      } catch (error) {
        console.error('Error calculating statistics:', error);
      }
      window._gsStatisticsPopup.onClose(() => {
        if (statsUnsub) { statsUnsub(); statsUnsub = null; }
      });
    }
  } else if ((enrichmentType === 'frequency' || enrichmentType === 'frequency-chart')) {
    try {
      let values: string[] = [];
      let itemName = '';
      
      if (type === 'column') {
        // Type assertion for table header cell
        const th = header as HTMLTableCellElement;
        // `headerIndex` is the logical column index (from header-utils), aligned
        // with the clicked column regardless of slider injection.
        const columnIndex = headerIndex;
        if (columnIndex < 0) {
          throw new Error('Invalid column index');
        }

        // Author values for the logical column, injected UI stripped.
        values = columnCells(table, columnIndex).map(cellValue);

        // Get column name
        itemName = cellValue(th) || `Column ${columnIndex + 1}`;
      } else if (type === 'row') {
        // Type assertion for table row
        const tr = header.closest('tr') as HTMLTableRowElement;
        if (!tr) {
          throw new Error('Could not find row');
        }

        // Logical row identity (stable across sort) for the label.
        const rowIndex = logicalRowIndexOf(table, tr);

        // Author values for the row, excluding the leading row-header cell.
        const cells = gridCells(tr);
        const startIndex = cells.length > 0 && cells[0].tagName.toLowerCase() === 'th' ? 1 : 0;
        values = cells.slice(startIndex).map(cellValue);

        // Get row name/identifier (typically first cell or row number)
        itemName = cells.length > 0
          ? (cellValue(cells[0]) || `Row ${rowIndex + 1}`)
          : `Row ${rowIndex + 1}`;
      } else {
        throw new Error('Unsupported enrichment target type');
      }
      
      // Calculate frequencies
      const frequencyResult = analyzeFrequencies(values);
      
      if (enrichmentType === 'frequency') {
        // Create or reuse frequency dialog instance
        if (!window._gsFrequencyDialog) {
          window._gsFrequencyDialog = new FrequencyDialog();
        }
        
        // Show the dialog with the frequency results
        window._gsFrequencyDialog.show(frequencyResult, header, { columnName: itemName });
      } else if (enrichmentType === 'frequency-chart') {
        // Create or reuse frequency chart dialog instance
        if (!window._gsFrequencyChartDialog) {
          window._gsFrequencyChartDialog = new FrequencyChartDialog();
        }
        
        // Show the chart dialog with the frequency results
        window._gsFrequencyChartDialog.show(frequencyResult, header, { columnName: itemName });
      }
    } catch (error) {
      console.error('Error calculating frequencies:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Dispatch event for the specific enrichment type
  // Only dispatch if we haven't already handled it completely
  if (enrichmentType !== 'statistics') {
    const enrichmentEvent = new CustomEvent(`gridsight:enrichment:${enrichmentType}`, {
      bubbles: true,
      detail: {
        type,
        header,
        headerIndex
      }
    });
    
    header.dispatchEvent(enrichmentEvent);
  }
}

/**
 * Injects the Grid-Sight toggle into the top-left cell of the given table.
 * @param table The HTMLTableElement to inject the toggle into.
 * @returns True if the toggle was injected, false otherwise.
 */
/** Body rows currently VISIBLE (passed every filter) per the row-visibility
 *  pipeline; falls back to all body rows for a table the pipeline never saw.
 *  Statistics are profiled over this set so an applied filter narrows them. */
function visibleBodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  const entries = getVisibleRows(table).current();
  if (entries.length > 0) {
    return entries.filter((e) => e.state === 'visible').map((e) => e.rowEl);
  }
  return bodyRows(table);
}

/**
 * Extracts numeric values from a logical column over the VISIBLE rows, plus the
 * count of visible cells in that column that were blank / non-numeric.
 */
function extractNumericColumnValues(table: HTMLTableElement, columnIndex: number): NumericExtract {
  const values: number[] = [];
  let missing = 0;
  for (const row of visibleBodyRows(table)) {
    const cell = gridCells(row)[columnIndex];
    if (!cell) continue;
    const value = cleanNumericCell(cellValue(cell));
    if (value !== null) values.push(value);
    else missing += 1;
  }
  return { values, missing };
}

/**
 * Extracts numeric values from a single table row (excluding a leading row
 * header), plus the count of its blank / non-numeric data cells.
 */
function extractNumericRowValues(row: HTMLTableRowElement): NumericExtract {
  const values: number[] = [];
  let missing = 0;
  const cells = gridCells(row);

  // Skip the first cell if it's a row header.
  const startIndex = cells.length > 0 && cells[0].tagName.toLowerCase() === 'th' ? 1 : 0;

  for (let i = startIndex; i < cells.length; i++) {
    const value = cleanNumericCell(cellValue(cells[i]));
    if (value !== null) values.push(value);
    else missing += 1;
  }

  return { values, missing };
}

/**
 * Extracts all numeric values from the VISIBLE body rows (excluding row
 * headers), plus the count of blank / non-numeric data cells.
 */
function extractNumericTableValues(table: HTMLTableElement): NumericExtract {
  const values: number[] = [];
  let missing = 0;

  for (const row of visibleBodyRows(table)) {
    const cells = gridCells(row);
    // Skip the first cell if it's a row header.
    const cellStartIndex = cells.length > 0 && cells[0].tagName.toLowerCase() === 'th' ? 1 : 0;
    for (let j = cellStartIndex; j < cells.length; j++) {
      const value = cleanNumericCell(cellValue(cells[j]));
      if (value !== null) values.push(value);
      else missing += 1;
    }
  }

  return { values, missing };
}

export function injectToggle(table: HTMLTableElement): boolean {
  // Find the first cell in the first row of the thead
  const firstRow = table.tHead?.rows[0] || table.rows[0];
  if (!firstRow?.cells.length) {
    console.warn('Could not find a suitable cell to inject the Grid-Sight toggle');
    return false;
  }
  
  const firstCell = firstRow.cells[0];
  
  // Check if a toggle already exists in this table
  if (firstCell.querySelector(`.${TOGGLE_CLASS}, .${TOGGLE_CONTAINER_CLASS}`)) {
    return false;
  }
  
  try {
    const toggleElement = createToggleElement();
    const toggle = toggleElement.querySelector(`.${TOGGLE_CLASS}`);
    
    // Insert the toggle as the first child of the cell
    firstCell.insertBefore(toggleElement, firstCell.firstChild);
    
    // Add click handler for the toggle
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const container = toggle.closest(`.${TOGGLE_CONTAINER_CLASS}`);
        const isActive = toggle.classList.toggle(TOGGLE_ACTIVE_CLASS);
        container?.classList.toggle(TOGGLE_ACTIVE_CLASS, isActive);
        toggle.setAttribute('aria-expanded', String(isActive));
        
        // Dispatch custom event when toggle is clicked
        const toggleEvent = new CustomEvent('gridsight:toggle', {
          bubbles: true,
          detail: { active: isActive, target: e.target }
        });
        toggle.dispatchEvent(toggleEvent);
        
        if (isActive) {
          table.classList.add(TABLE_ENABLED_CLASS);
          // Extract table data and analyze column types. Skip Grid-Sight-injected
          // scaffold rows (e.g. the summary-row <tfoot>, spec 014) — they are not
          // author data and would otherwise skew column typing and suppress a
          // column's lozenges (spec 013: scaffold is never the logical grid).
          const rows = Array.from(table.rows)
            .filter(row => !row.hasAttribute('data-gs-injected'))
            .map(row => Array.from(row.cells).map(cell => cell.textContent || ''));
          const { columnTypes } = analyzeTable(rows);
          // Cache column types for the toggle-panel refresh path (spec 012 R-10).
          setColumnTypes(table, columnTypes);
          // Inject plus icons
          injectPlusIcons(table, columnTypes);
          
          // Add click handler for enrichment selection
          table.addEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected as EventListener);
        } else {
          table.classList.remove(TABLE_ENABLED_CLASS);
          // Remove plus icons and event listeners when toggling off.
          removePlusIcons(table);
          table.removeEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected as EventListener);
        }
      });
    }
    
    // Add a class to the table to indicate it has Grid-Sight enabled
    table.classList.add('grid-sight-enabled');
    
    return true;
  } catch (error) {
    console.error('Failed to inject Grid-Sight toggle:', error);
    return false;
  }
}
