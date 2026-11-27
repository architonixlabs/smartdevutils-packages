// Sandbox page script (built to public/sandbox.js as a classic script by runtime.vite.config.mts).
// Runs inside <iframe sandbox="allow-scripts"> with an opaque origin. Order matters: the import map
// must be installed before any module starts loading, so this file is not a module itself.
import { formatArgs, formatValue, splitHtml, truncate } from '../src/app/core/sandbox-runtime'
import {
  isParentToSandbox,
  MAX_MESSAGE_TEXT,
  type ConsoleLevel,
  type RunMessage,
  type SandboxToParent,
} from '../src/app/core/sandbox-protocol'

const runtimeBase = new URL('runtime/', document.baseURI)

function send(msg: SandboxToParent): void {
  // The parent's origin is not knowable from an opaque origin (no referrer); messages carry only run output.
  window.parent.postMessage(msg, '*') // NOSONAR
}

async function installImportMap(): Promise<void> {
  const url = new URL('importmap.json', runtimeBase)
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw new Error(`Could not load the runtime (${res.status}).`)
  const map = (await res.json()) as { imports?: Record<string, string> }
  const imports: Record<string, string> = {}
  for (const [spec, target] of Object.entries(map.imports ?? {})) imports[spec] = new URL(target, url).href
  const script = document.createElement('script')
  script.type = 'importmap'
  script.textContent = JSON.stringify({ imports })
  document.head.appendChild(script)
  // @smartdevutils/browser/mermaid loads Mermaid from this URL (self-hosted, lazily).
  if (imports['mermaid']) (globalThis as { SDU_MERMAID_URL?: string }).SDU_MERMAID_URL = imports['mermaid']
}

let runId: string | null = null
let started = 0
let loadError: Error | null = null

function captureConsole(): void {
  const levels: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug']
  const c = console as unknown as Record<ConsoleLevel, (...args: unknown[]) => void>
  for (const level of levels) {
    const original = c[level].bind(console)
    c[level] = (...args: unknown[]) => {
      original(...args)
      if (runId) send({ type: 'console', runId, level, text: formatArgs(args) })
    }
  }
}

function reportError(err: unknown): void {
  if (!runId) return
  if (err instanceof Error) {
    const stack = err.stack ? truncate(err.stack, MAX_MESSAGE_TEXT) : undefined
    send({ type: 'error', runId, message: truncate(`${err.name}: ${err.message}`), ...(stack ? { stack } : {}) })
  } else {
    send({ type: 'error', runId, message: formatValue(err) })
  }
}

// The body's own height, not documentElement.scrollHeight: that is never smaller than the iframe viewport, so
// content shorter than the frame would never be reported. Sent again after each run (the parent drops sizes that
// arrive before `ready`).
let lastHeight = -1
function postSize(force = false): void {
  const h = Math.ceil(document.body.getBoundingClientRect().height)
  if (force || h !== lastHeight) {
    lastHeight = h
    send({ type: 'resize', height: h })
  }
}

function observeSize(): void {
  new ResizeObserver(() => postSize()).observe(document.body)
}

function loadTheme(): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = new URL('theme/styles.css', runtimeBase).href
    link.onload = link.onerror = () => resolve()
    document.head.appendChild(link)
  })
}

async function importSource(source: string): Promise<{ default?: unknown }> {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  try {
    return (await import(/* @vite-ignore */ url)) as { default?: unknown }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function run(msg: RunMessage): Promise<void> {
  runId = msg.runId
  started = performance.now()
  const root = document.documentElement
  root.dataset['theme'] = msg.colorScheme
  root.style.colorScheme = msg.colorScheme
  try {
    if (loadError) throw loadError
    if (msg.theme) await loadTheme()
    const preview = document.getElementById('preview') as HTMLElement
    if (msg.html) {
      const parts = splitHtml(msg.html, document)
      preview.innerHTML = parts.html
      if (parts.skipped) console.warn(`${parts.skipped} <script> element(s) skipped: only inline <script type="module"> runs here.`)
      for (const mod of parts.modules) await importSource(mod)
    }
    if (msg.code.trim()) {
      const mod = await importSource(msg.code)
      if ('default' in mod) {
        const value = await mod.default
        if (value !== undefined) send({ type: 'result', runId: msg.runId, text: formatValue(value) })
      }
    }
  } catch (err) {
    reportError(err)
  } finally {
    postSize(true)
    send({ type: 'done', runId: msg.runId, ms: Math.round(performance.now() - started) })
  }
}

function main(): void {
  captureConsole()
  window.addEventListener('error', (e) => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason))
  let accepted = false
  window.addEventListener('message', (event) => {
    if (accepted || event.source !== window.parent || !isParentToSandbox(event.data)) return
    accepted = true // one run per iframe
    void run(event.data)
  })
  // Ready either way: a runtime that failed to load is reported as the run's error.
  installImportMap()
    .catch((err: unknown) => {
      loadError = err instanceof Error ? err : new Error('Could not load the runtime.')
    })
    .finally(() => {
      observeSize()
      send({ type: 'ready' })
    })
}

main()
