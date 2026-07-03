import { injectPlusIcons, removePlusIcons, plusIconStyles } from './header-utils';
import type { HeaderType } from './header-utils';
import { disableTwinSliders } from '../enrichments/twin-slider';
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
  headerRows,
  sourceColumnMatrix,
} from '../core/table-grid';
import { onVisibleRowsChange, visibleBodyRows } from '../utils/visible-rows';
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
    
    // Add click handler for the toggle. The structural work lives in
    // activateToggle/deactivateToggle (spec 015) so a programmatic start-state
    // and a manual click run the IDENTICAL code path — guaranteeing
    // byte-identical teardown (FR-024).
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (toggle.classList.contains(TOGGLE_ACTIVE_CLASS)) {
          deactivateToggle(table);
        } else {
          activateToggle(table);
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

/** Locate the GS corner toggle button for a table (top-left cell). */
function findToggle(table: HTMLTableElement): HTMLElement | null {
  return table.querySelector<HTMLElement>(`.${TOGGLE_CLASS}`);
}

function dispatchToggleEvent(toggle: HTMLElement, active: boolean): void {
  const toggleEvent = new CustomEvent('gridsight:toggle', {
    bubbles: true,
    detail: { active, target: toggle },
  });
  toggle.dispatchEvent(toggleEvent);
}

/**
 * Reveal a table's enrichments: mark the GS toggle active, set
 * `aria-expanded="true"`, inject the lozenge clusters, and wire the enrichment
 * listener. Idempotent — calling it on an already-active table re-runs the
 * injection (which clears and rebuilds the clusters).
 *
 * This is the single shared activate path (spec 015 R-5): the GS toggle's click
 * handler and the per-table start-state both call it, so there is exactly one
 * behaviour to reason about and teardown is byte-identical.
 */
export function activateToggle(table: HTMLTableElement): void {
  const toggle = findToggle(table);
  if (!toggle) return;
  const container = toggle.closest(`.${TOGGLE_CONTAINER_CLASS}`);
  toggle.classList.add(TOGGLE_ACTIVE_CLASS);
  container?.classList.add(TOGGLE_ACTIVE_CLASS);
  toggle.setAttribute('aria-expanded', 'true');

  table.classList.add(TABLE_ENABLED_CLASS);
  // Extract table data and analyze column types. Read the AUTHOR value
  // (cellValue strips GS-injected UI such as annotation pins/markers and
  // lozenges) and skip injected scaffold rows (e.g. the summary-row <tfoot>,
  // spec 014). Using raw textContent here would let an annotated numeric cell
  // ("1200" + note) read as non-numeric and suppress a column's lozenges
  // (spec 013: scaffold/UI is never the logical grid).
  // A multi-row (banner) header is flattened by logical column so a merged
  // banner / rowspan corner doesn't collapse the detected column count; a plain
  // header keeps the raw per-cell read (which also covers virtual columns).
  const rows = headerRows(table).length > 1
    ? sourceColumnMatrix(table)
    : Array.from(table.rows)
        .filter(row => !row.hasAttribute('data-gs-injected'))
        .map(row => Array.from(row.cells).map(cell => cellValue(cell)));
  const { columnTypes } = analyzeTable(rows);
  // Cache column types for the toggle-panel refresh path (spec 012 R-10).
  setColumnTypes(table, columnTypes);
  injectPlusIcons(table, columnTypes);
  table.addEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected as EventListener);

  dispatchToggleEvent(toggle, true);
}

/**
 * Hide a table's enrichments: clear the active state, set
 * `aria-expanded="false"`, remove the lozenge clusters, and drop the enrichment
 * listener. Restores byte-identical original markup after any activateToggle
 * (FR-024). Idempotent.
 */
export function deactivateToggle(table: HTMLTableElement): void {
  const toggle = findToggle(table);
  if (!toggle) return;
  const container = toggle.closest(`.${TOGGLE_CONTAINER_CLASS}`);
  toggle.classList.remove(TOGGLE_ACTIVE_CLASS);
  container?.classList.remove(TOGGLE_ACTIVE_CLASS);
  toggle.setAttribute('aria-expanded', 'false');

  table.classList.remove(TABLE_ENABLED_CLASS);
  // Tear down the twin-slider adornments (injected direction row + per-block
  // sliders/highlights) before removing lozenges, so GS-off restores the
  // original markup on grouped tables too (spec 016).
  try { disableTwinSliders(table); } catch (e) { /* ignore */ void e; }
  removePlusIcons(table);
  table.removeEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected as EventListener);
  // Removing the `gs-has-plus-icon` marker can leave an empty `class=""`
  // attribute on a header that had no other class; strip those so teardown is
  // byte-identical (FR-024 / INV-4), mirroring index.ts disable().
  table.querySelectorAll('[class=""]').forEach((el) => el.removeAttribute('class'));

  dispatchToggleEvent(toggle, false);
}
