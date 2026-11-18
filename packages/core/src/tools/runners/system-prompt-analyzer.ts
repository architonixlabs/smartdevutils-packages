// Mirrors the website's SystemPromptAnalyzerComponent. The website shows a grade card, not an
// output panel, so `output` is the same content as plain text; `meta` is the core result.
import { analyzeSystemPrompt } from '../../aiml-tools'
import { defineRunner } from '../define'
import { spec } from '../specs/system-prompt-analyzer'

/** Max points per dimension in the core analyzer, as the website shows them. */
export const PROMPT_DIMENSIONS = [
  { key: 'clarity', max: 4 },
  { key: 'scope', max: 4 },
  { key: 'tone', max: 3 },
  { key: 'constraints', max: 3 },
  { key: 'format', max: 3 },
] as const

export const runner = defineRunner(spec, (input) => {
  if (!input.trim()) return { output: '' }
  const result = analyzeSystemPrompt(input)
  const lines = [
    `Overall Grade: ${result.overall}`,
    '',
    'Dimension Scores',
    ...PROMPT_DIMENSIONS.map((d) => `${d.key}: ${result.scores[d.key]}/${d.max}`),
  ]
  if (result.suggestions.length > 0) {
    lines.push('', 'Suggestions', ...result.suggestions.map((s) => `- ${s}`))
  }
  return { output: lines.join('\n'), meta: { ...result } }
})

export default runner
