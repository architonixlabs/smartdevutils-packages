/**
 * @smartdevutils/core/tools: run SmartDevUtils tools without the website.
 *
 *   import { loadRunner } from '@smartdevutils/core/tools'
 *   const base64 = await loadRunner('base64-encoder-decoder')
 *   const { output, error } = await base64.run('aGVsbG8=', { mode: 'decode' })
 *
 * This entry holds only specs and lazy loaders. Each tool's logic is loaded on first use,
 * or can be imported directly from '@smartdevutils/core/tools/<tool id>'.
 */
import { RUNNER_LOADERS } from './loaders'
import { TOOL_SPECS } from './specs'
import type { ToolRunContext, ToolRunResult, ToolRunner, ToolSpec } from './types'

export type {
  ToolCatalogEntry,
  ToolInputKind,
  ToolModeSpec,
  ToolOptionSpec,
  ToolRunContext,
  ToolRunResult,
  ToolRunner,
  ToolRuntime,
  ToolSpec,
  ToolType,
} from './types'
export { defineRunner, type ResolvedContext } from './define'
export { defaultOptions, modeLabels, optionsForMode } from './form'
export { TOOL_SPECS }

/** Ids of every tool that has a runner today. */
export const RUNNABLE_TOOL_IDS: readonly string[] = TOOL_SPECS.map((s) => s.id)

const byId = new Map(TOOL_SPECS.map((s) => [s.id, s]))
const bySlug = new Map(TOOL_SPECS.map((s) => [s.slug, s]))

/** The spec of a runnable tool, by tool id or website slug. */
export function getToolSpec(idOrSlug: string): ToolSpec | undefined {
  return byId.get(idOrSlug) ?? bySlug.get(idOrSlug)
}

/** Whether a tool (by id or slug) has a runner in this version of core. */
export function hasRunner(idOrSlug: string): boolean {
  return getToolSpec(idOrSlug) !== undefined
}

const cache = new Map<string, Promise<ToolRunner>>()

/**
 * Loads a tool's runner (by id or slug) on first use and caches it.
 * Rejects with an Error for a tool that has no runner; check `hasRunner()` first to avoid that.
 */
export function loadRunner(idOrSlug: string): Promise<ToolRunner> {
  const spec = getToolSpec(idOrSlug)
  if (!spec) {
    return Promise.reject(new Error(`No runner for "${idOrSlug}". Runnable tools: ${RUNNABLE_TOOL_IDS.join(', ')}.`))
  }
  let p = cache.get(spec.id)
  if (!p) {
    p = RUNNER_LOADERS[spec.id]().then((m) => m.runner)
    p.catch(() => cache.delete(spec.id))
    cache.set(spec.id, p)
  }
  return p
}

/** Loads and runs a tool in one call. Never rejects: a missing runner comes back as `error`. */
export async function runTool(idOrSlug: string, input: string, ctx?: ToolRunContext): Promise<ToolRunResult> {
  let runner: ToolRunner
  try {
    runner = await loadRunner(idOrSlug)
  } catch (err) {
    return { output: '', error: err instanceof Error ? err.message : String(err) }
  }
  return runner.run(input, ctx)
}
