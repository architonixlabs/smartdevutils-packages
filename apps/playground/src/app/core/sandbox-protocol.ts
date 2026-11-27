// Shared contract: messages between the playground page (parent) and sandbox.html (in a sandboxed,
// opaque-origin iframe). Both sides validate every message with the guards below before acting on it.

/** Parent → sandbox. `code` is already compiled to a JavaScript module (sucrase, in the parent). */
export interface RunMessage {
  type: 'run'
  runId: string
  /** JavaScript module source. Bare imports resolve through the sandbox import map. */
  code: string
  /** HTML put into the preview body before the code runs (html snippets, or a React root). */
  html?: string
  /** Load the @smartdevutils/theme stylesheet into the preview. */
  theme: boolean
  /** Preview colour scheme, mirrored from the playground. */
  colorScheme: 'light' | 'dark'
}

export type ParentToSandbox = RunMessage

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

/** Sandbox → parent. */
export type SandboxToParent =
  | { type: 'ready' }
  | { type: 'console'; runId: string; level: ConsoleLevel; text: string }
  /** The module's default export or last awaited value, formatted as text. */
  | { type: 'result'; runId: string; text: string }
  | { type: 'error'; runId: string; message: string; stack?: string }
  | { type: 'done'; runId: string; ms: number }
  /** Preview content height, so the parent can size the frame. */
  | { type: 'resize'; height: number }

/** Longest text a single console/result message may carry; the sandbox truncates past this. */
export const MAX_MESSAGE_TEXT = 20_000

const LEVELS: readonly ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug']

const isStr = (v: unknown, max = MAX_MESSAGE_TEXT + 100): v is string =>
  typeof v === 'string' && v.length <= max

export function isSandboxToParent(data: unknown): data is SandboxToParent {
  if (!data || typeof data !== 'object') return false
  const m = data as Record<string, unknown>
  switch (m['type']) {
    case 'ready':
      return true
    case 'console':
      return isStr(m['runId'], 64) && LEVELS.includes(m['level'] as ConsoleLevel) && isStr(m['text'])
    case 'result':
      return isStr(m['runId'], 64) && isStr(m['text'])
    case 'error':
      return (
        isStr(m['runId'], 64) &&
        isStr(m['message']) &&
        (m['stack'] === undefined || isStr(m['stack']))
      )
    case 'done':
      return isStr(m['runId'], 64) && typeof m['ms'] === 'number' && Number.isFinite(m['ms'])
    case 'resize':
      return typeof m['height'] === 'number' && Number.isFinite(m['height']) && m['height'] >= 0
    default:
      return false
  }
}

/** Code and HTML larger than this are refused before they reach the sandbox. */
export const MAX_CODE_LENGTH = 200_000

export function isParentToSandbox(data: unknown): data is ParentToSandbox {
  if (!data || typeof data !== 'object') return false
  const m = data as Record<string, unknown>
  return (
    m['type'] === 'run' &&
    isStr(m['runId'], 64) &&
    isStr(m['code'], MAX_CODE_LENGTH) &&
    (m['html'] === undefined || isStr(m['html'], MAX_CODE_LENGTH)) &&
    typeof m['theme'] === 'boolean' &&
    (m['colorScheme'] === 'light' || m['colorScheme'] === 'dark')
  )
}
