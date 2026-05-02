import type { ColumnType } from '../core/type-detection';

export const ENRICHMENT_MENU_CLASS = 'gs-enrichment-menu';
const MENU_ITEM_CLASS = 'gs-enrichment-menu-item';
const MENU_ITEM_LABEL_CLASS = 'gs-enrichment-menu-item-label';

export type EnrichmentType = 'heatmap' | 'zscore' | 'sort' | 'filter' | 'aggregate' | 'statistics' | 'frequency' | 'frequency-chart' | 'slider' | 'threshold-slider' | 'toggle-sliders';

export interface EnrichmentMenuItem {
  id: EnrichmentType;
  label: string;
  availableFor: ColumnType[];
  /** Optional predicate — when false the item is hidden. */
  predicate?: (ctx: MenuContext) => boolean;
  /** Optional active-state probe — drives the checkbox indicator. */
  isActive?: (ctx: MenuContext) => boolean;
}

export interface MenuContext {
  /** The plus-icon's host header type (row|column|table). */
  headerType: 'row' | 'column' | 'table';
  /** Whether the host axis qualifies for a slider (numeric+monotonic). */
  axisIsSliderEligible: boolean;
  /** Whether a slider already exists for the host axis on the host table. */
  sliderExists: boolean;
  /** Whether the host table currently has heatmap colouring. */
  hasHeatmap: boolean;
  /** Whether the host table has at least one axis slider currently active. */
  anySliderExists: boolean;
  /** Whether the host table has both row + col axes that qualify for sliders. */
  bothAxesEligible: boolean;
  /** Whether the host table has a threshold slider currently active. */
  thresholdSliderExists: boolean;
}

export const ENRICHMENT_ITEMS: EnrichmentMenuItem[] = [
  {
    id: 'heatmap',
    label: 'Heatmap',
    availableFor: ['numeric'],
    isActive: (ctx) => ctx.hasHeatmap,
  },
  {
    id: 'statistics',
    label: 'Statistics',
    availableFor: ['numeric'],
  },
  {
    id: 'frequency',
    label: 'Frequency (table)',
    availableFor: ['categorical'],
  },
  {
    id: 'frequency-chart',
    label: 'Frequency (chart)',
    availableFor: ['categorical'],
  },
  {
    // Per-axis slider toggle. Shown on row/column plus-icons; checkbox mirrors
    // current state. Click toggles add ↔ remove for this single axis.
    id: 'slider',
    label: 'Slider',
    availableFor: ['numeric'],
    predicate: (ctx) =>
      (ctx.headerType === 'row' || ctx.headerType === 'column') &&
      (ctx.axisIsSliderEligible || ctx.sliderExists),
    isActive: (ctx) => ctx.sliderExists,
  },
  {
    // Threshold slider toggle (table-wide, requires heatmap).
    id: 'threshold-slider',
    label: 'Threshold slider',
    availableFor: ['numeric'],
    predicate: (ctx) =>
      ctx.headerType === 'table' && (ctx.hasHeatmap || ctx.thresholdSliderExists),
    isActive: (ctx) => ctx.thresholdSliderExists,
  },
  {
    // Table-wide "all axis sliders at once" toggle.
    id: 'toggle-sliders',
    label: 'Sliders',
    availableFor: ['numeric'],
    predicate: (ctx) =>
      ctx.headerType === 'table' &&
      (ctx.bothAxesEligible || ctx.anySliderExists),
    isActive: (ctx) => ctx.anySliderExists,
  }
];

export function createEnrichmentMenu(
  columnType: ColumnType,
  onSelect: (_type: EnrichmentType) => void,
  ctx?: MenuContext
): HTMLElement {
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

  // Filter items based on column type and (optional) predicate context
  const availableItems = ENRICHMENT_ITEMS.filter(item => {
    if (!item.availableFor.includes(columnType)) return false;
    if (item.predicate && ctx) return item.predicate(ctx);
    if (item.predicate && !ctx) return false; // predicate items require context
    return true;
  });

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

    const active = ctx && item.isActive ? !!item.isActive(ctx) : false;
    const indicator = item.isActive ? `<span aria-hidden="true" style="display:inline-block;width:14px;text-align:center;color:${active ? '#1976d2' : '#bbb'};">${active ? '✓' : '·'}</span>` : '<span aria-hidden="true" style="display:inline-block;width:14px;"></span>';
    menuItem.innerHTML = `
      ${indicator}
      <span class="${MENU_ITEM_LABEL_CLASS}">${item.label}</span>
    `;
    if (item.isActive) {
      menuItem.setAttribute('role', 'menuitemcheckbox');
      menuItem.setAttribute('aria-checked', String(active));
    }

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
