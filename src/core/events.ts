/**
 * Event handling system for Grid-Sight
 * Implements an event-driven architecture with custom browser events
 */

// Define custom event types
export const EVENTS = {
  TABLE_DETECTED: 'grid-sight:table-detected',
  TOGGLE_ACTIVATED: 'grid-sight:toggle-activated',
  TOGGLE_DEACTIVATED: 'grid-sight:toggle-deactivated',
  ENRICHMENT_APPLIED: 'grid-sight:enrichment-applied',
  ENRICHMENT_REMOVED: 'grid-sight:enrichment-removed'
}

/**
 * Set up global event listeners for Grid-Sight
 */
export const setupEventListeners = (): void => {
  // Listen for toggle activation
  document.addEventListener(EVENTS.TOGGLE_ACTIVATED, (event: Event) => {
    const customEvent = event as CustomEvent
    const tableElement = customEvent.detail.tableElement
    
    // Add activation class to the table
    tableElement.classList.add('grid-sight-active')
    
    console.log('Grid-Sight activated for table:', tableElement)
  })
  
  // Listen for toggle deactivation
  document.addEventListener(EVENTS.TOGGLE_DEACTIVATED, (event: Event) => {
    const customEvent = event as CustomEvent
    const tableElement = customEvent.detail.tableElement
    
    // Remove activation class from the table
    tableElement.classList.remove('grid-sight-active')
    
    console.log('Grid-Sight deactivated for table:', tableElement)
  })
}

/**
 * Dispatch a custom Grid-Sight event
 * @param eventName - The name of the event to dispatch
 * @param detail - The event details/payload
 */
export const dispatchGridSightEvent = (
  eventName: string, 
  detail: Record<string, unknown>
): void => {
  const event = new CustomEvent(eventName, {
    bubbles: true,
    detail
  })
  
  document.dispatchEvent(event)
}