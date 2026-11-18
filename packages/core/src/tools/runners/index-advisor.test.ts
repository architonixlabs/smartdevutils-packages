import { describe, it, expect } from 'vitest'
import { analyzeQueryForIndexes } from '../../database'
import { formatIndexReport, runner } from './index-advisor'

// The website's own first example.
const EXAMPLE =
  "SELECT id, name, email FROM customers WHERE country = 'US' AND status = 'active' ORDER BY created_at DESC LIMIT 20;"

describe('index-advisor runner', () => {
  it('is a report tool with the core suggestions in meta', () => {
    expect(runner.spec.output).toBe('report')
    const r = runner.run(EXAMPLE) as { output: string; meta?: Record<string, unknown> }
    const suggestions = analyzeQueryForIndexes(EXAMPLE)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(r.meta?.suggestions).toEqual(suggestions)
    expect(r.output).toBe(formatIndexReport(suggestions))
    expect(r.output.startsWith(`Index Suggestions (${suggestions.length})`)).toBe(true)
    for (const s of suggestions) expect(r.output).toContain(s.sql)
  })

  it('says when there is nothing to suggest', () => {
    const r = runner.run('SELECT 1;') as { output: string }
    expect(r.output).toBe('No index suggestions found for this query.')
  })

  it('returns empty output for empty input', () => {
    expect(runner.run('   ')).toEqual({ output: '' })
  })
})
