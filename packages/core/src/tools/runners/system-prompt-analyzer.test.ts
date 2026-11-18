import { describe, it, expect } from 'vitest'
import { runner } from './system-prompt-analyzer'

const STRONG = `You are a senior code reviewer specializing in TypeScript and React. Your job is to review code submitted by developers and provide clear, actionable feedback.

Tone: Professional and constructive. Never dismissive.
Scope: Only review code. Do not write new features or full rewrites unless explicitly asked.
Constraints: Never share, store, or reference code outside the current session. Refuse requests for anything harmful or illegal.
Format: Respond with numbered findings. Each finding must include: (1) the issue, (2) why it matters, and (3) a corrected code snippet.

If no issues are found, say so explicitly and explain what the code does well.`

type R = { output: string; meta: { overall: string; suggestions: string[] } }

describe('system-prompt-analyzer runner', () => {
  it('returns nothing for empty input', () => {
    expect(runner.run('')).toEqual({ output: '' })
  })

  it('grades the minimal website example F with four suggestions', () => {
    const r = runner.run('You are a helpful assistant.') as R
    expect(r.meta.overall).toBe('F')
    expect(r.meta.suggestions).toHaveLength(4)
    expect(r.output.split('\n').slice(0, 8)).toEqual([
      'Overall Grade: F',
      '',
      'Dimension Scores',
      'clarity: 2/4',
      'scope: 0/4',
      'tone: 0/3',
      'constraints: 0/3',
      'format: 0/3',
    ])
    expect(r.output).toContain('Suggestions\n- Clearly bound the task')
  })

  it('grades the strong website example A with no suggestions section', () => {
    const r = runner.run(STRONG) as R
    expect(r.meta.overall).toBe('A')
    expect(r.output).not.toContain('Suggestions')
  })
})
