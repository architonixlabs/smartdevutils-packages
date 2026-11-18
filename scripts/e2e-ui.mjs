#!/usr/bin/env node
// End-to-end check of the UI packages in Microsoft Edge (headless), through the built example apps:
//   plain-html-cdn (elements CDN build), vue-vite (elements), react-vite (react),
//   angular-19 (angular, zone.js) and angular-22-ssr (angular, zoneless, server-rendered).
//
// For each app it checks that a tool runs (and runs again on new input), a Mermaid diagram draws,
// a recipe runs all its steps and shows "what changed", a run file downloads, and the same file
// uploads into the run viewer after a reload. It also checks the light/dark switch and, for the
// SSR app, that the server-rendered HTML already holds the tool output.
//
// Run `pnpm build` first. Usage: node scripts/e2e-ui.mjs [--headed] [--only=<app>]
// Playwright comes from the YoutubeContentCreator project (playwright-core); the browser is Edge.
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const headed = args.includes('--headed')
const only = args.find((a) => a.startsWith('--only='))?.slice(7)

const pwRequire = createRequire('J:/Projects/Architonix/YoutubeContentCreator/package.json')
let chromium
try {
  ;({ chromium } = pwRequire('playwright-core'))
} catch {
  ;({ chromium } = pwRequire('playwright'))
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
}

/** A static file server for one folder, with index.html as the fallback. Resolves to { url, close }. */
function serveStatic(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    let file = normalize(join(dir, path))
    if (!file.startsWith(normalize(dir))) {
      res.writeHead(403).end()
      return
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html')
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    createReadStream(file).pipe(res)
  })
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })),
  )
}

/** Starts the Angular SSR server on a free port and waits until it answers. */
async function serveSsr(dir) {
  const probe = createServer()
  const port = await new Promise((ok) => probe.listen(0, '127.0.0.1', () => ok(probe.address().port)))
  probe.close()
  const child = spawn(process.execPath, [join(dir, 'server', 'server.mjs')], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))
  const url = `http://localhost:${port}/`
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return { url, close: () => child.kill(), log: () => log }
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  child.kill()
  throw new Error(`The SSR server did not start:\n${log}`)
}

const APPS = [
  {
    name: 'plain-html-cdn',
    dist: 'examples/plain-html-cdn/dist',
    tool: { first: /"user":\s*"sample"/, input: 'c3ludGhldGljIHRleHQ=', expect: /^synthetic text$/ },
    steps: 3,
  },
  {
    name: 'vue-vite',
    dist: 'examples/vue-vite/dist',
    tool: { first: /"region": "eu-west"/, input: '{"k":[1,2]}', expect: /"k": \[\s*1,\s*2\s*\]/ },
    steps: 3,
  },
  {
    name: 'react-vite',
    dist: 'examples/react-vite/dist',
    tool: { first: /^[0-9a-f]{64}$/, input: 'abc', expect: /^ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad$/ },
    steps: 3,
  },
  {
    name: 'angular-19',
    dist: 'examples/angular-19/dist/browser',
    tool: { first: /"replicas": 3/, input: '{"a":true}', expect: /"a": true/ },
    steps: 3,
  },
  {
    name: 'angular-22-ssr',
    dist: 'examples/angular-22-ssr/dist',
    ssr: true,
    tool: { first: /^name=sample user&role=viewer$/, input: 'a%2Fb%3Fc', expect: /^a\/b\?c$/ },
    steps: 2,
  },
]

