// Executes every snippet marked `node: true` in Node against the workspace build, so a documented
// example cannot silently break. Each runs as an ES module in a worker thread (fresh globals) with a
// 5 s timeout; a thrown error, a rejected or unsettled top-level await, or the timeout fails it.
// Curated .ts snippets (except Angular, which is not installed here) are also type-checked.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
// @ts-expect-error: plain ESM scripts without type declarations
import { buildDocs } from '../scripts/build-docs.mjs'
// @ts-expect-error: plain ESM scripts without type declarations
import { runInNode, mapLimit, SNIPPET_TIMEOUT_MS } from '../scripts/lib/run-snippet.mjs'
// @ts-expect-error: plain ESM scripts without type declarations
import { loadCurated } from '../scripts/lib/curated.mjs'
// @ts-expect-error: plain ESM scripts without type declarations
import { APP_DIR, RUN_DIR } from '../scripts/lib/paths.mjs'
import type { PlaygroundDocs, Snippet } from '../src/app/core/model'

interface Case {
  key: string
  snippet: Snippet
}

let cases: Case[] = []
const outcomes = new Map<string, { ok: boolean; error?: string; ms: number; stdout: string }>()

beforeAll(async () => {
  const { docs }: { docs: PlaygroundDocs } = await buildDocs({ quiet: true })
  const seen = new Map<string, Case>()
  for (const p of docs.packages)
    for (const s of p.sections)
      for (const i of s.items)
        for (const sn of i.snippets) {
          if (!sn.node) continue
          // A snippet attached to several entries runs once.
          if (!seen.has(sn.code)) seen.set(sn.code, { key: `${p.id}/${s.id}/${i.id}#${sn.id} (${sn.source})`, snippet: sn })
        }
  cases = [...seen.values()]
  const results = await mapLimit(cases, 8, (c: Case, n: number) =>
    runInNode(c.snippet.code, c.snippet.lang, { name: `test-${n}`, timeoutMs: SNIPPET_TIMEOUT_MS }),
  )
  results.forEach((r: { ok: boolean; error?: string; ms: number; stdout: string }, n: number) => outcomes.set(cases[n].key, r))
}, 300_000)

afterAll(() => {
  const ran = outcomes.size
  const failed = [...outcomes.values()].filter((o) => !o.ok).length
  const bySource: Record<string, number> = {}
  for (const c of cases) bySource[c.snippet.source] = (bySource[c.snippet.source] ?? 0) + 1
  console.log(`snippets executed in Node: ${ran} (${failed} failed) ${JSON.stringify(bySource)}`)
})

describe('node snippets', () => {
  it('found snippets to run', () => {
    expect(cases.length).toBeGreaterThan(150)
    expect(cases.some((c) => c.snippet.source === 'curated')).toBe(true)
    expect(cases.some((c) => c.snippet.source === 'readme')).toBe(true)
  })

  it('all run without throwing, within the timeout, and print something', () => {
    const failures = [...outcomes].filter(([, o]) => !o.ok).map(([k, o]) => `${k}\n    ${o.error}`)
    expect(failures, failures.join('\n')).toEqual([])
    // Curated examples must show something; README and generated ones may legitimately print ''.
    const silent = [...outcomes].filter(([k, o]) => k.endsWith('(curated)') && !o.stdout.trim()).map(([k]) => k)
    expect(silent).toEqual([])
  })

  it('a failing snippet is reported as a failure (runner self-check)', async () => {
    expect((await runInNode("throw new Error('boom')", 'js')).ok).toBe(false)
    expect((await runInNode('await Promise.reject(new Error("no"))', 'js')).ok).toBe(false)
    expect((await runInNode('while (true) {}', 'js', { timeoutMs: 500 })).timedOut).toBe(true)
    const ok = await runInNode("import { sha256 } from '@smartdevutils/core/hashing'\nconsole.log(sha256('a'))", 'ts')
    expect(ok.ok).toBe(true)
    expect(ok.stdout.trim()).toBe('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb')
  })
})

describe('curated snippets type-check against the built packages', () => {
  it('has no type errors in curated .ts snippets (Angular excluded)', () => {
    const curated: { pkg: string; file: string; snippet: Snippet }[] = loadCurated()
    const files = curated.filter((c) => c.snippet.lang === 'ts' && c.pkg !== 'angular')
    expect(files.length).toBeGreaterThan(30)
    fs.mkdirSync(RUN_DIR, { recursive: true })
    const dir = fs.mkdtempSync(path.join(RUN_DIR, 'typecheck-'))
    try {
      const paths = files.map((c, n) => {
        const f = path.join(dir, `s${n}.ts`)
        // Each file is a module (top-level await is allowed in modules).
        fs.writeFileSync(f, `${c.snippet.code}\nexport {}\n`)
        return f
      })
      const program = ts.createProgram(paths, {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
        types: [],
      })
      const diags = ts.getPreEmitDiagnostics(program).map((d) => {
        const n = d.file ? paths.indexOf(path.normalize(d.file.fileName)) : -1
        const where = n >= 0 ? path.relative(APP_DIR, files[n].file) : d.file?.fileName ?? ''
        const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0
        return `${where}:${line} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
      })
      expect(diags, diags.join('\n')).toEqual([])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }, 120_000)
})
