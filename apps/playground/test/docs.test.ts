// The docs generator's output (src/assets/docs.json) against the contract in src/app/core/model.ts.
import { beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
// @ts-expect-error: plain ESM scripts without type declarations
import { buildDocs } from '../scripts/build-docs.mjs'
// @ts-expect-error: plain ESM scripts without type declarations
import { APP_DIR, PACKAGES_DIR, PACKAGE_IDS, RUN_DIR, TOOL_EXAMPLES_SNAPSHOT } from '../scripts/lib/paths.mjs'
// @ts-expect-error: plain ESM scripts without type declarations
import { loadToolExamples, snapshotOf } from '../scripts/lib/tools.mjs'
// @ts-expect-error: plain ESM scripts without type declarations
import { readPackageApi } from '../scripts/lib/api.mjs'
// @ts-expect-error: plain ESM scripts without type declarations
import { loadCurated, parseFrontMatter } from '../scripts/lib/curated.mjs'
import type { ApiItem, PlaygroundDocs, Snippet } from '../src/app/core/model'

const SIZE_BUDGET = 2 * 1024 * 1024
const URL_SAFE = /^[A-Za-z0-9_-]+$/

let docs: PlaygroundDocs
let json: string

const allItems = () =>
  docs.packages.flatMap((p) => p.sections.flatMap((s) => s.items.map((i) => ({ p, s, i }))))
const allSnippets = () => allItems().flatMap(({ p, s, i }) => i.snippets.map((sn) => ({ p, s, i, sn })))

beforeAll(async () => {
  const result = await buildDocs({ quiet: true })
  docs = result.docs
  json = JSON.stringify(docs)
}, 120_000)

describe('docs.json contract', () => {
  it('type-checks against PlaygroundDocs in model.ts (no missing or extra fields)', () => {
    fs.mkdirSync(RUN_DIR, { recursive: true })
    const file = path.join(RUN_DIR, `docs-contract-${process.pid}.ts`)
    const modelPath = path.join(APP_DIR, 'src', 'app', 'core', 'model').replace(/\\/g, '/')
    fs.writeFileSync(
      file,
      `import type { PlaygroundDocs } from '${modelPath}'\nexport const docs = ${json} satisfies PlaygroundDocs\n`,
    )
    try {
      const program = ts.createProgram([file], { strict: true, noEmit: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2022 })
      const diags = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      expect(diags.slice(0, 5)).toEqual([])
    } finally {
      fs.rmSync(file, { force: true })
    }
  }, 120_000)

  it('stays within the size budget', () => {
    console.log(`docs.json: ${(json.length / 1024).toFixed(0)} kB`)
    expect(json.length).toBeLessThan(SIZE_BUDGET)
  })

  it('has every package, all on the shared version', () => {
    expect(docs.packages.map((p) => p.id)).toEqual(PACKAGE_IDS)
    for (const p of docs.packages) {
      const pj = JSON.parse(fs.readFileSync(path.join(PACKAGES_DIR, p.id, 'package.json'), 'utf8'))
      expect(p.name).toBe(pj.name)
      expect(p.version).toBe(pj.version)
      expect(p.version).toBe(docs.version)
      expect(p.install).toMatch(new RegExp(`^npm install ${pj.name.replace('/', '\\/')}`))
      expect(p.exports).toEqual(Object.keys(pj.exports))
      expect(p.frameworks.length).toBeGreaterThan(0)
      expect(p.sections[0]?.kind).toBe('overview')
      expect(p.sections[0]?.markdown?.length).toBeGreaterThan(100)
      expect(p.changelog).toMatch(new RegExp(`^## ${pj.version.replace(/\./g, '\\.')}`))
    }
    expect(Number.isNaN(Date.parse(docs.generatedAt))).toBe(false)
  })

  it('has unique, URL-safe ids at every level', () => {
    for (const p of docs.packages) {
      expect(p.id).toMatch(URL_SAFE)
      const sectionIds = p.sections.map((s) => s.id)
      expect(new Set(sectionIds).size).toBe(sectionIds.length)
      for (const s of p.sections) {
        expect(s.id).toMatch(URL_SAFE)
        const itemIds = s.items.map((i) => i.id.toLowerCase())
        expect(new Set(itemIds).size, `${p.id}/${s.id}`).toBe(itemIds.length)
        for (const i of s.items) {
          expect(i.id, `${p.id}/${s.id}/${i.id}`).toMatch(URL_SAFE)
          expect(Array.isArray(i.snippets)).toBe(true)
          const snippetIds = i.snippets.map((sn) => sn.id)
          expect(new Set(snippetIds).size, `${p.id}/${s.id}/${i.id}`).toBe(snippetIds.length)
        }
      }
    }
  })

  it('gives every item a one-line summary and a module', () => {
    for (const { p, s, i } of allItems()) {
      expect(i.summary.trim(), `${p.id}/${s.id}/${i.id}`).not.toBe('')
      expect(i.summary).not.toMatch(/\n/)
      expect(i.module, `${p.id}/${s.id}/${i.id}`).toMatch(/^@smartdevutils\//)
    }
  })

  it('keeps the JSDoc summary of every documented export', () => {
    let checked = 0
    for (const p of docs.packages) {
      const dir = path.join(PACKAGES_DIR, p.id)
      const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
      const subs = Object.entries(pj.exports as Record<string, unknown>)
        .map(([k, v]) => ({ subpath: k, types: typeof v === 'string' ? v : (v as { types?: string }).types }))
        .filter((s) => s.types?.endsWith('.d.ts') && !s.subpath.includes('*') && s.subpath !== './cdn')
      const api: Map<string, { name: string; summary: string; kind: string }[]> = readPackageApi(dir, subs, {
        isComponent: p.id === 'react' ? (_f: string, r: string) => /JSX\.Element/.test(r) : undefined,
      })
      const byName = new Map<string, ApiItem[]>()
      for (const s of p.sections) for (const i of s.items) byName.set(i.name, [...(byName.get(i.name) ?? []), i])
      for (const list of api.values()) {
        for (const e of list) {
          if (!e.summary) continue
          const items = byName.get(e.name)
          if (!items) continue // element classes live in the Elements section under their tag
          expect(items.map((i) => i.summary), `${p.id}: ${e.name}`).toContain(e.summary)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('lists core’s root module as an index instead of duplicating every export', () => {
    const core = docs.packages.find((p) => p.id === 'core')!
    const index = core.sections.find((s) => s.id === 'index')!
    expect(index.items).toEqual([])
    expect(index.markdown).toContain('@smartdevutils/core/encoding')
    const names = core.sections.filter((s) => s.kind === 'module').flatMap((s) => s.items.map((i) => `${i.module}#${i.name}`))
    expect(new Set(names).size).toBe(names.length)
    expect(core.sections.find((s) => s.id === 'encoding')?.items.map((i) => i.name)).toContain('base64Encode')
  })

  it('documents every runnable tool with runTool() examples and lists the rest of the catalog', async () => {
    const { TOOL_SPECS } = await import('@smartdevutils/core/tools')
    const { TOOL_CATALOG } = await import('@smartdevutils/core/tools/catalog')
    const core = docs.packages.find((p) => p.id === 'core')!
    const tools = core.sections.find((s) => s.id === 'tools')!
    const website = core.sections.find((s) => s.id === 'website-tools')!
    expect(tools.items.map((i) => i.id).sort()).toEqual(TOOL_SPECS.map((s) => s.id).sort())
    expect(tools.items.length + website.items.length).toBe(TOOL_CATALOG.length)
    for (const t of tools.items) {
      expect(t.kind).toBe('tool')
      expect(t.webUrl).toMatch(/^https:\/\/smartdevutils\.com\/tools\/[\w-]+$/)
      const runs = t.snippets.filter((s) => s.source === 'generated' && s.code.includes(`runTool('${t.id}'`))
      expect(runs.length, t.id).toBeGreaterThan(0)
      expect(t.docs).toContain('### Options')
      if (!t.runtime?.length) expect(runs.every((s) => s.node), t.id).toBe(true)
    }
    for (const t of website.items) {
      expect(t.snippets).toEqual([])
      expect(t.docs).toMatch(/Website only/)
    }
  })

  it('gives every custom element a runnable HTML example that loads the elements', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGES_DIR, 'elements', 'custom-elements.json'), 'utf8'))
    const tags: string[] = manifest.modules.flatMap((m: { declarations?: { tagName?: string }[] }) =>
      (m.declarations ?? []).map((d) => d.tagName).filter(Boolean),
    )
    const section = docs.packages.find((p) => p.id === 'elements')!.sections.find((s) => s.id === 'elements')!
    expect(section.items.map((i) => i.id).sort()).toEqual([...tags].sort())
    for (const item of section.items) {
      expect(item.kind).toBe('element')
      const html = item.snippets.filter((s) => s.lang === 'html' && s.mode === 'run')
      expect(html.length, item.id).toBeGreaterThan(0)
      for (const s of html) {
        expect(s.output).toBe('preview')
        expect(s.code).toMatch(/<script type="module">[\s\S]*import '@smartdevutils\/elements(\/[\w-]+)?'/)
        expect(s.code).toContain(`<${item.id}`)
      }
      expect(item.docs).toMatch(/### (Attributes|Properties)/)
    }
  })

  it('renders React examples into #root and keeps Angular examples docs-only', () => {
    for (const { p, i, sn } of allSnippets()) {
      if (sn.lang === 'tsx' && sn.source !== 'readme') {
        expect(sn.code, `${i.id}#${sn.id}`).toMatch(/from 'react-dom\/client'/)
        if (sn.mode === 'run') expect(sn.code, `${i.id}#${sn.id}`).toMatch(/document\.getElementById\('root'\)/)
      }
      if (p.id === 'angular') {
        expect(sn.mode, `${i.id}#${sn.id}`).toBe('docs')
        expect(sn.lang).toBe('ts')
      }
    }
    const react = docs.packages.find((p) => p.id === 'react')!.sections.find((s) => s.id === 'components')!
    expect(react.items.find((i) => i.name === 'SduTool')?.params?.map((p) => p.name)).toContain('tool')
    const angular = docs.packages.find((p) => p.id === 'angular')!.sections.find((s) => s.id === 'components')!
    const tool = angular.items.find((i) => i.name === 'SduToolComponent')!
    expect(tool.signature).toBe('<sdu-tool>')
    expect(tool.params?.map((p) => p.name)).toEqual(expect.arrayContaining(['[tool]', '[(value)]', '(result)']))
  })

  it('marks only ts/js snippets as Node-runnable, and only snippets that need no DOM', () => {
    for (const { p, i, sn } of allSnippets()) {
      if (!sn.node) continue
      expect(['ts', 'js'], `${p.id}/${i.id}#${sn.id}`).toContain(sn.lang)
      expect(sn.mode).toBe('run')
      expect(sn.code, `${p.id}/${i.id}#${sn.id}`).not.toMatch(/\bdocument\.|\bwindow\.|navigator\./)
    }
  })

  it('offers Run only for generated snippets that run in Node or are explicitly browser-only', () => {
    for (const { p, i, sn } of allSnippets()) {
      if (sn.source !== 'generated' || sn.mode !== 'run') continue
      const browserOnly = sn.lang === 'html' || sn.lang === 'tsx' || /needs a browser/.test(sn.description ?? '')
      expect(sn.node === true || browserOnly, `${p.id}/${i.module}#${i.name} ${sn.id}`).toBe(true)
      expect(sn.code, `${p.id}/${i.id}#${sn.id}`).not.toMatch(/undefined as any|\/\* .+ \*\/ ?[[{]/)
    }
  })

  it('never offers Run for clipboard code (the sandboxed preview has no clipboard access)', () => {
    for (const { p, i, sn } of allSnippets()) {
      if (/\b(copyToClipboard|readFromClipboard|navigator\.clipboard)\b/.test(sn.code)) expect(sn.mode, `${p.id}/${i.id}#${sn.id}`).toBe('docs')
    }
  })

  it('has README, generated and curated snippets', () => {
    const by: Record<string, number> = {}
    for (const { sn } of allSnippets()) by[sn.source] = (by[sn.source] ?? 0) + 1
    console.log('snippets by source:', by)
    expect(by['readme']).toBeGreaterThan(5)
    expect(by['generated']).toBeGreaterThan(100)
    expect(by['curated']).toBeGreaterThan(40)
    // Shell blocks stay in the README text only.
    expect(allSnippets().some(({ sn }) => sn.source === 'readme' && /^\s*(npm|pnpm|node) /m.test(sn.code))).toBe(false)
  })

  it('contains no credential-shaped literals (gitleaks runs on push)', () => {
    const jwt = /\bey[A-Za-z0-9_-]{17,}\.ey[A-Za-z0-9_-]{17,}\.[A-Za-z0-9_-]{10,}/
    const aws = /\b(AKIA|ASIA)[0-9A-Z]{16}\b/
    const pem = /-----BEGIN [A-Z ]*PRIVATE KEY-----/
    for (const { p, i, sn } of allSnippets()) {
      for (const re of [jwt, aws, pem]) expect(re.test(sn.code), `${p.id}/${i.id}#${sn.id}`).toBe(false)
    }
  })
})

describe('tool examples snapshot (scripts/data/tool-examples.json)', () => {
  it('covers every runnable tool, in a stable order, with nothing secret-shaped', async () => {
    const { TOOL_SPECS } = await import('@smartdevutils/core/tools')
    const text = fs.readFileSync(TOOL_EXAMPLES_SNAPSHOT, 'utf8')
    const snapshot = JSON.parse(text)
    const ids = TOOL_SPECS.map((s) => s.id).sort()
    expect(Object.keys(snapshot)).toEqual(ids)
    for (const id of ids) {
      expect(snapshot[id].length, id).toBeGreaterThan(0)
      for (const ex of snapshot[id]) expect(typeof ex.label === 'string' && typeof ex.input === 'string', id).toBe(true)
    }
    // Deterministic: writing it again gives the same bytes.
    expect(`${JSON.stringify(snapshotOf(snapshot, ids), null, 2)}\n`).toBe(text)
    expect(text).not.toMatch(/generatedAt|exportedAt/)
    expect(text).not.toMatch(/\bey[A-Za-z0-9_-]{17,}\.ey[A-Za-z0-9_-]{17,}\.|\b(AKIA|ASIA)[0-9A-Z]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bxox[abpr]-/)
  })

  it('is used when the website repo is missing, and the build fails only when both are missing', () => {
    const missing = path.join(RUN_DIR, 'no-such-tool-examples.ts')
    const r = loadToolExamples({ websiteFile: missing, write: false })
    expect(r.source).toBe('snapshot')
    expect(Object.keys(r.examples).length).toBeGreaterThan(0)
    expect(() => loadToolExamples({ websiteFile: missing, snapshotFile: path.join(RUN_DIR, 'no-snapshot.json'), write: false })).toThrow(/No tool examples/)
  })
})

describe('curated snippets', () => {
  it('parses script and HTML front matter', () => {
    const ts1 = parseFrontMatter('/* ---\ntitle: A\nentry: encoding/base64Encode\nnode: true\n--- */\nconsole.log(1)\n', 'ts')
    expect(ts1.meta).toEqual({ title: 'A', entry: 'encoding/base64Encode', node: 'true' })
    expect(ts1.code).toBe('console.log(1)\n')
    const html = parseFrontMatter('<!-- ---\ntitle: B\nentry: elements/sdu-tool\n--- -->\n<sdu-tool></sdu-tool>\n', 'html')
    expect(html.meta.title).toBe('B')
    expect(html.code).toBe('<sdu-tool></sdu-tool>\n')
    expect(parseFrontMatter('console.log(1)', 'ts')).toBeNull()
    expect(() => parseFrontMatter('/* ---\ntitel: typo\n--- */\n', 'ts')).toThrow(/unknown front matter key/)
  })

  it('are all attached to an existing entry', () => {
    const curated: { pkg: string; entries: { section: string; item: string }[]; snippet: Snippet; file: string }[] = loadCurated()
    expect(curated.length).toBeGreaterThanOrEqual(40)
    for (const c of curated) {
      const pkg = docs.packages.find((p) => p.id === c.pkg)!
      for (const e of c.entries) {
        const item = pkg.sections.find((s) => s.id === e.section)?.items.find((i) => i.id === e.item)
        expect(item, `${c.file} -> ${e.section}/${e.item}`).toBeDefined()
        expect(item!.snippets.some((s) => s.source === 'curated' && s.code === c.snippet.code)).toBe(true)
      }
    }
  })
})
