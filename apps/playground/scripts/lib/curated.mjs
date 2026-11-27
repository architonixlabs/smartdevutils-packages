// Curated snippets: snippets/<package id>/*.{ts,tsx,js,html}, each starting with a front-matter block.
//
//   ts / tsx / js:                         html:
//   /* ---                                 <!-- ---
//   title: Hash a webhook body             title: A Base64 decoder
//   entry: hashing/sha256                  entry: elements/sdu-tool
//   description: Optional, one line.       --- -->
//   node: true
//   --- */
//
// Keys: title (required), entry (required, `<section id>/<item id>`; several entries separated by
// commas attach the same snippet to each), description, id (default: file name), mode (run | docs,
// default run), output (console | preview; default console for ts/js, preview for tsx/html),
// node (true when it runs in Node without a DOM; the test suite executes it), order (number, lower first).
import fs from 'node:fs'
import path from 'node:path'
import { SNIPPETS_DIR } from './paths.mjs'

const LANG_BY_EXT = { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.mjs': 'js', '.html': 'html' }
const KEYS = new Set(['title', 'entry', 'description', 'id', 'mode', 'output', 'node', 'order'])

const FRONT_MATTER = {
  script: /^\s*\/\*\s*---\s*\r?\n([\s\S]*?)\r?\n\s*---\s*\*\/\s*\r?\n?/,
  html: /^\s*<!--\s*---\s*\r?\n([\s\S]*?)\r?\n\s*---\s*-->\s*\r?\n?/,
}

export function parseFrontMatter(text, lang) {
  const re = lang === 'html' ? FRONT_MATTER.html : FRONT_MATTER.script
  const m = re.exec(text)
  if (!m) return null
  const meta = {}
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf(':')
    if (i < 0) throw new Error(`front matter line without "key: value": ${line}`)
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim()
    if (!KEYS.has(key)) throw new Error(`unknown front matter key "${key}"`)
    meta[key] = value
  }
  return { meta, code: text.slice(m[0].length).replace(/\s+$/, '') + '\n' }
}

/**
 * @returns {{ pkg: string, file: string, entries: { section: string, item: string }[], order: number, snippet: import('../../src/app/core/model').Snippet }[]}
 */
export function loadCurated(dir = SNIPPETS_DIR) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const pkg of fs.readdirSync(dir).sort()) {
    const pkgDir = path.join(dir, pkg)
    if (!fs.statSync(pkgDir).isDirectory()) continue
    for (const name of fs.readdirSync(pkgDir).sort()) {
      const ext = path.extname(name)
      const lang = LANG_BY_EXT[ext]
      if (!lang) continue
      const file = path.join(pkgDir, name)
      const parsed = parseFrontMatter(fs.readFileSync(file, 'utf8'), lang)
      if (!parsed) throw new Error(`${file}: missing front matter block`)
      const { meta, code } = parsed
      if (!meta.title) throw new Error(`${file}: front matter needs "title"`)
      if (!meta.entry) throw new Error(`${file}: front matter needs "entry"`)
      const entries = meta.entry.split(',').map((e) => {
        const [section, item, extra] = e.trim().split('/')
        if (!section || !item || extra !== undefined) throw new Error(`${file}: entry must be <section>/<item>, got "${e}"`)
        return { section, item }
      })
      const mode = meta.mode ?? 'run'
      if (mode !== 'run' && mode !== 'docs') throw new Error(`${file}: mode must be run or docs`)
      const output = meta.output ?? (lang === 'tsx' || lang === 'html' ? 'preview' : 'console')
      if (output !== 'console' && output !== 'preview') throw new Error(`${file}: output must be console or preview`)
      const node = meta.node === 'true'
      if (node && lang !== 'ts' && lang !== 'js') throw new Error(`${file}: only ts/js snippets can be node: true`)
      out.push({
        pkg,
        file,
        entries,
        order: meta.order ? Number(meta.order) : 0,
        snippet: {
          id: meta.id ?? path.basename(name, ext),
          title: meta.title,
          lang,
          code,
          mode,
          output,
          ...(meta.description ? { description: meta.description } : {}),
          source: 'curated',
          ...(node ? { node: true } : {}),
        },
      })
    }
  }
  return out
}