const results = []
const record = (app, check, ok, note = '') => {
  results.push({ app, check, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${app.padEnd(15)} ${check}${note ? ` (${note})` : ''}`)
}

/** Polls a locator (Playwright locators reach into open shadow roots) until its text matches. */
async function waitText(locator, re, timeout) {
  const end = Date.now() + timeout
  let last = ''
  while (Date.now() < end) {
    last = ((await locator.textContent().catch(() => '')) ?? '').trim()
    if (re.test(last)) return last.slice(0, 40)
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`output was ${JSON.stringify(last.slice(0, 80))}, expected ${re}`)
}

async function check(app, name, fn) {
  try {
    const note = await fn()
    record(app, name, true, typeof note === 'string' ? note : '')
  } catch (err) {
    record(app, name, false, (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 200))
  }
}

async function runApp(browser, app, tmp) {
  const dir = join(root, app.dist)
  if (!existsSync(dir)) {
    record(app.name, 'built output exists', false, `${app.dist} is missing; run pnpm build`)
    return
  }
  const server = app.ssr ? await serveSsr(dir) : await serveStatic(dir)
  const context = await browser.newContext({ acceptDownloads: true, colorScheme: 'light' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  try {
    if (app.ssr) {
      await check(app.name, 'server-rendered HTML holds the tool output', async () => {
        const html = await (await fetch(server.url)).text()
        if (!html.includes('name=sample user&amp;role=viewer')) throw new Error('decoded text not in the server HTML')
        if (!html.includes('--sdu-c-bg')) throw new Error('theme styles not in the server HTML')
        return 'URL decode ran on the server'
      })
    }

    await page.goto(server.url, { waitUntil: 'load' })
    const out = page.locator('#tool [data-role="output"]').first()

    await check(app.name, 'tool runs on load', async () => waitText(out, app.tool.first, 15000))

    await check(app.name, 'tool runs again on new input', async () => {
      await page.locator('#tool textarea').first().fill(app.tool.input)
      return waitText(out, app.tool.expect, 10000)
    })

    await check(app.name, 'mode tabs work with the keyboard', async () => {
      const tabs = page.locator('#tool [role="tab"]')
      const n = await tabs.count()
      if (n < 2) return 'single mode'
      const first = tabs.nth(0)
      await first.focus()
      await page.keyboard.press('End')
      await tabs.nth(n - 1).and(page.locator('[aria-selected="true"]')).waitFor({ timeout: 3000 }).catch(() => {
        throw new Error('End did not select the last tab')
      })
      const focused = await tabs.nth(n - 1).evaluate((t) => t.getRootNode().activeElement === t)
      if (!focused) throw new Error('focus did not move to the selected tab')
      await page.keyboard.press('Home')
      await tabs.nth(0).and(page.locator('[aria-selected="true"]')).waitFor({ timeout: 3000 })
      return `${n} tabs`
    })

    await check(app.name, 'diagram draws', async () => {
      const svg = page.locator('#diagram [role="img"] svg').first()
      await svg.waitFor({ state: 'attached', timeout: 30000 })
      const box = await svg.boundingBox()
      if (!box || box.width < 20) throw new Error('the SVG has no size')
      if (await page.locator('#diagram [role="alert"]').count()) throw new Error(await page.locator('#diagram [role="alert"]').first().textContent())
      return `${Math.round(box.width)}x${Math.round(box.height)} px`
    })

    await check(app.name, 'light/dark switch restyles the components', async () => {
      const bg = () => page.locator('#tool .sdu-root').first().evaluate((e) => getComputedStyle(e).backgroundColor)
      const light = await bg()
      await page.locator('main button').first().click()
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
      await page.waitForTimeout(100)
      const dark = await bg()
      await page.locator('main button').first().click()
      if (light === dark) throw new Error(`background stayed ${light}`)
      return `${light} -> ${dark}`
    })

    let runFile = ''
    await check(app.name, `recipe runs all ${app.steps} steps and shows what changed`, async () => {
      await page.locator('#recipe button', { hasText: 'Run all steps' }).first().click()
      await page.locator('#recipe [data-role="finished"]').first().waitFor({ timeout: 20000 })
      const done = await page.locator('#recipe .sdu-step[data-state="done"]').count()
      const headlines = await page.locator('#recipe [data-role="headline"]').allTextContents()
      if (done !== app.steps) throw new Error(`${done} steps done`)
      if (headlines.length !== app.steps || headlines.some((h) => !h.trim())) throw new Error('missing "what changed"')
      return headlines.at(-1)?.slice(0, 60)
    })

    await check(app.name, 'edit a step and run again from it', async () => {
      const last = app.steps
      await page.locator('#recipe button', { hasText: `Edit step ${last}` }).first().click()
      const ta = page.locator(`#recipe form textarea`).last()
      await ta.waitFor()
      await ta.fill('{"edited":1}')
      await page.locator('#recipe button', { hasText: 'Run from this step' }).first().click()
      await page.locator('#recipe [data-role="finished"]').first().waitFor({ timeout: 20000 })
      const outputs = await page.locator('#recipe .sdu-step').nth(last - 1).locator('[data-role="output"]').allTextContents()
      if (!outputs.some((t) => t.length > 0)) throw new Error('no output after the re-run')
      return outputs.at(-1)?.trim().slice(0, 40)
    })

    await check(app.name, 'run file downloads', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        page.locator('#recipe button', { hasText: 'Download run' }).first().click(),
      ])
      runFile = join(tmp, `${app.name}-${download.suggestedFilename()}`)
      await download.saveAs(runFile)
      const json = JSON.parse(readFileSync(runFile, 'utf8'))
      if (json.schema !== 'sdu-recipe-run/1') throw new Error(`schema ${json.schema}`)
      if (json.trace.length !== app.steps) throw new Error(`${json.trace.length} steps in the file`)
      return download.suggestedFilename()
    })

    await check(app.name, 'run file uploads into the run viewer after a reload', async () => {
      if (!runFile) throw new Error('no run file from the previous check')
      await page.reload({ waitUntil: 'load' })
      await page.locator('#recipe-run input[type="file"]').first().waitFor({ state: 'attached', timeout: 15000 })
      await page.locator('#recipe-run input[type="file"]').first().setInputFiles(runFile)
      await page.locator('#recipe-run [data-role="finished"]').first().waitFor({ timeout: 10000 })
      const n = await page.locator('#recipe-run .sdu-step[data-state="done"]').count()
      if (n !== app.steps) throw new Error(`${n} steps shown`)
      return `${n} steps shown`
    })

    await check(app.name, 'no page errors', async () => {
      const real = errors.filter((e) => !/favicon|DevTools/i.test(e))
      if (real.length) throw new Error(real.join(' | '))
    })
  } finally {
    await context.close()
    server.close()
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'sdu-e2e-'))
const browser = await chromium.launch({ channel: 'msedge', headless: !headed })
const edge = browser.version()
try {
  for (const app of APPS) {
    if (only && app.name !== only) continue
    await runApp(browser, app, tmp)
  }
} finally {
  await browser.close()
  rmSync(tmp, { recursive: true, force: true })
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} of ${results.length} checks passed in Microsoft Edge ${edge}.`)
process.exit(failed.length ? 1 : 0)
