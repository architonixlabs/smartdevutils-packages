/**
 * Headless recipe runs: each step's output is piped into the next step through the tool
 * runners in @smartdevutils/core/tools. The result is a RecipeRun, which buildRunFile()
 * turns into an `sdu-recipe-run/1` file that the website's run summary can upload.
 *
 * The stop rules follow the website's replay (ChainService and the tool page shell):
 * an error stops the run, a step with no output stops it, and a tool that shows a report
 * (no output panel) can only be the last step.
 */
import { hasRunner as coreHasRunner, loadRunner as coreLoadRunner } from '@smartdevutils/core/tools'
import type { ToolRunner } from '@smartdevutils/core/tools'
import { TOOL_CATALOG } from '@smartdevutils/core/tools/catalog'
import type { BuiltinRecipe, RecipePlanStep, RecipeRun, RecipeTraceStep } from './model'
import { buildRunFile, capValue, parseRunFile, type RunImport } from './recipe-run'
import { builtinTools, planSteps } from './recipes'
import { BUILTIN_RECIPES } from './library'
import type { RecipeToolInfo } from './tool-info'

/** The stop reasons, worded as on the website's run summary. */
export const STOP_REASONS = {
  error: (message: string) => `This step reported an error: ${message}`,
  noOutput: 'This step gave no output. Open it, check the input and settings, then continue.',
  report: 'This tool shows a report, not an output to pass on, so the replay stopped here.',
  noRunner: (name: string) => `${name} cannot run headless yet (no runner in @smartdevutils/core/tools).`,
  cancelled: 'The run was cancelled.',
} as const

export interface RunRecipeOptions {
  /** Where runners come from. Defaults to `loadRunner` from @smartdevutils/core/tools. */
  loadRunner?: (toolId: string) => Promise<ToolRunner>
  /** Which tools have a runner. Defaults to `hasRunner` from @smartdevutils/core/tools. */
  hasRunner?: (toolId: string) => boolean
  /** Called after each step with what it received and produced. */
  onStep?: (index: number, step: RecipeTraceStep, plan: RecipePlanStep) => void
  signal?: AbortSignal
  /** Clock for `updatedAt` (tests). */
  now?: () => number
}

/** A step to run: a tool id or website slug, with an optional mode and settings. */
export interface StepInput {
  toolId?: string
  slug?: string
  mode?: string
  options?: Record<string, unknown>
}

function byIdOrSlug(tools: readonly RecipeToolInfo[], s: StepInput): RecipeToolInfo | undefined {
  return tools.find((t) => (s.toolId && t.id === s.toolId) || (s.slug && t.slug === s.slug))
}

/** Resolves steps against the tool catalog into the website's RecipePlanStep shape. Throws on an unknown tool. */
export function resolveSteps(steps: readonly StepInput[], tools: readonly RecipeToolInfo[] = TOOL_CATALOG): RecipePlanStep[] {
  return steps.map((s, i) => {
    const tool = byIdOrSlug(tools, s)
    if (!tool) throw new Error(`Step ${i + 1}: unknown tool "${s.toolId ?? s.slug ?? ''}".`)
    return {
      toolId: tool.id,
      slug: tool.slug,
      name: tool.name,
      ...(s.mode ? { mode: s.mode } : {}),
      ...(s.options ? { options: { ...s.options } } : {}),
    }
  })
}

/** The plan steps of a built-in recipe (modes and settings applied), as the website builds them. */
export function recipeSteps(recipe: BuiltinRecipe, tools: readonly RecipeToolInfo[] = TOOL_CATALOG): RecipePlanStep[] {
  return planSteps(builtinTools(recipe, tools), recipe.modes, recipe.options)
}

