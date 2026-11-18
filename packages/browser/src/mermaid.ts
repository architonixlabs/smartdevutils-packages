/**
 * Mermaid rendering shared by the SmartDevUtils UI packages (elements, Angular, React).
 *
 * Mermaid is not a dependency of this package. It is loaded on first use, in the browser only:
 * - from the loader you register with `setMermaidLoader(() => import('mermaid'))` (your bundled copy), or
 * - from the URL in `globalThis.SDU_MERMAID_URL`, or
 * - from MERMAID_CDN_URL (jsDelivr) when neither is set.
 *
 * Every render uses `securityLevel: 'strict'` and `htmlLabels: false` (labels as SVG text, no
 * foreignObject), so diagram text cannot run script and the SVG can be drawn on a canvas for PNG export.
 */

export interface MermaidApi {
  initialize(config: Record<string, unknown>): void
  render(id: string, text: string): Promise<{ svg: string }>
}

export type MermaidLoader = () => Promise<MermaidApi | { default: MermaidApi }>

/** The pinned Mermaid build used when no loader or URL is set. */
export const MERMAID_CDN_URL = 'https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs'

/** Longest diagram source accepted, in characters (Mermaid's own default is 50,000). */
export const MERMAID_MAX_TEXT = 50_000

let loader: MermaidLoader | null = null
let loaded: Promise<MermaidApi> | null = null

/** Registers where Mermaid comes from, for example `() => import('mermaid')`. Pass null to reset. */
export function setMermaidLoader(fn: MermaidLoader | null): void {
  loader = fn
  loaded = null
}

/** Loads Mermaid from a URL (an ES module build) instead of the default CDN. */
export function setMermaidUrl(url: string): void {
  setMermaidLoader(() => importUrl(url))
}

function importUrl(url: string): Promise<MermaidApi> {
  // A variable specifier: bundlers leave it alone, the browser fetches it at run time.
  const specifier = url
  return import(/* @vite-ignore */ /* webpackIgnore: true */ specifier) as Promise<MermaidApi>
}

function defaultLoader(): Promise<MermaidApi> {
  const g = globalThis as { SDU_MERMAID_URL?: unknown }
  return importUrl(typeof g.SDU_MERMAID_URL === 'string' && g.SDU_MERMAID_URL ? g.SDU_MERMAID_URL : MERMAID_CDN_URL)
}

/** Resolves the Mermaid module once. Rejects outside a browser. */
export function loadMermaid(): Promise<MermaidApi> {
  if (typeof document === 'undefined') return Promise.reject(new Error('Mermaid renders only in a browser.'))
  if (!loaded) {
    const p = (loader ?? defaultLoader)().then((m) => {
      const api = (m as { default?: MermaidApi }).default ?? (m as MermaidApi)
      if (!api || typeof api.render !== 'function') throw new Error('The Mermaid module has no render().')
      return api
    })
    p.catch(() => {
      if (loaded === p) loaded = null
    })
    loaded = p
  }
  return loaded
}

export type MermaidRenderResult = { ok: true; svg: string } | { ok: false; error: string }

let queue: Promise<unknown> = Promise.resolve()
let seq = 0

/**
 * Renders Mermaid source to an SVG string. Never throws: problems come back as `{ ok: false, error }`.
 * Renders run one at a time, because Mermaid's configuration is global.
 */
export function renderMermaid(source: string, opts: { dark?: boolean } = {}): Promise<MermaidRenderResult> {
  const text = source.trim()
  if (!text) return Promise.resolve({ ok: false, error: 'There is no diagram source.' })
  if (text.length > MERMAID_MAX_TEXT) {
    return Promise.resolve({
      ok: false,
      error: `The diagram source is ${text.length.toLocaleString('en-US')} characters; the limit is ${MERMAID_MAX_TEXT.toLocaleString('en-US')}.`,
    })
  }
  const run = async (): Promise<MermaidRenderResult> => {
    const id = `sdu-mermaid-${++seq}`
    try {
      const mermaid = await loadMermaid()
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: opts.dark ? 'dark' : 'default',
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        maxTextSize: MERMAID_MAX_TEXT,
        suppressErrorRendering: true,
      })
      const { svg } = await mermaid.render(id, text)
      return { ok: true, svg }
    } catch (err) {
      return { ok: false, error: cleanError(err) }
    } finally {
      // Mermaid leaves its scratch element behind when a render fails.
      document.getElementById('d' + id)?.remove()
      document.getElementById(id)?.remove()
    }
  }
  const next = queue.then(run, run)
  queue = next.catch(() => undefined)
  return next
}

function cleanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'The diagram could not be drawn.'
  return msg.split('\n').slice(0, 4).join('\n').slice(0, 600)
}

/** Whether a node is shown dark: the nearest [data-theme] (across shadow roots) wins, then the OS setting. */
export function prefersDark(node?: Node | null): boolean {
  let n: Node | null | undefined = node
  while (n) {
    if (n instanceof Element) {
      const t = n.getAttribute('data-theme')
      if (t === 'dark') return true
      if (t === 'light') return false
    }
    n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null)
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

/** The width and height an SVG string asks for (viewBox first, then width/height attributes). */
export function svgSize(svg: string): { width: number; height: number } {
  const vb = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg)
  if (vb) return { width: Math.ceil(Number(vb[1])), height: Math.ceil(Number(vb[2])) }
  const w = /<svg[^>]*\swidth="([\d.]+)/.exec(svg)
  const h = /<svg[^>]*\sheight="([\d.]+)/.exec(svg)
  return { width: Math.ceil(Number(w?.[1] ?? 800)), height: Math.ceil(Number(h?.[1] ?? 600)) }
}

/** Draws an SVG string on a canvas and returns a PNG. `background` fills behind it (default white). */
export function svgToPng(svg: string, opts: { scale?: number; background?: string } = {}): Promise<Blob> {
  const { width, height } = svgSize(svg)
  const scale = opts.scale ?? 2
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('This browser cannot draw on a canvas.'))
      ctx.fillStyle = opts.background ?? '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The PNG could not be made.'))), 'image/png')
    }
    img.onerror = () => reject(new Error('The SVG could not be loaded as an image.'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}
