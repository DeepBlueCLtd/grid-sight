
# Grid-Sight AI-Driven Test Development Plan

This document provides a dependency-ordered list of BDD tests, each with an AI development prompt. These prompts are suitable for AI agents or developers working incrementally and independently.

---

## ✅ 1. Table Detection and Toggle Injection
**Status: complete**

### AI Prompt
> As a **Frontend Developer**, specializing in JavaScript, it is your goal to write a test for:  
> **"Detect valid HTML tables on page load and inject GS toggle and + icon."**  
> You will write the test first, then execute `npm run test:table-scan` and continue to fix errors until the test passes.  
> Follow SOLID and DRY principles, use one class/module per file, and do not write God components. Only work on this test and wait for endorsement before continuing.

---

## ✅ 2. Toggle UI Control Behavior
**Status: complete**

### AI Prompt
> As a **UI Engineer**, specializing in JavaScript, it is your goal to test:  
> **"Enable enrichment mode via GS toggle and display plus icons on table headers."**  
> You will write a component test using Storybook, then execute `npm run test:toggle-ui`. Continue iterating until the toggle panel appears and is functional.

---

## ✅ 3. Context Menu Interaction
**Status: complete**

### AI Prompt
> As a **UI Interaction Engineer**, your goal is to implement and test:  
> **"Clicking plus icons opens a context menu with enrichment options."**  
> Write a Storybook test for this UI behavior and validate via `npm run test:plus-context`. Use proper event delegation and accessibility labels.

---

## ✅ 4. Multiple Table Handling

### AI Prompt
> As a **DOM Integration Engineer**, your task is to implement a test for:  
> **"Multiple valid tables should be enriched independently when the page toggle is used."**  
> Write a test simulating multiple `<table>` tags, then execute `npm run test:multi-table`.

---

## ✅ 5. Heatmap Enrichment

### AI Prompt
> As a **Data Visualization Developer**, you must test:  
> **"Apply heatmap shading based on cell values; skip non-numeric cells."**  
> Write a test using Storybook and verify DOM styles. Run `npm run test:heatmap`.

---

## ✅ 6. Axis Coordinate Highlighting

### AI Prompt
> As a **UX Developer**, test:  
> **"Highlight row and column headers as the user hovers through the table."**  
> This test is UI-focused. Write Storybook visual tests and validate with `npm run test:highlight-axis`.

---

## ✅ 7. Z-score Enrichment and Outlier Detection

### AI Prompt
> As a **Data Scientist in JS**, test:  
> **"Use simple-statistics to apply z-score enrichment and detect outliers."**  
> Write the unit test, then run `npm run test:zscore`. Include both happy and error paths (e.g., insufficient data).

---

## ✅ 8. Search & Match

### AI Prompt
> As a **Search Logic Developer**, test:  
> **"Match values in table cells based on user input; highlight matches."**  
> Build a component test in Storybook, then validate with `npm run test:search`.

---

## ✅ 9. Persistence Layer (localStorage)

### AI Prompt
> As a **Persistence Engineer**, test:  
> **"Save enrichment configuration per table and apply on reload."**  
> Write a test to serialize, store, and rehydrate settings. Run `npm run test:storage`.

---

## ✅ 10. Error Recovery (Corrupt Configs)

### AI Prompt
> As a **Resilience Developer**, test:  
> **"Detect malformed configs in localStorage and reset them cleanly."**  
> Write test cases with invalid JSON strings. Run `npm run test:corrupt-config`.

---

## ✅ 11. Chart Overlays (Optional/Planned)

### AI Prompt
> As a **Data Chart Developer**, test:  
> **"Render line chart from selected table row using uPlot."**  
> Requires mock row data. Validate via Storybook using `npm run test:chart`.

---

## ✅ 12. Accessibility and Keyboard Nav

### AI Prompt
> As an **Accessibility Specialist**, test:  
> **"Ensure all interactive Grid-Sight UI elements are focusable and screen-reader compatible."**  
> Validate ARIA labels, keyboard shortcuts, and visual focus. Run `npm run test:a11y`.

---
