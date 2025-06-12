import type { ColumnType } from '../core/type-detection';

export const ENRICHMENT_MENU_CLASS = 'gs-enrichment-menu';
const MENU_ITEM_CLASS = 'gs-enrichment-menu-item';
const MENU_ITEM_LABEL_CLASS = 'gs-enrichment-menu-item-label';

export type EnrichmentType = 'heatmap' | 'zscore' | 'sort' | 'filter' | 'aggregate' | 'statistics' | 'frequency' | 'frequency-chart';

export interface EnrichmentMenuItem {
  id: EnrichmentType;
  label: string;
  availableFor: ColumnType[];
}

export const ENRICHMENT_ITEMS: EnrichmentMenuItem[] = [
  {
    id: 'heatmap',
    label: 'Heatmap',
    availableFor: ['numeric']
  },
  {
    id: 'statistics',
    label: 'Statistics',
    availableFor: ['numeric']
  },
  {
    id: 'frequency',
    label: 'Frequency (table)',
    availableFor: ['categorical']
  },
  {
    id: 'frequency-chart',
    label: 'Frequency (chart)',
    availableFor: ['categorical']
  }
];

export function createEnrichmentMenu(columnType: ColumnType, onSelect: (type: EnrichmentType) => void): HTMLElement {
  const menu = document.createElement('div');
  menu.className = ENRICHMENT_MENU_CLASS;
  menu.style.cssText = `
    position: absolute;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    min-width: 180px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
  `;

  // Filter items based on column type
  const availableItems = ENRICHMENT_ITEMS.filter(item => 
    item.availableFor.includes(columnType)
  );

  // Add menu items
  availableItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = MENU_ITEM_CLASS;
    menuItem.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.1s;
    `;

    menuItem.innerHTML = `
      <span class="${MENU_ITEM_LABEL_CLASS}">${item.label}</span>
    `;

    menuItem.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(item.id);
    });

    // Add hover effect
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#f5f5f5';
    });

    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = '';
    });

    menu.appendChild(menuItem);
  });

  return menu;
}

export function positionMenu(menu: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  
  // Position below the anchor by default
  let top = rect.bottom + window.scrollY;
  let left = rect.left + window.scrollX;
  
  // Check if there's enough space below, if not, position above
  if (rect.bottom + menu.offsetHeight > viewportHeight) {
    top = rect.top + window.scrollY - menu.offsetHeight;
  }
  
  // Ensure the menu stays within viewport
  if (left + menu.offsetWidth > window.innerWidth) {
    left = window.innerWidth - menu.offsetWidth - 10;
  }
  
  menu.style.top = `${Math.max(0, top)}px`;
  menu.style.left = `${Math.max(0, left)}px`;
}

export function removeAllMenus(): void {
  document.querySelectorAll(`.${ENRICHMENT_MENU_CLASS}`).forEach(menu => {
    menu.remove();
  });
}
