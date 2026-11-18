import { describe, it, expect } from 'vitest'
import { runner } from './boundary-value-analyzer'

type R = { output: string; meta: { fieldName: string; cases: { value: number }[] } }

describe('boundary-value-analyzer runner', () => {
  it('uses the website defaults (age, integer, 0 to 120) when there is no input', () => {
    expect((runner.run('') as R).output).toBe(
      [
        'Label\tValue for "age"\tType',
        'Below minimum\t-1\tbelow-min',
        'At minimum\t0\tat-min',
        'Just above minimum\t1\tjust-above-min',
        'Nominal (middle)\t60\tnominal',
        'Just below maximum\t119\tjust-below-max',
        'At maximum\t120\tat-max',
        'Above maximum\t121\tabove-max',
      ].join('\n'),
    )
  })

  it('keeps the decimal midpoint and rounds to 2 places', () => {
    const r = runner.run('', { options: { fieldType: 'decimal', min: 0, max: 1, fieldName: 'ratio' } }) as R
    expect(r.meta.cases.map((c) => c.value)).toEqual([-0.01, 0, 0.01, 0.5, 0.99, 1, 1.01])
    expect(r.output).toContain('Value for "ratio"')
  })

  it('drops repeated values for a narrow range', () => {
    const r = runner.run('', { options: { min: 1, max: 1 } }) as R
    expect(r.meta.cases.map((c) => c.value)).toEqual([0, 1, 2])
  })

  it('lets a JSON input override the options', () => {
    const r = runner.run('{"fieldName":"qty","type":"integer","min":10,"max":20}') as R
    expect(r.meta.fieldName).toBe('qty')
    expect(r.meta.cases[0].value).toBe(9)
  })

  it('reports invalid ranges with the website wording', () => {
    expect(runner.run('', { options: { min: 5, max: 1 } })).toEqual({ output: '', error: 'Minimum (5) is greater than maximum (1).' })
    expect(runner.run('', { options: { min: 0.5, max: 2 } })).toEqual({
      output: '',
      error: 'Integer fields need whole-number limits. Switch the type to Decimal for fractional limits.',
    })
    expect(runner.run('', { options: { min: '', max: 2 } })).toEqual({ output: '', error: 'Enter both a minimum and a maximum.' })
    expect((runner.run('nope') as { error: string }).error).toMatch(/^JSON parse error/)
  })
})
