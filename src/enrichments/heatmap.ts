import { cleanNumericCell } from '../core/type-detection';

// Define heatmap type to include 'table' for table-wide heatmaps
export type HeatmapType = 'row' | 'column' | 'table';

const HEATMAP_CLASS = 'gs-heatmap';

// Color scale for the heatmap (from light yellow to dark red)
const HEATMAP_COLORS = [
  '#fff7ec', // lightest
  '#fee8c8',
  '#fdd49e',
  '#fdbb84',
  '#fc8d59',
  '#ef6548',
  '#d7301f', // darkest
];

interface HeatmapOptions {
  minValue?: number;
  maxValue?: number;
  colorScale?: string[];
}

// Per-heatmap record. `cellColors` maps each cell covered by the heatmap to
// the colour that heatmap contributes for that cell. Cells covered by more
// than one heatmap are composited at render time.
interface HeatmapInfo {
  index: number;
  type: HeatmapType;
  cellColors: Map<HTMLElement, string>;
};

declare global {
  interface HTMLElement {
    _heatmapInfos?: HeatmapInfo[];
  }
}

// Add hover and split cell styles for heatmaps
const style = document.createElement('style');
style.textContent = `
  .gs-heatmap-cell {
    transition: all 0.2s ease;
    position: relative;
  }
  .gs-heatmap-cell:hover {
    outline: 2px solid #1976d2;
    outline-offset: -1px;
    z-index: 1;
  }
  .gs-heatmap-split {
    position: relative;
    overflow: hidden;
    color: #000000;
    font-weight: 500;
    text-shadow: 0px 0px 2px rgba(255, 255, 255, 0.7);
    z-index: 1;
  }
  .gs-heatmap-split::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, var(--split-color-1, transparent) 0%, var(--split-color-1, transparent) 50%, var(--split-color-2, transparent) 50%, var(--split-color-2, transparent) 100%);
    pointer-events: none;
    z-index: -1;
  }`;
// Only add the style once
if (!document.head.querySelector('style[data-heatmap-styles]')) {
  style.setAttribute('data-heatmap-styles', '');
  document.head.appendChild(style);
}

export function isHeatmapActive(table: HTMLTableElement, index: number, type: HeatmapType): boolean {
  return !!table._heatmapInfos?.some(h => h.index === index && h.type === type);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Compositing — render each cell from the active heatmaps that cover it.    */
/* ────────────────────────────────────────────────────────────────────────── */

function clearCellStyles(cell: HTMLElement): void {
  cell.style.removeProperty('background-color');
  cell.classList.remove('gs-heatmap-cell', 'gs-heatmap-split');
  cell.style.removeProperty('--split-color-1');
  cell.style.removeProperty('--split-color-2');
  delete cell.dataset.heatmapType;
}

function getCellEntries(cell: HTMLElement, table: HTMLTableElement): Array<{ type: HeatmapType; color: string }> {
  const out: Array<{ type: HeatmapType; color: string }> = [];
  for (const info of table._heatmapInfos ?? []) {
    const color = info.cellColors.get(cell);
    if (color) out.push({ type: info.type, color });
  }
  return out;
}

function renderCell(cell: HTMLElement, table: HTMLTableElement): void {
  const entries = getCellEntries(cell, table);
  if (entries.length === 0) {
    clearCellStyles(cell);
    return;
  }
  cell.classList.add('gs-heatmap-cell');
  if (entries.length === 1) {
    cell.style.backgroundColor = entries[0].color;
    cell.classList.remove('gs-heatmap-split');
    cell.style.removeProperty('--split-color-1');
    cell.style.removeProperty('--split-color-2');
    cell.dataset.heatmapType = entries[0].type;
    return;
  }
  // 2+ overlapping heatmaps — diagonal split with the first two colours.
  cell.style.removeProperty('background-color');
  cell.classList.add('gs-heatmap-split');
  cell.style.setProperty('--split-color-1', entries[0].color);
  cell.style.setProperty('--split-color-2', entries[1].color);
  cell.dataset.heatmapType = entries[0].type;
}

function renderCells(cells: Iterable<HTMLElement>, table: HTMLTableElement): void {
  const seen = new Set<HTMLElement>();
  for (const cell of cells) {
    if (seen.has(cell)) continue;
    seen.add(cell);
    renderCell(cell, table);
  }
}

function updateTableHeatmapClass(table: HTMLTableElement): void {
  if ((table._heatmapInfos?.length ?? 0) > 0) {
    table.classList.add(HEATMAP_CLASS);
  } else {
    table.classList.remove(HEATMAP_CLASS);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Colour computation                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function pickColor(value: number, min: number, max: number, colorScale: string[]): string {
  if (max === min) {
    return colorScale[Math.floor(colorScale.length / 2)];
  }
  const normalized = (value - min) / (max - min);
  const colorIndex = Math.min(
    colorScale.length - 1,
    Math.max(0, Math.floor(normalized * colorScale.length))
  );
  return colorScale[colorIndex];
}

function collectColumnCells(table: HTMLTableElement, index: number): { cell: HTMLTableCellElement; value: number }[] {
  const out: { cell: HTMLTableCellElement; value: number }[] = [];
  const rows = Array.from(table.rows).filter(
    r => !r.hasAttribute('data-gs-injected') && !r.classList.contains('gs-header-row')
  );
  // rows[0] is the header row; data rows start at rows[1].
  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].cells).filter(c => !c.hasAttribute('data-gs-injected'));
    const cell = cells[index];
    if (!cell || cell.tagName.toLowerCase() !== 'td') continue;
    const v = cleanNumericCell(cell.textContent || '');
    if (v !== null) out.push({ cell, value: v });
  }
  return out;
}

