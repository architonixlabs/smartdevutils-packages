import { describe, expect, it } from 'vitest'
import { runner } from './base64-encoder-decoder'

const run = (input: string, mode?: string, options?: Record<string, unknown>) =>
  runner.run(input, { mode, options }) as { output: string; error?: string }

describe('base64-encoder-decoder runner', () => {
  it('encodes by default (website example "Hello World!")', () => {
    expect(run('Hello World!')).toEqual({ output: 'SGVsbG8gV29ybGQh' })
  })

  it('decodes standard Base64, including UTF-8', () => {
    expect(run('SGVsbG8gV29ybGQh', 'decode').output).toBe('Hello World!')
    const enc = run('héllo ✓').output
    expect(run(enc, 'decode').output).toBe('héllo ✓')
  })

  it('decodes the website example "Decode URL"', () => {
    expect(run('aHR0cHM6Ly9leGFtcGxlLmNvbS9hcGkvdXNlcnM/cGFnZT0x', 'decode').output).toBe(
      'https://example.com/api/users?page=1',
    )
  })

  it('URL-safe variants replace + and / and can drop padding', () => {
    const input = '??>>'
    expect(run(input, 'encode').output).toBe('Pz8+Pg==')
    expect(run(input, 'encode', { variant: 'urlsafe' }).output).toBe('Pz8-Pg==')
    expect(run(input, 'encode', { variant: 'urlsafe-nopad' }).output).toBe('Pz8-Pg')
    expect(run('Pz8-Pg', 'decode', { variant: 'urlsafe' }).output).toBe(input)
  })

  it('wraps encoded output at 76 characters when wrapOutput is set', () => {
    const out = run('x'.repeat(100), 'encode', { wrapOutput: true }).output
    const lines = out.split('\n')
    expect(lines[0]).toHaveLength(76)
    expect(lines.join('')).toBe(run('x'.repeat(100)).output)
  })

  it('reports the first invalid character position like the website', () => {
    expect(run('abc$def', 'decode')).toEqual({
      output: '',
      error: "Invalid Base64 encoded string (invalid character at position 3: '$')",
    })
  })

  it('gives empty output for blank input', () => {
    expect(run('   ')).toEqual({ output: '' })
  })

  it('pipes the decode-base64-json-param recipe steps', () => {
    expect(run('eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIn0=', 'decode').output).toBe('{"user":"ada","role":"admin"}')
  })
})
