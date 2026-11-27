// Pure helpers for the sandbox page (runtime/sandbox.ts): value formatting for console/result
// messages and splitting html snippets into markup and module scripts. No Angular, no globals.
import { MAX_MESSAGE_TEXT } from './sandbox-protocol'

const TRUNCATED = '… (truncated)'

export function truncate(text: string, max = MAX_MESSAGE_TEXT): string {
  return text.length <= max ? text : text.slice(0, max - TRUNCATED.length) + TRUNCATED
}

const MAX_DEPTH = 6
const MAX_ITEMS = 200

function isNode(v: object): v is { nodeType: number; nodeName: string; outerHTML?: string; textContent: string | null } {
  return typeof (v as { nodeType?: unknown }).nodeType === 'number' && typeof (v as { nodeName?: unknown }).nodeName === 'string'
}

function describeLeaf(v: unknown): string | undefined {
  switch (typeof v) {
    case 'string':
      return JSON.stringify(v)
    case 'number':
    case 'boolean':
      return String(v)
    case 'bigint':
      return `${v}n`
    case 'undefined':
      return 'undefined'
    case 'symbol':
      return v.toString()
    case 'function':
      return `[Function ${v.name || '(anonymous)'}]`
    default:
      return v === null ? 'null' : undefined
  }
}

function describeObject(v: object, depth: number, seen: WeakSet<object>): string {
  if (v instanceof Error) return v.stack && v.stack.includes(v.message) ? v.stack : `${v.name}: ${v.message}`
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? 'Invalid Date' : v.toISOString()
  if (v instanceof RegExp) return String(v)
  if (isNode(v)) return v.outerHTML ?? `#${v.nodeName.toLowerCase()} ${JSON.stringify(v.textContent ?? '')}`
  if (seen.has(v)) return '[Circular]'
  if (depth >= MAX_DEPTH) return Array.isArray(v) ? '[Array]' : '[Object]'
  seen.add(v)
  try {
    const inner = (x: unknown): string => describe(x, depth + 1, seen)
    if (Array.isArray(v)) return list('[', ']', v, inner)
    if (v instanceof Map) return `Map(${v.size}) ` + list('{', '}', [...v], ([k, x]) => `${inner(k)} => ${inner(x)}`)
    if (v instanceof Set) return `Set(${v.size}) ` + list('{', '}', [...v], inner)
    if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
      return `${v.constructor.name}(${(v as unknown as ArrayLike<unknown>).length}) ` + list('[', ']', Array.from(v as unknown as ArrayLike<unknown>), inner)
    }
    if (typeof (v as { then?: unknown }).then === 'function') return 'Promise { <pending> }'
    const ctor = (v as { constructor?: { name?: string } }).constructor?.name
    const prefix = ctor && ctor !== 'Object' ? `${ctor} ` : ''
    const keyText = (k: string): string => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k))
    return prefix + list('{', '}', Object.keys(v), (k) => `${keyText(k)}: ${inner((v as Record<string, unknown>)[k])}`)
  } finally {
    seen.delete(v)
  }
}

function list<T>(open: string, close: string, items: readonly T[], fn: (item: T) => string): string {
  if (items.length === 0) return open + close
  const shown = items.slice(0, MAX_ITEMS).map(fn)
  if (items.length > MAX_ITEMS) shown.push(`… ${items.length - MAX_ITEMS} more`)
  return `${open} ${shown.join(', ')} ${close}`
}

function describe(v: unknown, depth: number, seen: WeakSet<object>): string {
  const leaf = describeLeaf(v)
  if (leaf !== undefined) return leaf
  try {
    return describeObject(v as object, depth, seen)
  } catch {
    return '[Unprintable]'
  }
}

/** Formats any value for display (cycles, depth and size bounded); strings are shown quoted. */
export function formatValue(v: unknown): string {
  return truncate(describe(v, 0, new WeakSet()))
}

/** console.* arguments as one line: top-level strings unquoted, like a browser console. */
export function formatArgs(args: readonly unknown[]): string {
  return truncate(args.map((a) => (typeof a === 'string' ? a : describe(a, 0, new WeakSet()))).join(' '))
}

export interface SplitHtml {
  /** Markup with every <script> removed (scripts inserted via innerHTML would not run anyway). */
  html: string
  /** Inline `<script type="module">` bodies, in document order. */
  modules: string[]
  /** Scripts that are not run: classic scripts and scripts with `src`. */
  skipped: number
}

/** Splits an html snippet into markup and its inline module scripts. `doc` supplies the parser. */
export function splitHtml(source: string, doc: Document): SplitHtml {
  const template = doc.createElement('template')
  template.innerHTML = source
  const modules: string[] = []
  let skipped = 0
  for (const script of Array.from(template.content.querySelectorAll('script'))) {
    const type = (script.getAttribute('type') ?? '').trim().toLowerCase()
    if (type === 'module' && !script.hasAttribute('src')) modules.push(script.textContent ?? '')
    else skipped++
    script.remove()
  }
  return { html: template.innerHTML, modules, skipped }
}