/** Whether every tool in the recipe has a headless runner in the installed @smartdevutils/core. */
export function isRunnable(
  recipe: Pick<BuiltinRecipe, 'toolIds'> | { steps: readonly StepInput[] },
  hasRunner: (idOrSlug: string) => boolean = coreHasRunner,
): boolean {
  const ids = 'toolIds' in recipe ? recipe.toolIds : recipe.steps.map((s) => s.toolId ?? s.slug ?? '')
  return ids.length > 0 && ids.every((id) => hasRunner(id))
}

/** The tools of a recipe that have no runner yet (empty when the recipe is runnable). */
export function missingRunners(
  recipe: Pick<BuiltinRecipe, 'toolIds'>,
  hasRunner: (idOrSlug: string) => boolean = coreHasRunner,
): string[] {
  return recipe.toolIds.filter((id) => !hasRunner(id))
}

/** The built-in recipes that run headless today. */
export function runnableRecipes(
  recipes: readonly BuiltinRecipe[] = BUILTIN_RECIPES,
  hasRunner: (idOrSlug: string) => boolean = coreHasRunner,
): BuiltinRecipe[] {
  return recipes.filter((r) => isRunnable(r, hasRunner))
}

/**
 * Runs plan steps in order, piping each output into the next step. Never throws for tool
 * problems: they end the run with `stopped`. The full value is piped on; the stored trace
 * keeps at most RUN_VALUE_MAX characters per value, as the website does.
 */
