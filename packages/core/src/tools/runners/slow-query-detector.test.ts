import { describe, it, expect } from 'vitest'
import { detectSlowQueryPatterns } from '../../database'
import { runner } from './slow-query-detector'

describe('slow-query-detector runner', () => {
  it('reports the website example "SELECT *" as text and data', () => {
    const sql = 'SELECT * FROM orders WHERE customer_id = 42;'
    const patterns = detectSlowQueryPatterns(sql)
    const r = runner.run(sql) as { output: string; meta?: Record<string, unknown> }
    expect(runner.spec.output).toBe('report')
    expect(r.meta?.patterns).toEqual(patterns)
    expect(r.output.startsWith(`Detected Patterns (${patterns.length})`)).toBe(true)
    for (const p of patterns) {
      expect(r.output).toContain(`[${p.severity}] ${p.pattern}`)
      expect(r.output).toContain(`Issue: ${p.explanation}`)
      expect(r.output).toContain(`Fix: ${p.suggestion}`)
    }
  })

  it('counts severities (DELETE without WHERE is an error)', () => {
    const r = runner.run('DELETE FROM sessions;') as { meta?: { counts: Record<string, number> } }
    expect(r.meta!.counts.error).toBeGreaterThan(0)
  })

  it('says when the query looks fine', () => {
    const r = runner.run('SELECT id FROM users WHERE id = 1 LIMIT 1;') as { output: string }
    expect(r.output).toBe('No slow query patterns detected. Looks good!')
  })

  it('returns empty output for empty input', () => {
    expect(runner.run('')).toEqual({ output: '' })
  })
})