function collectRowCells(table: HTMLTableElement, index: number): { cell: HTMLTableCellElement; value: number }[] {
  const out: { cell: HTMLTableCellElement; value: number }[] = [];
  const row = table.querySelector<HTMLTableRowElement>(`tbody tr:nth-child(${index})`);
  if (!row) return out;
  const cells = Array.from(row.cells).filter(c => !c.hasAttribute('data-gs-injected'));
  cells.forEach((cell, cellIndex) => {
    if (cellIndex === 0 && cell.tagName.toLowerCase() === 'th') return;
    const v = cleanNumericCell(cell.textContent || '');
    if (v !== null) out.push({ cell, value: v });
  });
  return out;
}

function collectTableCells(table: HTMLTableElement): { cell: HTMLTableCellElement; value: number }[] {
  const out: { cell: HTMLTableCellElement; value: number }[] = [];
  const rows = Array.from(table.rows);
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    for (const cell of Array.from(rows[rowIndex].cells)) {
      if (cell.tagName.toLowerCase() === 'th' || cell.getAttribute('role') === 'rowheader') continue;
      const v = cleanNumericCell((cell.textContent || '').trim());
      if (v !== null) out.push({ cell, value: v });
    }
  }
  return out;
}

function buildCellColors(
  samples: { cell: HTMLTableCellElement; value: number }[],
  options: HeatmapOptions
): Map<HTMLElement, string> {
  const { minValue, maxValue, colorScale = HEATMAP_COLORS } = options;
  const values = samples.map(s => s.value);
  const min = minValue !== undefined ? minValue : Math.min(...values);
  const max = maxValue !== undefined ? maxValue : Math.max(...values);
  const map = new Map<HTMLElement, string>();
  for (const { cell, value } of samples) {
    map.set(cell, pickColor(value, min, max, colorScale));
  }
  return map;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Public API                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function applyHeatmap(
  table: HTMLTableElement,
  index: number,
  type: HeatmapType = 'column',
  options: HeatmapOptions = {}
): void {
  if (type === 'table') {
    applyTableHeatmap(table, options);
    return;
  }
  if (isHeatmapActive(table, index, type)) return;

  const samples = type === 'column'
    ? collectColumnCells(table, index)
    : collectRowCells(table, index);

  if (samples.length === 0) {
    console.warn('No numeric values found for heatmap');
    return;
  }

  const cellColors = buildCellColors(samples, options);

  if (!table._heatmapInfos) table._heatmapInfos = [];
  table._heatmapInfos.push({ index, type, cellColors });
  updateTableHeatmapClass(table);

  renderCells(cellColors.keys(), table);

  // Force a reflow to ensure styles are applied before the test checks them.
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    table.offsetHeight;
  }

  table.dispatchEvent(new CustomEvent('gridsight:heatmapChanged', {
    bubbles: true,
    detail: { table, index, type, active: true }
  }));
}

/**
 * Apply heatmap to all numeric cells in the table
 */
export function applyTableHeatmap(table: HTMLTableElement, options: HeatmapOptions = {}): void {
  const tableHeatmapIndex = -1;
  if (isHeatmapActive(table, tableHeatmapIndex, 'table')) return;

  const samples = collectTableCells(table);
  if (samples.length === 0) {
    console.warn('No numeric values found for table-wide heatmap');
    return;
  }

  const cellColors = buildCellColors(samples, options);

  if (!table._heatmapInfos) table._heatmapInfos = [];
  table._heatmapInfos.push({ index: tableHeatmapIndex, type: 'table', cellColors });
  updateTableHeatmapClass(table);

  renderCells(cellColors.keys(), table);

  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    table.offsetHeight;
  }

  table.dispatchEvent(new CustomEvent('gridsight:heatmapChanged', {
    bubbles: true,
    detail: { table, index: tableHeatmapIndex, type: 'table', active: true }
  }));
}

export function removeHeatmap(table: HTMLTableElement, index?: number, type?: HeatmapType): void {
  if (!table._heatmapInfos || table._heatmapInfos.length === 0) return;

  if (index !== undefined && type) {
    const heatmapIndex = table._heatmapInfos.findIndex(h => h.index === index && h.type === type);
    if (heatmapIndex === -1) return;

    const [removed] = table._heatmapInfos.splice(heatmapIndex, 1);
    updateTableHeatmapClass(table);

    renderCells(removed.cellColors.keys(), table);

    table.dispatchEvent(new CustomEvent('gridsight:heatmapChanged', {
      bubbles: true,
      detail: { table, index, type, active: false }
    }));
    return;
  }

  // Remove every heatmap.
  const affected = new Set<HTMLElement>();
  for (const info of table._heatmapInfos) {
    for (const cell of info.cellColors.keys()) affected.add(cell);
  }
  table._heatmapInfos = [];
  updateTableHeatmapClass(table);
  renderCells(affected, table);

  table.dispatchEvent(new CustomEvent('gridsight:heatmapChanged', {
    bubbles: true,
    detail: { table, active: false }
  }));
}

export function toggleHeatmap(
  table: HTMLTableElement,
  index: number,
  type: HeatmapType = 'column',
  options: HeatmapOptions = {}
): void {
  const effectiveIndex = type === 'table' ? -1 : index;
  if (isHeatmapActive(table, effectiveIndex, type)) {
    removeHeatmap(table, effectiveIndex, type);
  } else if (type === 'table') {
    applyTableHeatmap(table, options);
  } else {
    applyHeatmap(table, index, type, options);
  }
}
