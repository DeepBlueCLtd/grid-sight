
# Grid-Sight BDD Test Specification (Pseudocode)

This document provides detailed, behavior-driven pseudocode tests for **Grid-Sight**, based on the requirements and technical architecture. Tests are grouped by feature and aim to provide high coverage of both happy and error paths.

---

## ✅ Core Injection Tests

### Feature: Auto-inject Grid-Sight toggle

**Scenario: Detect table on page load**
```
Given a page contains a valid <table> with <thead> and <tbody>
When Grid-Sight loads
Then a GS toggle appears adjacent to the top-right of the table
And a plus icon appears inside the top-left cell
```

**Scenario: Table with no headers**
```
Given a page contains a <table> without <th> tags
When Grid-Sight loads
Then no GS toggle should be injected
And an error log should mention "invalid table structure"
```

**Scenario: Dynamic table injected via JavaScript**
```
Given Grid-Sight is active
And a <table> is dynamically added to the DOM
When the table meets valid structure
Then Grid-Sight should auto-enrich it
```

---

## 📊 Enrichment UI Controls

### Feature: Table-level control panel

**Scenario: Toggle enrichment mode**
```
Given a table with Grid-Sight toggle
When the toggle is enabled
Then column and row headers should show '+' icons
```

**Scenario: Plus icon context menu**
```
Given the '+' icon is clicked
When the context menu opens
Then it should list available enrichments
```

**Scenario: Multiple tables on page**
```
Given there are 2+ valid tables
When page-level GS control is toggled
Then all tables should show individual toggles
And enrichment applies independently to each
```

---

## 🌡️ Heatmap Enrichment

**Scenario: Apply heatmap**
```
Given a table with numeric cell values
And the user enables heatmap from the context menu
Then each cell should be shaded proportionally to its value
And min/max values should be used for color scaling
```

**Scenario: Non-numeric data in cell**
```
Given a table with some cells containing text
When heatmap is applied
Then non-numeric cells should be skipped
And a warning logged to console
```

---

## 🧠 Statistical Tools

### Feature: Z-score enrichment

**Scenario: Apply z-score highlighting**
```
Given a row with numeric data
When Z-score is applied
Then outliers above threshold should be marked visually
And mean/stddev reported in the config
```

**Scenario: Insufficient data for stats**
```
Given a column with fewer than 2 numeric entries
When Z-score enrichment is triggered
Then the enrichment should be disabled
And a tooltip should explain the reason
```

---

## 📦 Persistence & Config

### Feature: Save config per table and URL

**Scenario: Save enrichment to localStorage**
```
Given a user applies heatmap to a table
When they reload the page
Then the table should be automatically re-enriched
Using the stored config tied to the page's URL stem
```

**Scenario: Apply global defaults**
```
Given a global config is defined
And no page-specific config exists
Then Grid-Sight should apply the global config to all tables
```

**Scenario: Corrupted localStorage config**
```
Given the stored JSON is malformed
When Grid-Sight loads
Then the config should be reset
And the user warned in the console
```

---

## 🔍 Search & Highlight

**Scenario: Find cells matching value**
```
Given a user types '67' in the search box
Then all cells containing '67' should be highlighted
And coordinates displayed in the status panel
```

**Scenario: Search value not found**
```
When the user types a non-existent value
Then no cells should be highlighted
And a 'no matches found' message displayed
```

---

## 📉 Chart Overlays (Planned)

**Scenario: Generate chart from row**
```
Given a user selects a row
When 'Plot row' is selected from enrichment menu
Then a chart overlay should appear
Displaying row values with matching x-axis labels
```

**Scenario: Missing chart library**
```
Given uPlot is not bundled
When the user attempts to plot
Then an error is logged and no chart shown
```

---

## 🧪 Robustness Tests

**Scenario: Table with deeply nested HTML**
```
Given a table with <div> or <span> wrappers inside <td>
When Grid-Sight parses values
Then innerText should be extracted
And only numeric parts parsed
```

**Scenario: External CSS interference**
```
Given a page with global styles overriding table appearance
When Grid-Sight is active
Then injected styles should remain visually distinguishable
Using !important if necessary
```

---

## 🧩 UI Accessibility

**Scenario: Keyboard navigation**
```
Given a user is navigating with Tab
When focus reaches GS toggle or plus icon
Then it should be focusable
And pressing Enter should open the menu
```

**Scenario: Screen reader compatibility**
```
Then all injected elements must have aria-labels
And not disrupt the original table semantics
```

---
