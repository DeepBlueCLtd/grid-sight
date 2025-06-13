import { describe, it, expect } from 'vitest'
import { normalizeCellValue, calculateFrequency, analyzeFrequencies } from '../../utils/frequency'

describe('normalizeCellValue', () => {
  it('handles empty values', () => {
    expect(normalizeCellValue('')).toBe('[Empty]')
    expect(normalizeCellValue('   ')).toBe('[Empty]')
    expect(normalizeCellValue(null)).toBe('[Empty]')
    expect(normalizeCellValue(undefined)).toBe('[Empty]')
  })

  it('trims whitespace', () => {
    expect(normalizeCellValue('  test  ')).toBe('test')
  })

  it('converts to lowercase', () => {
    expect(normalizeCellValue('TeSt')).toBe('test')
  })

  it('converts numbers to strings', () => {
    expect(normalizeCellValue(42)).toBe('42')
    expect(normalizeCellValue(3.14)).toBe('3.14')
  })
})

describe('calculateFrequency', () => {
  it('counts occurrences of each value', () => {
    const values = ['a', 'b', 'a', 'c', 'b', 'b']
    const result = calculateFrequency(values)
    expect(result).toEqual({
      a: 2,
      b: 3,
      c: 1
    })
  })

  it('handles case insensitivity', () => {
    const values = ['Apple', 'apple', 'BANANA', 'banana']
    const result = calculateFrequency(values)
    expect(result).toEqual({
      apple: 2,
      banana: 2
    })
  })

  it('handles empty array', () => {
    expect(calculateFrequency([])).toEqual({})
  })
})

describe('analyzeFrequencies', () => {
  it('calculates frequencies with percentages', () => {
    const values = ['a', 'b', 'a', 'c', 'b', 'b']
    const result = analyzeFrequencies(values)
    
    // Should be sorted alphabetically
    expect(result).toEqual([
      ['a', 2, 33.3],
      ['b', 3, 50],
      ['c', 1, 16.7]
    ])
  })

  it('handles empty values', () => {
    const values = ['', ' ', null, undefined, 'a']
    const result = analyzeFrequencies(values)
    
    expect(result).toEqual([
      ['[Empty]', 4, 80],
      ['a', 1, 20]
    ])
  })

  it('returns empty array for empty input', () => {
    expect(analyzeFrequencies([])).toEqual([])
  })
})
