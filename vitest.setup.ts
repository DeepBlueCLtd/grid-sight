// Setup file for Vitest tests
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock browser APIs that might not be available in the test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Add any other global mocks or setup needed for your tests
