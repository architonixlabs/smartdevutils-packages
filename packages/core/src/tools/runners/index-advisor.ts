// Mirrors the website's IndexAdvisorComponent. The website shows cards, not an output panel,
// so `output` is the same content as plain text and `meta.suggestions` is the core result.
import { analyzeQueryForIndexes, type IndexSuggestion } from '../../database'
import { defineRunner } from '../define'
import { spec } from '../specs/index-advisor'

export function formatIndexReport(suggestions: IndexSuggestion[]): string {
  if (!suggestions.length) return 'No index suggestions found for this query.'
  const cards = suggestions.map((s) => `${s.column}: ${s.reason}\n${s.sql}`)
  return `Index Suggestions (${suggestions.length})\n\n${cards.join('\n\n')}`
}

export const runner = defineRunner(spec, (input) => {
  if (!input.trim()) return { output: '' }
  const suggestions = analyzeQueryForIndexes(input)
  return { output: formatIndexReport(suggestions), meta: { suggestions } }
})

export default runner
