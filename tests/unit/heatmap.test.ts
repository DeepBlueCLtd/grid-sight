import { describe, it, expect, beforeEach, vi } from 'vitest'

import * as HeatmapModule from '../../src/enrichments/heatmap.ts'
const { toggleHeatmap } = HeatmapModule

describe('Heatmap Toggle', () => {
  let mockTable: HTMLTableElement

  beforeEach(() => {
    // Create a mock table element
    mockTable = document.createElement('table') as HTMLTableElement
    
    // Create spies on actual functions
    const mockIsHeatmapActive = vi.spyOn(HeatmapModule, 'isHeatmapActive')
    const mockApplyTableHeatmap = vi.spyOn(HeatmapModule, 'applyTableHeatmap')
    const mockRemoveHeatmap = vi.spyOn(HeatmapModule, 'removeHeatmap')

    mockIsHeatmapActive.mockReset()
    mockApplyTableHeatmap.mockReset()
    mockRemoveHeatmap.mockReset()
  })

  it('should apply table heatmap when not active', () => {
    // Setup: heatmap is not active
    vi.spyOn(HeatmapModule, 'isHeatmapActive').mockReturnValue(false)
    
    // Execute
    toggleHeatmap(mockTable, -1, 'table')
    
    // Verify
    expect(HeatmapModule.isHeatmapActive).toHaveBeenCalledWith(mockTable, -1, 'table')
    expect(HeatmapModule.applyTableHeatmap).toHaveBeenCalledWith(mockTable, {})
    expect(HeatmapModule.removeHeatmap).not.toHaveBeenCalled()
  })

  it('should remove table heatmap when already active', () => {
    // Setup: heatmap is active
    vi.spyOn(HeatmapModule, 'isHeatmapActive').mockReturnValue(true)
    
    // Execute
    toggleHeatmap(mockTable, -1, 'table')
    
    // Verify
    expect(HeatmapModule.isHeatmapActive).toHaveBeenCalledWith(mockTable, -1, 'table')
    expect(HeatmapModule.removeHeatmap).toHaveBeenCalledWith(mockTable, -1, 'table')
    expect(HeatmapModule.applyTableHeatmap).not.toHaveBeenCalled()
  })
})
