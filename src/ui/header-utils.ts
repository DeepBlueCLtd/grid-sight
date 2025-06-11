import type { ColumnType } from '../core/type-detection';

const PLUS_ICON_CLASS = 'gs-plus-icon';
const HEADER_WITH_ICON_CLASS = 'gs-has-plus-icon';

export function injectPlusIcons(table: HTMLTableElement, columnTypes: ColumnType[]): void {
  // Remove any existing plus icons first
  removePlusIcons(table);

  // Add plus icons to column headers (first row)
  const headerRow = table.rows[0];
  if (!headerRow) return;

  // Add plus icons to column headers
  Array.from(headerRow.cells).forEach((cell, colIndex) => {
    const type = columnTypes[colIndex];
    if (type === 'numeric' || type === 'categorical') {
      addPlusIconToHeader(cell, 'column');
    }
  });

  // Add plus icons to row headers (first cell of each row)
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row.cells.length) continue;
    
    const firstCell = row.cells[0];
    const type = columnTypes[0]; // Row headers are always first column
    
    if (i > 0 && (type === 'numeric' || type === 'categorical')) {
      addPlusIconToHeader(firstCell, 'row');
    }
  }
}

export function removePlusIcons(table: HTMLTableElement): void {
  // Remove all plus icons
  const icons = table.querySelectorAll(`.${PLUS_ICON_CLASS}`);
  icons.forEach(icon => icon.remove());
  
  // Remove the has-plus-icon class from all cells
  const cells = table.querySelectorAll(`.${HEADER_WITH_ICON_CLASS}`);
  cells.forEach(cell => cell.classList.remove(HEADER_WITH_ICON_CLASS));
}

function addPlusIconToHeader(header: HTMLTableCellElement, type: 'row' | 'column'): void {
  // Skip if already has a plus icon
  if (header.querySelector(`.${PLUS_ICON_CLASS}`)) return;

  // Create plus icon
  const plusIcon = document.createElement('span');
  plusIcon.className = `${PLUS_ICON_CLASS} gs-${type}-plus`;
  plusIcon.textContent = '+';
  plusIcon.style.marginLeft = '4px';
  plusIcon.style.cursor = 'pointer';
  
  // Add click handler
  plusIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    // TODO: Show enrichment menu
    console.log(`Plus icon clicked on ${type} header`);
  });

  // Add to header
  header.appendChild(plusIcon);
  header.classList.add(HEADER_WITH_ICON_CLASS);
}

// Add styles for the plus icons
export const plusIconStyles = `
  .${PLUS_ICON_CLASS} {
    opacity: 0.5;
    transition: opacity 0.2s;
  }
  
  .${PLUS_ICON_CLASS}:hover {
    opacity: 1;
  }
  
  .${HEADER_WITH_ICON_CLASS} {
    position: relative;
  }
`;
