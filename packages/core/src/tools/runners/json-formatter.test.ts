import { describe, expect, it } from 'vitest'
import { runner } from './json-formatter'

const run = (input: string, mode?: string) => runner.run(input, { mode }) as { output: string; error?: string; meta?: Record<string, unknown> }

describe('json-formatter runner', () => {
  it('formats with 2-space indent by default', () => {
    expect(run('{"a":1,"b":[1,2]}').output).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}')
  })

  it('minifies', () => {
    expect(run('{\n  "a": 1,\n  "b": "x y"\n}', 'minify').output).toBe('{"a":1,"b":"x y"}')
  })

  it('validates', () => {
    expect(run('[1,2]', 'validate')).toEqual({ output: 'Valid JSON', meta: { valid: true } })
    const bad = run('{bad', 'validate')
    expect(bad.output).toBe('')
    expect(bad.error).toMatch(/^Invalid JSON: /)
    expect(bad.meta).toEqual({ valid: false })
  })

  it('strips a byte-order mark', () => {
    expect(run('﻿{"a":1}', 'minify').output).toBe('{"a":1}')
  })

  it('returns the website error for invalid JSON when formatting', () => {
    const r = run('{"a":}')
    expect(r.output).toBe('')
    expect(r.error).toMatch(/^Invalid JSON: /)
  })

  it('formats the website "API Response" example', () => {
    const input = '{"status":"success","meta":{"requestId":"req_abc123","duration":45}}'
    expect(run(input).output).toBe(JSON.stringify(JSON.parse(input), null, 2))
  })

  it('gives empty output for blank input and rejects unknown modes', () => {
    expect(run('  ')).toEqual({ output: '' })
    expect(run('{}', 'yaml').error).toMatch(/Unknown mode/)
  })
})
