import { describe, it, expect } from 'vitest'
import { parseSprintPoints, runner } from './sprint-velocity'

type R = { output: string; meta: Record<string, unknown> }

describe('sprint-velocity runner', () => {
  it('returns nothing for empty input', () => {
    expect(runner.run(' ')).toEqual({ output: '' })
  })

  it('computes average, trend and prediction', () => {
    const r = runner.run('20\n22\n25\n30') as R
    expect(r.output).toBe(
      'Average Velocity: 24.3 story points / sprint\nTrend: improving\nMin: 20 · Max: 30\nPredicted Next Sprint: 24 story points',
    )
    expect(r.meta).toMatchObject({ average: 24.3, trend: 'improving', predicted: 24, min: 20, max: 30 })
  })

  it('accepts commas, spaces and JSON arrays, skips non-numbers and caps at 12 sprints', () => {
    expect(parseSprintPoints('30, 28; x 20')).toEqual([30, 28, 20])
    expect(parseSprintPoints('[30, null, "25"]')).toEqual([30, 25])
    expect(parseSprintPoints(Array.from({ length: 15 }, (_, i) => i + 1).join(' '))).toHaveLength(12)
    expect((runner.run('30 28 20 18') as R).meta.trend).toBe('declining')
  })

  it('reports no usable numbers with the website message', () => {
    expect(runner.run('abc')).toEqual({ output: '', error: 'Enter story points for at least one sprint.' })
  })
})
