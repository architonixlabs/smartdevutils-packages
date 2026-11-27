// Runs a ts/js snippet as an ES module in Node (a worker thread), the way the test suite does.
// The module is written under apps/playground/node_modules/.cache, so bare `@smartdevutils/*`
// imports resolve to the workspace packages through apps/playground/node_modules.
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { RUN_DIR } from './paths.mjs'

export const SNIPPET_TIMEOUT_MS = 5000

/** TypeScript to an ES module (types removed, imports kept). */
export function toModuleJs(code, lang) {
  if (lang === 'js') return code
  if (lang !== 'ts') throw new Error(`Only ts/js snippets run in Node (got ${lang})`)
  return ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, isolatedModules: true },
    reportDiagnostics: false,
  }).outputText
}

function firstLines(text, n = 6) {
  return text.trim().split('\n').slice(0, n).join('\n')
}

/**
 * Runs the snippet in a worker thread: a fresh module graph and globals per snippet, and much
 * faster than a child process on Windows. It fails on a thrown error, a rejected top-level await,
 * a top-level await that never settles, or the timeout.
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string, error?: string, ms: number, timedOut: boolean }>}
 */
export function runInNode(code, lang, { timeoutMs = SNIPPET_TIMEOUT_MS, name = 'snippet' } = {}) {
  fs.mkdirSync(RUN_DIR, { recursive: true })
  const js = toModuleJs(code, lang)
  const hash = createHash('sha1').update(js).digest('hex').slice(0, 10)
  const base = name.replace(/[^\w-]+/g, '_').slice(0, 60)
  const file = path.join(RUN_DIR, `${base}-${hash}-${process.pid}.mjs`)
  fs.writeFileSync(file, js)
  const started = Date.now()
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let thrown = ''
    const worker = new Worker(pathToFileURL(file), { execArgv: [], stdout: true, stderr: true, env: { ...process.env, NODE_ENV: 'test' } })
    worker.stdout.on('data', (d) => (stdout += d))
    worker.stderr.on('data', (d) => (stderr += d))
    worker.on('error', (e) => {
      thrown = e instanceof Error ? (e.stack ?? e.message) : String(e)
    })
    const timer = setTimeout(() => {
      timedOut = true
      void worker.terminate()
    }, timeoutMs)
    worker.on('exit', (exitCode) => {
      clearTimeout(timer)
      fs.rmSync(file, { force: true })
      const ok = exitCode === 0 && !timedOut && !thrown
      let error
      if (timedOut) error = `timed out after ${timeoutMs} ms`
      else if (thrown) error = firstLines(thrown)
      else if (!ok) error = `exit code ${exitCode}${stderr.trim() ? `: ${firstLines(stderr)}` : ' (a top-level await never settled?)'}`
      resolve({ ok, stdout, stderr, ms: Date.now() - started, timedOut, ...(error ? { error } : {}) })
    })
  })
}

/** Runs tasks with a concurrency limit, keeping the input order in the results. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}
