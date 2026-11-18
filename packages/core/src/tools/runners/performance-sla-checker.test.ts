import { describe, it, expect } from 'vitest'
import { parseResponseTimes, runner } from './performance-sla-checker'

const TIMES = '120\n350\n89\n512\n234\n445\n178\n1200\n300'

type R = { output: string; meta: { breachedCount: number } }

describe('performance-sla-checker runner', () => {
  it('returns nothing for empty input', () => {
    expect(runner.run('')).toEqual({ output: '' })
  })

  it('computes percentiles against the default targets (200 / 500 / 1000 ms)', () => {
    const r = runner.run(TIMES) as R
    expect(r.output).toBe(
      [
        'Percentile\tTarget (ms)\tActual (ms)\tStatus',
        'P50\t200\t300\tFAIL',
        'P95\t500\t1200\tFAIL',
        'P99\t1000\t1200\tFAIL',
        '',
        '1 request(s) exceeded the P99 target of 1000ms.',
      ].join('\n'),
    )
    expect(r.meta.breachedCount).toBe(1)
  })

  it('passes with looser targets', () => {
    const r = runner.run('100, 120ms; 140', { options: { p50Target: 150, p95Target: 150, p99Target: 150 } }) as R
    expect(r.output).toContain('P50\t150\t120\tPASS')
    expect(r.output.endsWith('All requests within SLA targets.')).toBe(true)
  })

  it('notes ignored tokens like the website', () => {
    expect(parseResponseTimes('10 abc -5 2ms')).toEqual({ times: [10, 2], ignored: ['abc', '-5'] })
    const r = runner.run('10 abc 20') as R
    expect(r.output.startsWith('Ignored 1 value(s) that are not non-negative numbers: abc\n\n')).toBe(true)
  })

  it('reports errors with the website wording', () => {
    expect(runner.run('abc')).toEqual({
      output: '',
      error: 'No valid numbers found. Enter response times in milliseconds, one per line.',
    })
    expect(runner.run('100', { options: { p95Target: -1 } })).toEqual({
      output: '',
      error: 'Enter a non-negative target for P50, P95 and P99.',
    })
  })
})
