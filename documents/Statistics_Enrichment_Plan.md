# Statistics Enrichment Feature Plan

## Overview
This document outlines the plan for implementing a Statistics enrichment feature for Grid-Sight. The feature will allow users to view and copy statistical information about numeric columns in data tables.

## Feature Requirements
- Calculate basic statistics for numeric columns (min, max, mean, median, sum, count)
- Display statistics in a popup panel when the Statistics option is selected from the enrichment menu
- Include a "Copy to Clipboard" button to copy the statistics
- Make the feature available only for numeric columns

## Technical Implementation

### 1. Update Enrichment Type Definition
- Add 'statistics' to the `EnrichmentType` union type in `enrichment-menu.ts`
- Add a new menu item to `ENRICHMENT_ITEMS` that's only available for numeric columns

### 2. Create Statistics Module
**File:** `src/enrichments/statistics.ts`

Core functions:
- `calculateStatistics(values: number[]): StatisticsResult` - Computes statistics
- `showStatisticsPopup(anchor: HTMLElement, stats: StatisticsResult): void` - Displays the popup
- `copyToClipboard(text: string): Promise<void>` - Handles copying to clipboard

Type definitions:
```typescript
interface StatisticsResult {
  min: number;
  max: number;
  mean: number;
  median: number;
  sum: number;
  count: number;
  stdDev?: number; // Optional: Standard deviation
  variance?: number; // Optional: Variance
}
```

### 3. UI Components
**File:** `src/ui/statistics-popup.ts`

Create a reusable popup component that:
- Positions itself relative to the clicked header
- Displays statistics in a clean, tabular format
- Includes a "Copy to Clipboard" button
- Handles click-outside to close
- Has proper ARIA attributes for accessibility

### 4. Integration
- Update `handleEnrichmentSelected` in `toggle-injector.ts` to handle the 'statistics' case
- Extract numeric values from the selected column/row
- Pass data to the statistics module

## Testing Strategy

### Unit Tests
1. Test `calculateStatistics` with various inputs:
   - Empty array
   - Single value
   - Even/odd number of values
   - Negative numbers
   - Decimal numbers
   - Large numbers

2. Test UI components:
   - Popup positioning
   - Copy functionality
   - Accessibility

### Integration Tests
1. Test full flow from menu click to popup display
2. Test copy to clipboard functionality
3. Test with different table structures

### Storybook
Add stories that demonstrate:
- Basic usage
- Edge cases (empty columns, etc.)
- Different data distributions

## Implementation Phases

### Phase 1: Core Functionality
- [ ] Add statistics type and menu item
- [ ] Implement basic statistics calculation
- [ ] Show simple alert with results

### Phase 2: UI Implementation
- [ ] Create popup component
- [ ] Add copy to clipboard functionality
- [ ] Implement proper styling and animations

### Phase 3: Testing & Polish
- [ ] Write unit tests
- [ ] Add integration tests
- [ ] Update documentation
- [ ] Performance optimizations if needed

## Files to Modify/Create

### Modified Files
- `src/ui/enrichment-menu.ts` - Add new menu item
- `src/ui/toggle-injector.ts` - Handle statistics selection

### New Files
- `src/enrichments/statistics.ts` - Core statistics functionality
- `src/ui/statistics-popup.ts` - UI component for displaying stats
- `src/__tests__/statistics.test.ts` - Unit tests
- `src/stories/Statistics.stories.ts` - Storybook examples

## Accessibility Considerations
- Ensure the popup is keyboard navigable
- Add appropriate ARIA attributes
- Support screen readers with proper announcements
- Ensure sufficient color contrast

## Performance Considerations
- Memoize statistics calculations
- Debounce rapid menu interactions
- Clean up event listeners when popup is closed

## Future Enhancements
1. Add more statistical measures (standard deviation, variance, etc.)
2. Support for custom percentiles
3. Visual representation (mini histogram/chart)
4. Export statistics in different formats (CSV, JSON)
5. Compare statistics between columns

## Dependencies
- **simple-statistics** (v7.8.0+)
  - Lightweight statistics library (16KB minified)
  - Zero dependencies
  - MIT licensed
  - Provides all needed statistical functions:
    - `mean()`, `median()`
    - `min()`, `max()`
    - `standardDeviation()`, `variance()`
    - `quantile()`, `interquartileRange()`
- Uses existing DOM APIs for clipboard functionality

### Installation
```bash
yarn add simple-statistics@^7.8.0
```

### Usage Example
```typescript
import { mean, median, standardDeviation, sampleVariance } from 'simple-statistics';

const values = [1, 2, 3, 4, 5];
const stats = {
  mean: mean(values),
  median: median(values),
  stdDev: standardDeviation(values),
  variance: sampleVariance(values)
};
```

## Timeline
- Phase 1: 2 days
- Phase 2: 3 days
- Phase 3: 2 days
- Buffer: 1 day

**Total Estimated Time:** 8 business days
