import type { RecipeRun } from './model'

/** Where a step of a run stands, for a step list. */
export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'stopped' | 'skipped'

/** Plain-English labels for StepStatus. */
export const STEP_STATUS_LABEL: Readonly<Record<StepStatus, string>> = {
  pending: 'Not run',
  running: 'Running…',
  done: 'Done',
  error: 'Error',
  stopped: 'Stopped here',
  skipped: 'Not reached',
}

/**
 * The status of step `index` in a run. `running` is the index of the step that is running now,
 * if any. A step after the one a run stopped at is `skipped`.
 */
export function stepStatus(run: RecipeRun | null | undefined, index: number, running: number | null = null): StepStatus {
  if (running === index) return 'running'
  const t = run?.trace[index]
  if (run?.stopped && run.stopped.index === index) return t?.error ? 'error' : 'stopped'
  if (t) return 'done'
  if (run?.stopped && index > run.stopped.index) return 'skipped'
  return 'pending'
}

/** True when every step of the run has a trace and the run did not stop early. */
export function runFinished(run: RecipeRun | null | undefined): boolean {
  return !!run && !run.stopped && run.trace.length > 0 && run.trace.every((t) => t !== null)
}
