import { describe, it, expect } from 'vitest'
import { runner } from './gantt-generator'

describe('gantt-generator runner', () => {
  it('returns nothing for empty input', () => {
    expect(runner.run('')).toEqual({ output: '' })
  })

  it('builds the website default row', () => {
    const r = runner.run(JSON.stringify([{ title: 'Design', start: '2024-01-01', end: '2024-01-07', section: 'Phase 1' }]))
    expect(r).toMatchObject({
      output:
        'gantt\n    title Project Timeline\n    dateFormat  YYYY-MM-DD\n    section Phase 1\n    Design : 2024-01-01, 2024-01-07',
    })
  })

  it('cleans Mermaid-breaking characters, groups blank sections under Tasks and skips empty rows', () => {
    const r = runner.run(
      JSON.stringify({
        milestones: [
          { title: 'Build: API #1', start: '2024-02-01', end: '2024-02-10' },
          { title: '', start: '', end: '' },
        ],
      }),
    ) as { output: string }
    expect(r.output).toContain('    section Tasks\n    Build API 1 : 2024-02-01, 2024-02-10')
  })

  it('reports the website validation errors', () => {
    expect(runner.run('[]')).toEqual({ output: '', error: 'Add at least one task with a name, start and end date.' })
    expect(runner.run('[{"title":"Ship","start":"2024-03-10","end":"2024-03-01"}]')).toEqual({
      output: '',
      error: 'Ship: end date is before start date.',
    })
    expect(runner.run('[{"title":"Ship","start":"2024-03-10"}]')).toEqual({
      output: '',
      error: 'Ship: start and end dates are required.',
    })
    expect(runner.run('[{"title":"  ","start":"2024-03-10","end":"2024-03-11"}]')).toEqual({
      output: '',
      error: 'Row 1: task name is required.',
    })
  })

  it('rejects input that is not JSON or not a list', () => {
    expect((runner.run('Design 2024') as { error: string }).error).toMatch(/^JSON parse error/)
    expect((runner.run('{"a":1}') as { error: string }).error).toContain('JSON array')
  })
})
