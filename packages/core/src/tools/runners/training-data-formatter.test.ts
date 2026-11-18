import { describe, it, expect } from 'vitest'
import { runner } from './training-data-formatter'

const ROWS = JSON.stringify([
  { input: 'What is the capital of France?', output: 'The capital of France is Paris.' },
  { input: 'Who wrote Hamlet?', output: 'Hamlet was written by William Shakespeare.' },
])

const expected =
  '{"messages":[{"role":"user","content":"What is the capital of France?"},{"role":"assistant","content":"The capital of France is Paris."}]}\n' +
  '{"messages":[{"role":"user","content":"Who wrote Hamlet?"},{"role":"assistant","content":"Hamlet was written by William Shakespeare."}]}\n'

describe('training-data-formatter runner', () => {
  it('returns nothing for empty input', () => {
    expect(runner.run('  ')).toEqual({ output: '' })
  })

  it('formats rows as OpenAI JSONL by default', () => {
    expect(runner.run(ROWS)).toMatchObject({ output: expected })
  })

  it('formats rows as Anthropic JSONL (same as OpenAI without a system prompt)', () => {
    expect(runner.run(ROWS, { options: { format: 'anthropic' } })).toMatchObject({ output: expected })
  })

  it('reports a JSON parse error', () => {
    const r = runner.run('{not json') as { output: string; error: string }
    expect(r.output).toBe('')
    expect(r.error).toMatch(/^JSON parse error: /)
  })

  it('validates rows with the website wording', () => {
    expect(runner.run('{}')).toEqual({ output: '', error: 'Input must be a JSON array of {input, output} objects.' })
    expect(runner.run('[]')).toEqual({ output: '', error: 'The array is empty — add at least one {input, output} object.' })
    expect(runner.run('[{"input":"q","output":" "}]')).toEqual({ output: '', error: 'Row 1: "output" must be a non-empty string.' })
    expect(runner.run('[{"input":"q","output":"a"}, 5]')).toEqual({
      output: '',
      error: 'Row 2: expected an object with "input" and "output".',
    })
  })
})
