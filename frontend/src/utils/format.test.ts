import { describe, it, expect } from 'vitest'
import {
  hashColor,
  initials,
  formatDate,
  formatSalary,
  truncate,
  scoreColor,
  scoreLabel,
} from './format'

describe('hashColor', () => {
  it('returns a deterministic HSL color for the same input', () => {
    expect(hashColor('Acme Corp')).toBe(hashColor('Acme Corp'))
  })

  it('returns different colors for different inputs', () => {
    expect(hashColor('Acme Corp')).not.toBe(hashColor('Globex Inc'))
  })

  it('always returns a valid HSL string', () => {
    expect(hashColor('x')).toMatch(/^hsl\(\d+, 55%, 45%\)$/)
  })
})

describe('initials', () => {
  it('takes the first letter of up to two words', () => {
    expect(initials('Acme Corp')).toBe('AC')
  })

  it('handles a single word', () => {
    expect(initials('Netflix')).toBe('N')
  })

  it('splits on commas and ampersands', () => {
    expect(initials('Smith & Co')).toBe('SC')
    expect(initials('Acme, Inc')).toBe('AI')
  })
})

describe('formatDate', () => {
  it('returns an em dash for missing dates', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
  })

  it('labels today as "Today"', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(formatDate(today)).toBe('Today')
  })

  it('labels yesterday as "1d ago"', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    expect(formatDate(yesterday)).toBe('1d ago')
  })
})

describe('formatSalary', () => {
  it('returns an em dash for missing salary', () => {
    expect(formatSalary(null)).toBe('—')
  })

  it('passes short strings through unchanged', () => {
    expect(formatSalary('$80k - $100k')).toBe('$80k - $100k')
  })

  it('truncates long strings with an ellipsis', () => {
    const long = 'A'.repeat(40)
    expect(formatSalary(long)).toHaveLength(29)
    expect(formatSalary(long).endsWith('…')).toBe(true)
  })
})

describe('truncate', () => {
  it('returns an empty string for falsy input', () => {
    expect(truncate(null, 10)).toBe('')
  })

  it('leaves short strings untouched', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates and appends an ellipsis when over the limit', () => {
    expect(truncate('hello world', 5)).toBe('hello…')
  })
})

describe('scoreColor / scoreLabel', () => {
  it('grades excellent scores (>= 75)', () => {
    expect(scoreLabel(90)).toBe('Excellent')
    expect(scoreColor(90)).toBe('#00ff88')
  })

  it('grades good scores (>= 50)', () => {
    expect(scoreLabel(60)).toBe('Good')
    expect(scoreColor(60)).toBe('#fbbf24')
  })

  it('grades fair scores (>= 25)', () => {
    expect(scoreLabel(30)).toBe('Fair')
    expect(scoreColor(30)).toBe('#f97316')
  })

  it('grades low scores (< 25)', () => {
    expect(scoreLabel(10)).toBe('Low')
    expect(scoreColor(10)).toBe('#ef4444')
  })
})
