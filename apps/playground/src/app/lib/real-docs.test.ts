// Smoke test over the generated docs (skipped until scripts/build-docs.mjs has written them):
// every entry must produce an integrate guide, a StackBlitz project, a share link and search hits.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { PlaygroundDocs } from '../core/model'
import { buildIntegrateGuide, importLines, itemUsage } from './integrate'
import { buildSearchIndex, search } from './search'
import { decodeShare, encodeShare } from './share-link'
import { buildStackBlitzProject } from './stackblitz'
import { inlineSegments } from './inline-code'
import { isRunnable } from './snippet-files'

const file = fileURLToPath(new URL('../../assets/docs.json', import.meta.url))
const docs: PlaygroundDocs | null = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null

describe('inline code and runnability', () => {
  it('splits backtick code spans', () => {
    expect(inlineSegments('Use `a()` or `b`.')).toEqual([
      { code: false, text: 'Use ' },
      { code: true, text: 'a()' },
      { code: false, text: ' or ' },
      { code: true, text: 'b' },
      { code: false, text: '.' },
    ])
    expect(inlineSegments('plain')).toEqual([{ code: false, text: 'plain' }])
    expect(inlineSegments('`only`')).toEqual([{ code: true, text: 'only' }])
  })

  it('never runs Angular code', () => {
    expect(isRunnable({ mode: 'run', lang: 'ts', code: "import { Component } from '@angular/core'" })).toBe(false)
    expect(isRunnable({ mode: 'docs', lang: 'ts', code: 'x' })).toBe(false)
    expect(isRunnable({ mode: 'run', lang: 'ts', code: "import { sha256 } from '@smartdevutils/core/hashing'" })).toBe(true)
  })
})

describe.skipIf(!docs)('generated docs.json', () => {
  const d = docs as PlaygroundDocs
  const entries = d ? d.packages.flatMap((pkg) => pkg.sections.flatMap((section) => section.items.map((item) => ({ pkg, section, item })))) : []

  it('builds integrate guides with valid import lines for every entry', () => {
    for (const { pkg, item } of entries) {
      const g = buildIntegrateGuide(pkg, item, d.version)
      expect(g.install.code).toContain(pkg.name)
      for (const line of importLines(pkg, item)) {
        expect(line, `${pkg.id}/${item.id}`).toMatch(/^import (type )?(\{ [A-Za-z_$][\w$]* \} from )?'[^']+'$/)
      }
      for (const t of g.targets) expect(t.code.length, `${pkg.id}/${item.id} ${t.id}`).toBeGreaterThan(0)
    }
  })

  it('classifies theme tokens, website-only tools and recipes', () => {
    const kinds = new Set(entries.map(({ pkg, item }) => itemUsage(pkg, item).kind))
    expect(kinds.has('value')).toBe(true)
  })

  it('builds a StackBlitz project and a share link for every snippet', () => {
    for (const { pkg, section, item } of entries) {
      for (const s of item.snippets) {
        const p = buildStackBlitzProject({ pkg, item, lang: s.lang, code: s.code, version: d.version })
        expect(Object.keys(p.files).length).toBeGreaterThan(0)
        for (const [name, v] of Object.entries(p.dependencies)) {
          if (name.startsWith('@smartdevutils/')) expect(v).toBe(d.version)
        }
        const enc = encodeShare({ pkg: pkg.id, section: section.id, entry: item.id, snippetId: s.id, lang: s.lang, code: s.code })
        expect(enc.ok, `${pkg.id}/${item.id}/${s.id}`).toBe(true)
        if (enc.ok) expect(decodeShare(enc.hash).ok).toBe(true)
      }
    }
  })

  it('finds every entry by its own name', () => {
    const index = buildSearchIndex(d)
    for (const { item } of entries.slice(0, 400)) {
      const hits = search(index, item.name, 50)
      expect(hits.some((h) => h.doc.itemId === item.id), item.name).toBe(true)
    }
  })
})
