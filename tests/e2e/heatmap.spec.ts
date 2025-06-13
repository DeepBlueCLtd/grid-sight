import { test, expect } from '@playwright/test'

/**
 * End-to-end tests for Grid-Sight heatmap functionality
 * 
 * These tests verify that heatmap enrichments can be applied and removed correctly
 */

test.describe('Grid-Sight Heatmap', () => {
  // Test setup - start server and navigate to demo page
  test.beforeEach(async ({ page }) => {
    // Start the preview server
    const { preview } = await import('vite')
    const server = await preview({
      preview: {
        port: 3001,
        open: false,
      },
      build: {
        outDir: 'dist'
      }
    })

    // Store the server in the test info
    test.info().attachments.push({
      name: 'server',
      body: Buffer.from(JSON.stringify(server as unknown as Record<string, unknown>)),
      contentType: 'application/json'
    })

    // Navigate to the demo page
    await page.goto('http://localhost:3001/demo/')
    
    // Wait for the page to load completely
    await page.waitForLoadState('domcontentloaded')
    
    // Wait for Grid-Sight to initialize
    await page.waitForFunction(() => {
      const consoleEl = document.getElementById('console')
      return consoleEl && consoleEl.textContent && 
             consoleEl.textContent.includes('GridSight loaded successfully')
    }, { timeout: 5000 })
  })

  // Close the server after each test
  test.afterEach(async ({ page: _page }, testInfo) => {
    // Get the server from the test info
    const serverAttachment = testInfo.attachments.find(a => a.name === 'server')
    if (serverAttachment && serverAttachment.body) {
      const server = JSON.parse(serverAttachment.body.toString())
      // Close the preview server
      await new Promise(resolve => server.httpServer.close(resolve))
    }
  })

  // Test table-wide heatmap toggle functionality
  test('should toggle table-wide heatmap on and off correctly', async ({ page }) => {
    // Get the first table
    const table = page.locator('table').first()
    
    // Open the table menu
    await page.click('.gs-table-header-menu-button')
    
    // Wait for the menu to appear
    await page.waitForSelector('.gs-menu-container')
    
    // Click on the heatmap option
    await page.getByText('Heatmap').click()
    
    // Wait for the heatmap to be applied
    await page.waitForFunction(() => {
      const table = document.querySelector('table')
      return table && table.classList.contains('gs-heatmap')
    }, { timeout: 5000 })
    
    // Verify that the table has the heatmap class
    await expect(table).toHaveClass(/gs-heatmap/)
    
    // Verify that cells have background colors (indicating heatmap is applied)
    const cellsWithColor = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('table td'))
      return cells.filter(cell => {
        const style = window.getComputedStyle(cell)
        return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
               style.backgroundColor !== 'rgb(255, 255, 255)' &&
               style.backgroundColor !== 'transparent'
      }).length
    })
    
    // Ensure we have cells with background color
    expect(cellsWithColor).toBeGreaterThan(0)
    
    // Toggle the heatmap off by clicking the menu option again
    await page.click('.gs-table-header-menu-button')
    await page.waitForSelector('.gs-menu-container')
    await page.getByText('Heatmap').click()
    
    // Wait for the heatmap to be removed
    await page.waitForFunction(() => {
      const table = document.querySelector('table')
      return table && !table.classList.contains('gs-heatmap')
    }, { timeout: 5000 })
    
    // Verify that the table no longer has the heatmap class
    await expect(table).not.toHaveClass(/gs-heatmap/)
    
    // Verify that cells no longer have background colors
    const cellsWithColorAfterToggle = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('table td'))
      return cells.filter(cell => {
        const style = window.getComputedStyle(cell)
        return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
               style.backgroundColor !== 'rgb(255, 255, 255)' &&
               style.backgroundColor !== 'transparent'
      }).length
    })
    
    // Ensure no cells have background color
    expect(cellsWithColorAfterToggle).toBe(0)
  })
})