export async function runSteps(
  name: string,
  steps: readonly RecipePlanStep[],
  input: string,
  opts: RunRecipeOptions & { basedOn?: string } = {},
): Promise<RecipeRun> {
  const load = opts.loadRunner ?? coreLoadRunner
  const has = opts.hasRunner ?? coreHasRunner
  const now = opts.now ?? Date.now
  const run: RecipeRun = {
    name,
    ...(opts.basedOn ? { basedOn: opts.basedOn } : {}),
    steps: steps.map((s) => ({ ...s, ...(s.options ? { options: { ...s.options } } : {}) })),
    trace: steps.map(() => null),
    updatedAt: now(),
  }
  const stop = (index: number, reason: string) => {
    run.stopped = { index, reason }
    run.updatedAt = now()
    return run
  }

  let value = input
  for (const [i, step] of steps.entries()) {
    if (opts.signal?.aborted) return stop(i, STOP_REASONS.cancelled)
    if (!has(step.toolId)) return stop(i, STOP_REASONS.noRunner(step.name))

    let runner: ToolRunner
    try {
      runner = await load(step.toolId)
    } catch (err) {
      return stop(i, STOP_REASONS.noRunner(step.name) + ` ${err instanceof Error ? err.message : ''}`.trimEnd())
    }

    const result = await runner.run(value, {
      ...(step.mode ? { mode: step.mode } : {}),
      ...(step.options ? { options: step.options } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    })
    const capIn = capValue(value)
    const capOut = capValue(result.output ?? '')
    const report = runner.spec.output === 'report'
    const trace: RecipeTraceStep = {
      input: capIn.value,
      output: capOut.value,
      ...(result.error ? { error: result.error.slice(0, 2000) } : {}),
      ...(report && !result.error ? { noOutputPanel: true } : {}),
      ...(capIn.cut || capOut.cut ? { truncated: true } : {}),
    }
    run.trace[i] = trace
    opts.onStep?.(i, trace, step)

    if (result.error) return stop(i, STOP_REASONS.error(result.error))
    const last = i === steps.length - 1
    if (report) {
      if (last) break
      return stop(i, STOP_REASONS.report)
    }
    if (!result.output) return stop(i, STOP_REASONS.noOutput)
    value = result.output
  }
  run.updatedAt = now()
  return run
}

/**
 * Runs a built-in recipe (or any recipe in the same shape) on `input`, which defaults to the
 * recipe's own synthetic sample.
 */
export function runRecipe(recipe: BuiltinRecipe, input?: string, opts: RunRecipeOptions = {}): Promise<RecipeRun> {
  return runSteps(recipe.name, recipeSteps(recipe), input ?? recipe.sample, { ...opts, basedOn: recipe.id })
}

/** Looks up a built-in recipe by id. */
export function getRecipe(id: string, recipes: readonly BuiltinRecipe[] = BUILTIN_RECIPES): BuiltinRecipe | undefined {
  return recipes.find((r) => r.id === id)
}

/** Reads a run file (for example one downloaded from the website), resolving tools from the full catalog. */
export function readRunFile(text: string, tools: readonly RecipeToolInfo[] = TOOL_CATALOG, now = Date.now()): RunImport {
  return parseRunFile(text, tools, now)
}

/** The run as the JSON text of an `sdu-recipe-run/1` file. */
export function runFileText(run: RecipeRun, now = new Date()): string {
  return JSON.stringify(buildRunFile(run, now), null, 2)
}

/**
 * Runs a run file again from its recorded step-1 input (the website's "Re-run"), returning the
 * fresh run. Errors from reading the file come back as `{ error }`.
 */
export async function rerunFile(
  text: string,
  opts: RunRecipeOptions & { tools?: readonly RecipeToolInfo[] } = {},
): Promise<{ run: RecipeRun; notes: string[] } | { error: string }> {
  const read = readRunFile(text, opts.tools)
  if ('error' in read) return read
  const input = read.run.trace[0]?.input
  if (input === undefined) return { error: 'The file has no input for step 1.' }
  const run = await runSteps(read.run.name, read.run.steps, input, { ...opts, basedOn: read.run.basedOn })
  return { run, notes: read.notes }
}

/** A change to one step before it runs again (see `runFrom`). */
export interface StepEdit {
  /** The value the step receives. Defaults to the input recorded for it, or the output of the step before. */
  input?: string
  /** A new mode for the step. An empty string clears it (the tool's default mode). */
  mode?: string
  /** New settings for the step. They replace the recorded ones. */
  options?: Record<string, unknown>
}

/**
 * Runs a recorded run again from step `index` (0-based), optionally with a changed input, mode or
 * settings for that step. Steps before `index` keep their recorded trace; the step and everything
 * after it are run again, piping as `runSteps` does. Returns a new run; `run` is not changed.
 *
 * The recorded values are capped at RUN_VALUE_MAX characters, so a step whose input was cut
 * (`truncated`) runs again on the cut value unless you pass `edit.input`.
 */
export async function runFrom(
  run: RecipeRun,
  index: number,
  edit: StepEdit = {},
  opts: RunRecipeOptions = {},
): Promise<RecipeRun> {
  if (!Number.isInteger(index) || index < 0 || index >= run.steps.length) {
    throw new RangeError(`Step ${index + 1} does not exist; the run has ${run.steps.length} steps.`)
  }
  const steps = run.steps.map((s) => ({ ...s, ...(s.options ? { options: { ...s.options } } : {}) }))
  const step = steps[index]!
  if (edit.mode !== undefined) {
    if (edit.mode) step.mode = edit.mode
    else delete step.mode
  }
  if (edit.options !== undefined) step.options = { ...edit.options }
  const input = edit.input ?? run.trace[index]?.input ?? (index > 0 ? run.trace[index - 1]?.output : undefined)
  if (input === undefined) throw new Error(`Step ${index + 1} has no input yet. Run the steps before it first.`)

  const onStep = opts.onStep
  const tail = await runSteps(run.name, steps.slice(index), input, {
    ...opts,
    ...(onStep ? { onStep: (i, t, p) => onStep(i + index, t, p) } : {}),
    ...(run.basedOn ? { basedOn: run.basedOn } : {}),
  })
  const merged: RecipeRun = {
    name: run.name,
    ...(run.basedOn ? { basedOn: run.basedOn } : {}),
    steps,
    trace: [...run.trace.slice(0, index).map((t) => (t ? { ...t } : null)), ...tail.trace],
    updatedAt: tail.updatedAt,
  }
  if (tail.stopped) merged.stopped = { index: tail.stopped.index + index, reason: tail.stopped.reason }
  return merged
}
