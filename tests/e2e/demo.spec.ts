import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for the Grid-Sight demo page
 * 
 * These tests verify that the demo page loads correctly and that the Grid-Sight
 * library processes tables as expected.
 */

test.describe('Grid-Sight Demo', () => {
  // Test the demo page when served via HTTP
  test('should load and process tables via HTTP', async ({ page }) => {
    // Start the preview server
    const { preview } = await import('vite');
    const server = await preview({
      preview: {
        port: 3001, // Changed to 3001 to match our running server
        open: false,
      },
      build: {
        outDir: 'dist'
      }
    });

    try {
      // Navigate to the demo page
      await page.goto('http://localhost:3001/');
      
      // Wait for the page to load completely
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for the console output to show successful initialization
      await page.waitForFunction(() => {
        const consoleEl = document.getElementById('console');
        return consoleEl && consoleEl.textContent && 
               consoleEl.textContent.includes('GridSight loaded successfully');
      }, { timeout: 5000 });
      
      // Check that the Grid-Sight version is displayed
      await expect(page.locator('#version')).not.toBeEmpty();
      
      // Check that tables are processed
      const tables = page.locator('table');
      await expect(tables).toHaveCount(2); // We have 2 tables in the demo
      
      // Check that tables have the expected classes
      const table1 = tables.first();
      await expect(table1).toHaveClass(/inventory-table/);
      
      const table2 = tables.nth(1);
      await expect(table2).toHaveClass(/sales-table/);
      
      // Check that the console output shows successful initialization
      const consoleOutput = await page.locator('#console').textContent();
      expect(consoleOutput).toContain('DOM fully loaded');
      expect(consoleOutput).toContain('GridSight loaded successfully');
      
      // Check that tables have been processed by Grid-Sight
      await expect(table1).toHaveClass(/grid-sight-table/);
      await expect(table2).toHaveClass(/grid-sight-table/);
      
      // Check that tables have the data attribute set by Grid-Sight
      await expect(table1).toHaveAttribute('data-grid-sight-processed', 'true');
      await expect(table2).toHaveAttribute('data-grid-sight-processed', 'true');
      
    } finally {
      // Close the preview server
      await new Promise(resolve => server.httpServer.close(resolve));
    }
  });

  // Test the demo page when opened directly (file://)
  test('should load and process tables via file://', async ({ page }) => {
    // Skip this test in CI environment as file:// protocol has security restrictions
    test.skip(!!process.env.CI, 'Skipping file:// test in CI environment');
    
    // Navigate to the demo page directly
    await page.goto(`file://${process.cwd()}/dist/index.html`);
    
    // Wait for the page to load completely
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the console output to show successful initialization
    await page.waitForFunction(() => {
      const consoleEl = document.getElementById('console');
      return consoleEl && consoleEl.textContent && 
             consoleEl.textContent.includes('GridSight loaded successfully');
    }, { timeout: 5000 });
    
    // Check that the Grid-Sight version is displayed
    await expect(page.locator('#version')).not.toBeEmpty();
    
    // Check that tables are processed
    const tables = page.locator('table');
    await expect(tables).toHaveCount(2);
    
    // Check that tables have the expected classes
    const table1 = tables.first();
    await expect(table1).toHaveClass(/inventory-table/);
    
    const table2 = tables.nth(1);
    await expect(table2).toHaveClass(/sales-table/);
    
    // Check that the console output shows successful initialization
    const consoleOutput = await page.locator('#console').textContent();
    expect(consoleOutput).toContain('DOM fully loaded');
    expect(consoleOutput).toContain('GridSight loaded successfully');
    
    // Check that tables have been processed by Grid-Sight
    await expect(table1).toHaveClass(/grid-sight-table/);
    await expect(table2).toHaveClass(/grid-sight-table/);
    
    // Check that tables have the data attribute set by Grid-Sight
    await expect(table1).toHaveAttribute('data-grid-sight-processed', 'true');
    await expect(table2).toHaveAttribute('data-grid-sight-processed', 'true');
  });
});
