import { describe, expect, it } from 'vitest'
import { DOCS_FIXTURE } from '../testing/docs.fixture'
import { buildSearchIndex, scoreToken, search } from './search'
import { findEntry, findPackage, packageReadme, shortName } from './docs-lookup'

const index = buildSearchIndex(DOCS_FIXTURE)

describe('buildSearchIndex', () => {
  it('indexes every package and item', () => {
    const items = DOCS_FIXTURE.packages.flatMap((p) => p.sections.flatMap((s) => s.items))
    expect(index).toHaveLength(DOCS_FIXTURE.packages.length + items.length)
    expect(new Set(index.map((d) => d.key)).size).toBe(index.length)
  })
})

describe('search', () => {
  it('returns nothing for an empty query', () => {
    expect(search(index, '   ')).toEqual([])
  })

  it('ranks exact and prefix name matches first', () => {
    expect(search(index, 'sha256')[0].doc.itemId).toBe('sha256')
    const b64 = search(index, 'base64')
    expect(b64.slice(0, 2).map((h) => h.doc.name)).toEqual(['base64Encode', 'base64Decode'])
  })

  it('matches camelCase word starts above plain substrings', () => {
    const doc = index.find((d) => d.itemId === 'base64encode')!
    expect(scoreToken(doc, 'encode')).toBe(60)
    expect(scoreToken(doc, 'ncode')).toBe(45)
  })

  it('searches module, package, summary and tags', () => {
    expect(search(index, 'hashing').some((h) => h.doc.itemId === 'sha256')).toBe(true)
    expect(search(index, 'lowercase hex')[0].doc.itemId).toBe('sha256')
    expect(search(index, 'element').some((h) => h.doc.itemId === 'sdu-tool')).toBe(true)
    expect(search(index, 'react')[0].doc.type).toBe('package')
  })

  it('requires every token to match', () => {
    expect(search(index, 'sha256 zebra')).toEqual([])
    expect(search(index, 'decode base64').some((h) => h.doc.itemId === 'base64decode')).toBe(true)
  })

  it('matches element tags without angle brackets', () => {
    expect(search(index, 'sdu-tool')[0].doc.itemId).toBe('sdu-tool')
  })

  it('has a fuzzy fallback and respects the limit', () => {
    expect(search(index, 'b64enc').some((h) => h.doc.itemId === 'base64encode')).toBe(true)
    expect(search(index, 'e', 3)).toHaveLength(3)
  })
})

describe('docs lookup', () => {
  it('finds packages, entries and readmes', () => {
    expect(findPackage(DOCS_FIXTURE, 'core')?.name).toBe('@smartdevutils/core')
    expect(findEntry(DOCS_FIXTURE, 'core', 'hashing', 'sha256')?.item.name).toBe('sha256')
    expect(findEntry(DOCS_FIXTURE, 'core', 'hashing', 'nope')).toBeUndefined()
    expect(findEntry(DOCS_FIXTURE, 'nope', 'hashing', 'sha256')).toBeUndefined()
    expect(packageReadme(findPackage(DOCS_FIXTURE, 'core')!)).toContain('# @smartdevutils/core')
    expect(shortName('@smartdevutils/core')).toBe('core')
  })
})
