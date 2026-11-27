// Search over packages, sections and items: prefix/substring scoring with a light fuzzy fallback.
// Decorator-free so vitest can cover it without Angular.
import type { ApiKind, PlaygroundDocs } from '../core/model'

export interface SearchDoc {
  /** Unique key, also used as the option id in the results list. */
  key: string
  type: 'package' | 'item'
  name: string
  summary: string
  module: string
  /** `@smartdevutils/core` */
  packageName: string
  pkgId: string
  sectionId?: string
  itemId?: string
  kind?: ApiKind
  sectionTitle?: string
  tags: string[]
  /** Lower-cased copies, computed once. */
  lname: string
  lsummary: string
  lmodule: string
  ltags: string[]
}

export interface SearchHit {
  doc: SearchDoc
  score: number
}

export function buildSearchIndex(docs: PlaygroundDocs): SearchDoc[] {
  const out: SearchDoc[] = []
  for (const pkg of docs.packages) {
    out.push(
      makeDoc({
        key: `p:${pkg.id}`,
        type: 'package',
        name: pkg.name,
        summary: pkg.description,
        module: pkg.name,
        packageName: pkg.name,
        pkgId: pkg.id,
        tags: ['package', pkg.id, ...pkg.frameworks],
      }),
    )
    for (const section of pkg.sections) {
      for (const item of section.items) {
        out.push(
          makeDoc({
            key: `i:${pkg.id}/${section.id}/${item.id}`,
            type: 'item',
            name: item.name,
            summary: item.summary,
            module: item.module,
            packageName: pkg.name,
            pkgId: pkg.id,
            sectionId: section.id,
            itemId: item.id,
            kind: item.kind,
            sectionTitle: section.title,
            tags: [item.kind, section.kind, section.title, ...(item.runtime ?? [])],
          }),
        )
      }
    }
  }
  return out
}

function makeDoc(d: Omit<SearchDoc, 'lname' | 'lsummary' | 'lmodule' | 'ltags'>): SearchDoc {
  return {
    ...d,
    lname: d.name.toLowerCase(),
    lsummary: d.summary.toLowerCase(),
    lmodule: d.module.toLowerCase(),
    ltags: d.tags.map((t) => t.toLowerCase()),
  }
}

/** Splits `fooBar-baz qux` into word starts so `bar` matches `fooBar` at a word boundary. */
function isWordStart(text: string, index: number, original: string): boolean {
  if (index === 0) return true
  const prev = text[index - 1]
  if (!/[a-z0-9]/.test(prev)) return true
  // camelCase boundary in the original casing
  const o = original[index]
  return o !== undefined && o >= 'A' && o <= 'Z' && !(original[index - 1] >= 'A' && original[index - 1] <= 'Z')
}

/** Characters of `needle` appear in order in `hay` (subsequence). */
function isSubsequence(needle: string, hay: string): boolean {
  let j = 0
  for (let i = 0; i < hay.length && j < needle.length; i++) if (hay[i] === needle[j]) j++
  return j === needle.length
}

/** Score one query token against one doc; 0 means no match. */
export function scoreToken(doc: SearchDoc, token: string): number {
  const name = doc.lname.replace(/^<|>$/g, '')
  if (name === token || doc.lname === token) return 100
  if (name.startsWith(token)) return 80
  const idx = name.indexOf(token)
  if (idx > 0) {
    // prefer word-boundary matches (camelCase, -, /, space)
    let i = idx
    while (i >= 0) {
      if (isWordStart(name, i, doc.name.replace(/^<|>$/g, ''))) return 60
      i = name.indexOf(token, i + 1)
    }
    return 45
  }
  if (doc.ltags.some((t) => t === token)) return 30
  if (doc.lmodule.includes(token)) return 25
  if (doc.ltags.some((t) => t.startsWith(token))) return 20
  if (doc.lsummary.includes(token)) return 12
  if (token.length >= 3 && isSubsequence(token, name)) return 6
  return 0
}

/**
 * Every whitespace-separated token must match somewhere; the doc's score is the sum. Ties keep items
 * with shorter names first, then index order.
 */
export function search(index: readonly SearchDoc[], query: string, limit = 20): SearchHit[] {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 8)
  if (!tokens.length) return []
  const hits: Array<SearchHit & { order: number }> = []
  index.forEach((doc, order) => {
    let total = 0
    for (const t of tokens) {
      const s = scoreToken(doc, t)
      if (!s) return
      total += s
    }
    if (doc.type === 'package') total += 5
    hits.push({ doc, score: total, order })
  })
  hits.sort((a, b) => b.score - a.score || a.doc.name.length - b.doc.name.length || a.order - b.order)
  return hits.slice(0, limit).map(({ doc, score }) => ({ doc, score }))
}
