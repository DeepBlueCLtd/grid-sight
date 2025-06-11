import type { ColumnType } from '../core/type-detection';
import { createEnrichmentMenu, positionMenu, removeAllMenus } from './enrichment-menu';

const PLUS_ICON_CLASS = 'gs-plus-icon';
const HEADER_WITH_ICON_CLASS = 'gs-has-plus-icon';
const PLUS_ICON_ACTIVE_CLASS = 'gs-plus-icon--active';

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
  const columnType: ColumnType = type === 'column' ? 'numeric' : 'categorical'; // Simplified - should be determined from actual data
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
    
    // Close any open menus first
    removeAllMenus();
    
    // Toggle active state
    const isActive = plusIcon.classList.toggle(PLUS_ICON_ACTIVE_CLASS);
    
    if (isActive) {
      // Create and show the enrichment menu
      const menu = createEnrichmentMenu(columnType, (enrichmentType) => {
        // Handle menu item selection
        console.log(`Selected enrichment: ${enrichmentType} for ${type} header`);
        // Dispatch event with the selected enrichment type
        const event = new CustomEvent('gridsight:enrichmentSelected', {
          bubbles: true,
          detail: {
            type,
            enrichmentType,
            header,
            headerIndex: type === 'column' ? 
              Array.from(header.parentElement?.children || []).indexOf(header) :
              Array.from(header.closest('tr')?.parentElement?.children || []).indexOf(header.closest('tr') as HTMLTableRowElement)
          }
        });
        header.dispatchEvent(event);
        
        // Close the menu
        menu.remove();
        plusIcon.classList.remove(PLUS_ICON_ACTIVE_CLASS);
      });
      
      document.body.appendChild(menu);
      positionMenu(menu, plusIcon);
      
      // Close menu when clicking outside
      const clickOutsideHandler = (event: MouseEvent) => {
        if (!menu.contains(event.target as Node) && event.target !== plusIcon) {
          menu.remove();
          plusIcon.classList.remove(PLUS_ICON_ACTIVE_CLASS);
          document.removeEventListener('click', clickOutsideHandler);
        }
      };
      
      // Use setTimeout to avoid triggering the handler immediately
      setTimeout(() => {
        document.addEventListener('click', clickOutsideHandler);
      }, 0);
    }
  });
  
  // Add hover state
  header.addEventListener('mouseenter', () => {
    if (!plusIcon.classList.contains(PLUS_ICON_ACTIVE_CLASS)) {
      plusIcon.style.opacity = '1';
    }
  });
  
  header.addEventListener('mouseleave', () => {
    if (!plusIcon.classList.contains(PLUS_ICON_ACTIVE_CLASS)) {
      plusIcon.style.opacity = '0.5';
    }
  });

  // Add to header
  header.appendChild(plusIcon);
  header.classList.add(HEADER_WITH_ICON_CLASS);
}

// Add styles for the plus icons
export const plusIconStyles = `
  .${PLUS_ICON_CLASS} {
    opacity: 0.5;
    transition: all 0.2s ease;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    background-color: rgba(0, 0, 0, 0.05);
    margin-left: 4px;
    font-size: 12px;
    font-weight: bold;
    user-select: none;
  }
  
  .${PLUS_ICON_CLASS}:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }
  
  .${PLUS_ICON_ACTIVE_CLASS} {
    opacity: 1 !important;
    background-color: #1976d2;
    color: white;
  }
  
  .${HEADER_WITH_ICON_CLASS} {
    position: relative;
    cursor: pointer;
  }
  
  .${HEADER_WITH_ICON_CLASS}:hover {
    background-color: rgba(25, 118, 210, 0.08);
  }
`;
