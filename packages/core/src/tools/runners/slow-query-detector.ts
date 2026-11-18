// Mirrors the website's SlowQueryDetectorComponent. The website shows cards, not an output panel,
// so `output` is the same content as plain text and `meta.patterns` is the core result.
import { detectSlowQueryPatterns, type SlowQueryPattern } from '../../database'
import { defineRunner } from '../define'
import { spec } from '../specs/slow-query-detector'

export function formatSlowQueryReport(patterns: SlowQueryPattern[]): string {
  if (!patterns.length) return 'No slow query patterns detected. Looks good!'
  const cards = patterns.map((p) => `[${p.severity}] ${p.pattern}\nIssue: ${p.explanation}\nFix: ${p.suggestion}`)
  return `Detected Patterns (${patterns.length})\n\n${cards.join('\n\n')}`
}

export const runner = defineRunner(spec, (input) => {
  if (!input.trim()) return { output: '' }
  const patterns = detectSlowQueryPatterns(input)
  const counts = { error: 0, warning: 0, info: 0 }
  for (const p of patterns) counts[p.severity]++
  return { output: formatSlowQueryReport(patterns), meta: { patterns, counts } }
})

export default runner
