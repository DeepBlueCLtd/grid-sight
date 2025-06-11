/**
 * Creates the Grid-Sight toggle element.
 * For the skeleton, this is a simple 'GS' span.
 * @returns The HTMLElement for the toggle.
 */
export function createToggleElement(): HTMLElement {
  const toggle = document.createElement('span')
  toggle.textContent = 'GS'
  toggle.style.cursor = 'pointer' // Basic styling to indicate it's interactive
  toggle.style.marginRight = '5px' // Add some spacing
  // In a real version, this would likely be an icon or a more styled button
  // and might have ARIA attributes for accessibility.
  return toggle
}

/**
 * Injects the Grid-Sight toggle into the top-left cell of the given table.
 * The top-left cell is assumed to be the first <th> or <td> in the first <tr>.
 * If the table has a <thead>, it will look within the first row of the <thead>.
 * Otherwise, it will look in the first <tr> of the <tbody> or the table itself.
 * @param table The HTMLTableElement to inject the toggle into.
 */
export function injectToggle(table: HTMLTableElement): void {
  let firstCell: HTMLTableCellElement | null = null

  // Try to find the first cell in thead first
  const tHead = table.tHead
  if (tHead && tHead.rows.length > 0) {
    const firstRowInHead = tHead.rows[0]
    if (firstRowInHead.cells.length > 0) {
      firstCell = firstRowInHead.cells[0]
    }
  }

  // If not found in thead, try tbody or directly in table rows
  if (!firstCell) {
    if (table.rows.length > 0 && table.rows[0].cells.length > 0) {
      firstCell = table.rows[0].cells[0]
    }
  }

  if (firstCell) {
    const toggleElement = createToggleElement()
    firstCell.insertBefore(toggleElement, firstCell.firstChild)
  } else {
    console.warn('Grid-Sight: Could not find a suitable top-left cell to inject toggle in table:', table)
  }
}
