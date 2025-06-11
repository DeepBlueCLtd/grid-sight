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
        port: 3000,
        open: false,
      },
      build: {
        outDir: 'dist'
      }
    });

    try {
      // Navigate to the demo page
      await page.goto('http://localhost:3000/demo');
      
      // Wait for the page to load completely
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for the version element to be visible
      await page.waitForSelector('#version', { state: 'visible' });
      
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
      expect(consoleOutput).toContain('GridSight loaded successfully');
      expect(consoleOutput).toMatch(/Found \d+ tables on the page/);
      
    } finally {
      // Close the server
      await new Promise(resolve => server.httpServer.close(resolve));
    }
  });

  // Test the demo page when opened directly (file://)
  test('should load and process tables via file://', async ({ page }) => {
    // Build the project first to ensure dist/demo exists
    const { execSync } = await import('child_process');
    execSync('yarn build', { stdio: 'inherit' });
    
    // Get the absolute path to the demo file
    const path = await import('path');
    const demoPath = 'file://' + path.resolve(process.cwd(), 'dist', 'demo', 'index.html');
    
    // Navigate to the demo page
    await page.goto(demoPath);
    
    // Wait for the page to load completely
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the version element to be visible
    await page.waitForSelector('#version', { state: 'visible' });
    
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
    expect(consoleOutput).toContain('GridSight loaded successfully');
    expect(consoleOutput).toMatch(/Found \d+ tables on the page/);
  });
});
