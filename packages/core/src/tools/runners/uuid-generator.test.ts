import { describe, expect, it } from 'vitest'
import { runner } from './uuid-generator'

const run = (input: string, options?: Record<string, unknown>) =>
  runner.run(input, { options }) as { output: string; error?: string; meta?: { uuids: string[] } }

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuid-generator runner', () => {
  it('generates 5 v4 UUIDs, one per line, by default', () => {
    const lines = run('').output.split('\n')
    expect(lines).toHaveLength(5)
    for (const l of lines) expect(l).toMatch(V4)
  })

  it('takes the count from options, else from a number given as input, clamped to 1..1000', () => {
    expect(run('', { count: 3 }).output.split('\n')).toHaveLength(3)
    expect(run('10').output.split('\n')).toHaveLength(10)
    expect(run('7', { count: 2 }).output.split('\n')).toHaveLength(2)
    expect(run('', { count: 5000 }).meta!.uuids).toHaveLength(1000)
    expect(run('', { count: 0 }).meta!.uuids).toHaveLength(1)
  })

  it('generates v1 and v7', () => {
    expect(run('', { version: 'v1', count: 1 }).output).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-1/)
    expect(run('', { version: 'v7', count: 1 }).output).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
  })

  it('generates one deterministic v5 UUID from namespace and name', () => {
    // RFC 4122 DNS namespace + "example.com"
    expect(run('', { version: 'v5' }).output).toBe('cfbff0d1-9375-5685-968c-48ce8b15ae17')
  })

  it('needs both namespace and name for v5', () => {
    expect(run('', { version: 'v5', v5name: ' ' })).toEqual({
      output: '',
      error: 'Namespace UUID and Name are required for v5.',
    })
  })

  it('formats as JSON array, CSV and SQL INSERT', () => {
    const json = run('', { count: 2, outputFormat: 'json-array' }).output
    expect(JSON.parse(json)).toHaveLength(2)
    expect(run('', { count: 3, outputFormat: 'csv' }).output.split(',')).toHaveLength(3)
    expect(run('', { count: 1, outputFormat: 'sql-insert' }).output).toMatch(
      /^INSERT INTO uuids \(id\) VALUES \('[0-9a-f-]{36}'\);$/,
    )
  })
})
