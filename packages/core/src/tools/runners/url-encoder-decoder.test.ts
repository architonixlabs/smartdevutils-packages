import { describe, expect, it } from 'vitest'
import { parseQueryParams, runner } from './url-encoder-decoder'

const run = (input: string, mode?: string, options?: Record<string, unknown>) =>
  runner.run(input, { mode, options }) as { output: string; error?: string; meta?: Record<string, unknown> }

describe('url-encoder-decoder runner', () => {
  it('encodes as a URI component by default', () => {
    expect(run('a b&c=d/é').output).toBe('a%20b%26c%3Dd%2F%C3%A9')
  })

  it('encodes a full URI, keeping its structure', () => {
    const r = run('https://example.com/search?q=hello world&lang=en', 'encode', { encodeMode: 'full' })
    expect(r.output).toBe('https://example.com/search?q=hello%20world&lang=en')
  })

  it('encodes a query string, keeping & and =', () => {
    const r = run('name=Ada Lovelace&city=New York', 'encode', { encodeMode: 'query' })
    expect(r.output).toBe('name=Ada%20Lovelace&city=New%20York')
    expect(r.meta?.queryParams).toEqual([
      { key: 'name', value: 'Ada Lovelace' },
      { key: 'city', value: 'New York' },
    ])
  })

  it('decodes', () => {
    expect(run('https%3A%2F%2Fexample.com%2Fapi%3Fpage%3D1', 'decode').output).toBe('https://example.com/api?page=1')
  })

  it('reports malformed percent-encoding', () => {
    const r = run('%E0%A4%A', 'decode')
    expect(r.output).toBe('')
    expect(r.error).toBeTruthy()
  })

  it('batch mode works per line and keeps lines it cannot decode', () => {
    expect(run('a b\nc&d', 'encode', { batchMode: true }).output).toBe('a%20b\nc%26d')
    expect(run('a%20b\n%E0%A4%A', 'decode', { batchMode: true }).output).toBe('a b\n%E0%A4%A')
  })

  it('returns nothing for blank input', () => {
    expect(run('   ')).toEqual({ output: '' })
  })

  it('parses query params like the website', () => {
    expect(parseQueryParams('https://example.com')).toEqual([])
    expect(parseQueryParams('a=1+2&b#frag')).toEqual([
      { key: 'a', value: '1 2' },
      { key: 'b', value: '' },
    ])
  })
})
