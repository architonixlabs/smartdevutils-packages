import type { ToolRunContext, ToolRunResult, ToolRunner, ToolSpec } from './types'

/** The context a runner implementation receives: the mode is resolved and the options have their defaults. */
export interface ResolvedContext {
  mode: string
  options: Record<string, unknown>
  signal?: AbortSignal
}

/**
 * Wraps a tool implementation so every runner behaves the same way:
 * - an unknown mode is an error (not a silent fallback);
 * - options start from the spec defaults, and unknown keys are dropped;
 * - a thrown error becomes `{ output: '', error }`;
 * - an aborted signal stops the run before it starts.
 */
export function defineRunner(
  spec: ToolSpec,
  impl: (input: string, ctx: ResolvedContext) => ToolRunResult | Promise<ToolRunResult>,
): ToolRunner {
  return {
    spec,
    run(input: string, ctx: ToolRunContext = {}) {
      if (ctx.signal?.aborted) return { output: '', error: 'The run was cancelled.' }
      const mode = ctx.mode ?? spec.defaultMode ?? ''
      if (spec.modes.length && !spec.modes.some((m) => m.id === mode)) {
        return {
          output: '',
          error: `Unknown mode "${mode}" for ${spec.id}. Modes: ${spec.modes.map((m) => m.id).join(', ')}.`,
        }
      }
      const options: Record<string, unknown> = {}
      for (const o of spec.options) {
        const given = ctx.options?.[o.key]
        options[o.key] = given === undefined ? o.default : given
      }
      const text = typeof input === 'string' ? input : String(input ?? '')
      try {
        const out = impl(text, { mode, options, signal: ctx.signal })
        if (out && typeof (out as Promise<ToolRunResult>).then === 'function') {
          return (out as Promise<ToolRunResult>).catch((err: unknown) => ({ output: '', error: errorMessage(err) }))
        }
        return out
      } catch (err) {
        return { output: '', error: errorMessage(err) }
      }
    },
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : 'An error occurred'
}

/** Option readers that tolerate values coming from JSON, query strings or forms. */
export const opt = {
  str(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : v === undefined || v === null ? fallback : String(v)
  },
  num(v: unknown, fallback: number): number {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
    return Number.isFinite(n) ? n : fallback
  },
  bool(v: unknown, fallback = false): boolean {
    if (typeof v === 'boolean') return v
    if (v === 'true' || v === 1 || v === '1') return true
    if (v === 'false' || v === 0 || v === '0') return false
    return fallback
  },
  oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
    return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  },
}
