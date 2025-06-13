# Grid-Sight Walkthrough Feature

This document describes the interactive walkthrough feature implemented for the Grid-Sight demo.

## Overview

The walkthrough is a guided tour that introduces new users to Grid-Sight's key features. It consists of three steps:

1. **Introduction**: A centered modal that introduces Grid-Sight and its purpose.
2. **G-S Toggle**: Highlights the Grid-Sight toggle button and prompts the user to click it.
3. **Plus Icons**: Highlights the plus icons and encourages the user to interact with the enrichment menu.

## Implementation Details

The walkthrough is implemented using [Shepherd.js](https://shepherdjs.dev/), a lightweight JavaScript library for creating guided tours. The implementation is contained in the demo file (`public/index.html`) and includes:

- A "Start Walkthrough" button in the header
- Custom styling for the tour to match Grid-Sight's UI
- Event-based advancement that waits for user actions before proceeding
- A custom event listener for the enrichment menu selection

## Key Features

- **Event-Based Advancement**: The walkthrough waits for specific user actions before moving to the next step.
- **Interactive Elements**: Users must click the G-S toggle and interact with the plus icons to complete the tour.
- **Custom Styling**: The walkthrough UI is styled to match Grid-Sight's design language.

## How to Use

1. Open the Grid-Sight demo page
2. Click the "Start Walkthrough" button in the header
3. Follow the instructions in each step to learn about Grid-Sight's features

## Technical Notes

- The walkthrough uses Shepherd.js loaded via CDN
- It listens for custom events (`gridsight:enrichmentSelected`) to detect user interactions
- The tour is configured to use a modal overlay to focus attention on highlighted elements
- Each step includes a `beforeShowPromise` to ensure target elements are available before showing

## Customization

To modify the walkthrough:

1. Edit the `createWalkthrough` function in `public/index.html`
2. Adjust the step content, target elements, or styling as needed
3. Update the event listeners if the interaction model changes
