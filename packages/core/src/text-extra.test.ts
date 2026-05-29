import { describe, it, expect } from 'vitest'
import { readabilityScore, csvToMarkdownTable, markdownToHtml, htmlToMarkdown, detectNullValues, numberFormat } from './text-extra'

describe('readabilityScore', () => {
  it('returns fleschEase, fleschKincaid, level', () => {
    const result = readabilityScore('The cat sat on the mat. It was a fat cat.')
    expect(result).toHaveProperty('fleschEase')
    expect(result).toHaveProperty('fleschKincaid')
    expect(result).toHaveProperty('level')
  })
  it('short simple text has high fleschEase', () => {
    const { fleschEase } = readabilityScore('I ran. She ran. We ran.')
    expect(fleschEase).toBeGreaterThan(70)
  })
})

describe('csvToMarkdownTable', () => {
  it('produces markdown table from csv', () => {
    const result = csvToMarkdownTable('name,age\nAlice,30')
    expect(result).toContain('| name | age |')
    expect(result).toContain('| Alice | 30 |')
    expect(result).toContain('| --- | --- |')
  })
})

describe('markdownToHtml', () => {
  it('converts # heading to h1', () => {
    expect(markdownToHtml('# Hello')).toContain('<h1')
  })
  it('converts **bold** to strong', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>')
  })
})

describe('htmlToMarkdown', () => {
  it('converts <h1> to # heading', () => {
    expect(htmlToMarkdown('<h1>Hello</h1>')).toContain('# Hello')
  })
  it('converts <strong> to **bold**', () => {
    expect(htmlToMarkdown('<strong>bold</strong>')).toContain('**bold**')
  })
  it('strips unknown tags', () => {
    expect(htmlToMarkdown('<div>text</div>')).toContain('text')
  })
})

describe('detectNullValues', () => {
  it('detects empty string', () => { expect(detectNullValues('').isEmpty).toBe(true) })
  it('detects whitespace only', () => { expect(detectNullValues('   ').isWhitespace).toBe(true) })
  it('detects null literal', () => { expect(detectNullValues('null').isNullLiteral).toBe(true) })
  it('detects NULL literal', () => { expect(detectNullValues('NULL').isNullLiteral).toBe(true) })
  it('non-null value returns all false', () => {
    const r = detectNullValues('hello')
    expect(r.isEmpty).toBe(false)
    expect(r.isWhitespace).toBe(false)
    expect(r.isNullLiteral).toBe(false)
  })
})

describe('numberFormat', () => {
  it('formats with locale en-US', () => {
    expect(numberFormat(1234567.89, 'en-US')).toBe('1,234,567.89')
  })
  it('uses default locale when omitted', () => {
    expect(typeof numberFormat(1000)).toBe('string')
  })
})
