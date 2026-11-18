import { describe, expect, it } from 'vitest'
import { STEP_STATUS_LABEL, runFinished, stepStatus, type RecipeRun } from './index'

const run = (trace: RecipeRun['trace'], stopped?: RecipeRun['stopped']): RecipeRun => ({
  name: 'r', steps: [], trace, updatedAt: 0, ...(stopped ? { stopped } : {}),
})

describe('stepStatus', () => {
  it('covers every state', () => {
    const t = { input: 'a', output: 'b' }
    expect(stepStatus(null, 0)).toBe('pending')
    expect(stepStatus(run([t, null]), 1, 1)).toBe('running')
    expect(stepStatus(run([t, null]), 0)).toBe('done')
    const stopped = run([t, { input: 'b', output: '', error: 'x' }, null], { index: 1, reason: 'r' })
    expect(stepStatus(stopped, 1)).toBe('error')
    expect(stepStatus(stopped, 2)).toBe('skipped')
    expect(stepStatus(run([t, { input: 'b', output: '' }], { index: 1, reason: 'r' }), 1)).toBe('stopped')
    expect(STEP_STATUS_LABEL.skipped).toBe('Not reached')
  })

  it('runFinished needs every step and no stop', () => {
    const t = { input: 'a', output: 'b' }
    expect(runFinished(run([t, t]))).toBe(true)
    expect(runFinished(run([t, null]))).toBe(false)
    expect(runFinished(run([t, t], { index: 1, reason: 'r' }))).toBe(false)
    expect(runFinished(null)).toBe(false)
  })
})
