/**
 * Grid-Sight Walkthrough
 * 
 * This module implements a guided tour for new users of Grid-Sight
 * using Shepherd.js (https://shepherdjs.dev/)
 */

import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'

// Store tour instance to ensure only one tour runs at a time
let activeTour: Shepherd.Tour | null = null

/**
 * Creates and configures the Grid-Sight walkthrough tour
 * @returns The configured Shepherd.Tour instance
 */
function createTour(): Shepherd.Tour {
  // Create a new tour
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: {
        enabled: true
      },
      classes: 'gs-shepherd-theme',
      scrollTo: true
    }
  })

  // Step 1: Introduction to Grid-Sight (centered, no target)
  tour.addStep({
    id: 'intro',
    text: `
      <h3>Welcome to Grid-Sight!</h3>
      <p>Grid-Sight enhances HTML tables with powerful analysis and visualization tools.</p>
      <p>This brief walkthrough will show you how to get started.</p>
    `,
    buttons: [
      {
        text: 'Next',
        action: tour.next
      }
    ]
  })

  // Step 2: G-S Toggle Introduction
  tour.addStep({
    id: 'gs-toggle',
    text: `
      <h3>The Grid-Sight Toggle</h3>
      <p>Click the "GS" toggle button to activate Grid-Sight on this table.</p>
      <p>This will enable data analysis features for the table.</p>
    `,
    attachTo: {
      element: '.grid-sight-toggle',
      on: 'bottom'
    },
    advanceOn: {
      selector: '.grid-sight-toggle',
      event: 'click'
    },
    beforeShowPromise: function() {
      // Return a promise that resolves when the toggle is available
      return new Promise<void>((resolve) => {
        const checkForToggle = () => {
          const toggle = document.querySelector('.grid-sight-toggle')
          if (toggle) {
            resolve()
          } else {
            // Check again in 100ms
            setTimeout(checkForToggle, 100)
          }
        }
        checkForToggle()
      })
    }
  })

  // Step 3: Plus Icons Introduction
  tour.addStep({
    id: 'plus-icons',
    text: `
      <h3>Plus Icons</h3>
      <p>Click on any "+" icon to access data enrichment options.</p>
      <p>Try selecting an option from the menu to see what Grid-Sight can do!</p>
    `,
    attachTo: {
      element: '.gs-plus-icon',
      on: 'bottom'
    },
    advanceOn: {
      selector: '.gs-plus-icon',
      event: 'click'
    },
    beforeShowPromise: function() {
      // Return a promise that resolves when plus icons are available
      return new Promise<void>((resolve) => {
        const checkForPlusIcons = () => {
          const plusIcons = document.querySelector('.gs-plus-icon')
          if (plusIcons) {
            resolve()
          } else {
            // Check again in 100ms
            setTimeout(checkForPlusIcons, 100)
          }
        }
        checkForPlusIcons()
      })
    },
    when: {
      show() {
        // Add a listener for the enrichment menu selection
        const handleEnrichmentSelected = () => {
          // Complete the tour when an enrichment option is selected
          setTimeout(() => {
            if (tour) {
              tour.complete()
            }
          }, 500)
        }
        
        document.addEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected)
        
        // Return cleanup function
        return () => {
          document.removeEventListener('gridsight:enrichmentSelected', handleEnrichmentSelected)
        }
      }
    }
  })

  return tour
}

/**
 * Starts the Grid-Sight walkthrough
 */
export function startWalkthrough(): void {
  // Cancel any existing tour
  if (activeTour) {
    activeTour.cancel()
  }

  // Create and start a new tour
  activeTour = createTour()
  activeTour.start()
}

// Add custom styles for the walkthrough
const addWalkthroughStyles = (): void => {
  const styleElement = document.createElement('style')
  styleElement.textContent = `
    .gs-shepherd-theme {
      max-width: 400px;
    }
    
    .gs-shepherd-theme h3 {
      font-size: 1.2em;
      margin-top: 0;
      margin-bottom: 0.5em;
      color: #1976d2;
    }
    
    .shepherd-button {
      background: #1976d2;
      border: none;
      color: white;
      cursor: pointer;
      margin-right: 0.5rem;
      padding: 0.5rem 1.5rem;
      border-radius: 3px;
      font-size: 0.9em;
    }
    
    .shepherd-button:hover {
      background: #1565c0;
    }
    
    .shepherd-button.shepherd-button-secondary {
      background: #f1f1f1;
      color: rgba(0, 0, 0, 0.75);
    }
    
    .shepherd-button.shepherd-button-secondary:hover {
      background: #e7e7e7;
      color: rgba(0, 0, 0, 0.95);
    }
    
    .shepherd-text p {
      margin-top: 0.5em;
    }
  `
  document.head.appendChild(styleElement)
}

// Initialize styles when this module is loaded
addWalkthroughStyles()
