// Compiles playground source to what the sandbox runs. Contract for the UI and SandboxHost.
// sucrase is imported lazily so it stays out of the initial bundle.
import type { SnippetLang } from './model'

export interface CompiledSnippet {
  /** JavaScript module source (imports kept as bare specifiers for the sandbox import map). */
  code: string
  /** Markup for the preview body: the html snippet itself, or `<div id="root"></div>` for tsx. */
  html?: string
}

export class CompileError extends Error {
  constructor(
    message: string,
    readonly line?: number,
    readonly column?: number,
  ) {
    super(message)
    this.name = 'CompileError'
  }
}

export const REACT_ROOT_HTML = '<div id="root"></div>'

type Transform = 'typescript' | 'jsx'

/** Throws CompileError with a 1-based line/column when the source does not compile. */
export async function compileSnippet(lang: SnippetLang, source: string): Promise<CompiledSnippet> {
  switch (lang) {
    case 'html':
      return { code: '', html: source }
    case 'js':
      return { code: source }
    case 'ts':
      return { code: await transform(source, ['typescript']) }
    case 'tsx':
      return { code: await transform(source, ['typescript', 'jsx']), html: REACT_ROOT_HTML }
    default:
      throw new CompileError(`Unsupported language: ${String(lang)}`)
  }
}

async function transform(source: string, transforms: Transform[]): Promise<string> {
  const { transform: sucrase } = await import('sucrase')
  try {
    return sucrase(source, {
      transforms,
      // The sandbox runtime is React's production build, whose jsx-dev-runtime has no jsxDEV:
      // `production: true` makes the automatic runtime import react/jsx-runtime.
      jsxRuntime: 'automatic',
      production: true,
      disableESTransforms: true,
    }).code
  } catch (err) {
    throw toCompileError(err)
  }
}

/**
 * Maps a sucrase parse error to a CompileError. sucrase sets `err.loc` (line and column both 1-based)
 * and appends ` (line:column)` to the message; the suffix is dropped from the message.
 */
export function toCompileError(err: unknown): CompileError {
  const e = err as { message?: unknown; loc?: { line?: unknown; column?: unknown } } | null
  const raw = typeof e?.message === 'string' ? e.message : 'The code could not be compiled.'
  const m = / \((\d+):(\d+)\)$/.exec(raw)
  let line = m ? Number(m[1]) : undefined
  let column = m ? Number(m[2]) : undefined
  if (typeof e?.loc?.line === 'number') line = e.loc.line
  if (typeof e?.loc?.column === 'number') column = e.loc.column
  const message = m ? raw.slice(0, m.index) : raw
  return new CompileError(message || 'The code could not be compiled.', line, column)
}
