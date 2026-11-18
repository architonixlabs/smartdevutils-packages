import { describe, expect, it } from 'vitest'
import { getRecipe, runFrom, runRecipe } from './index'

describe('runFrom', () => {
  const recipe = getRecipe('decode-base64-json-param')!
  const now = () => 1_700_000_000_000

  it('re-runs from a step with a changed input and keeps the earlier trace', async () => {
    const run = await runRecipe(recipe, undefined, { now })
    expect(run.stopped).toBeUndefined()
    const seen: number[] = []
    const again = await runFrom(run, 2, { input: '{"id":7}' }, { now, onStep: (i) => seen.push(i) })
    expect(seen).toEqual([2])
    expect(again.trace[0]).toEqual(run.trace[0])
    expect(again.trace[1]).toEqual(run.trace[1])
    expect(again.trace[2]?.input).toBe('{"id":7}')
    expect(again.trace[2]?.output).toBe('{\n  "id": 7\n}')
    expect(run.trace[2]?.input).not.toBe('{"id":7}')
  })

  it('applies a new mode to the edited step and reports the stop index in run terms', async () => {
    const run = await runRecipe(recipe, undefined, { now })
    const again = await runFrom(run, 2, { mode: 'validate', input: '{bad' }, { now })
    expect(again.steps[2]?.mode).toBe('validate')
    expect(again.stopped?.index).toBe(2)
    expect(again.trace[2]?.error).toMatch(/Invalid JSON/)
  })

  it('uses the previous output when the step has not run yet, and rejects bad indexes', async () => {
    const run = await runRecipe(recipe, undefined, { now })
    const partial = { ...run, trace: [run.trace[0], run.trace[1], null] }
    const again = await runFrom(partial, 2, {}, { now })
    expect(again.trace[2]?.input).toBe(run.trace[1]?.output)
    await expect(runFrom(run, 9)).rejects.toThrow(/does not exist/)
    await expect(runFrom({ ...run, trace: [null, null, null] }, 1)).rejects.toThrow(/no input/)
  })
})
