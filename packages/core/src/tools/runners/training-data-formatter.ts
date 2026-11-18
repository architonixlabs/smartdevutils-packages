// Mirrors the website's TrainingDataFormatterComponent.convert() and validateRows().
import { formatTrainingData } from '../../aiml-tools'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/training-data-formatter'

/** The website's row check: '' when the data is a non-empty array of {input, output} strings. */
export function validateTrainingRows(data: unknown): string {
  if (!Array.isArray(data)) return 'Input must be a JSON array of {input, output} objects.'
  if (data.length === 0) return 'The array is empty — add at least one {input, output} object.'
  for (const [i, row] of data.entries()) {
    if (row === null || typeof row !== 'object' || Array.isArray(row))
      return `Row ${i + 1}: expected an object with "input" and "output".`
    const r = row as Record<string, unknown>
    if (typeof r['input'] !== 'string' || !r['input'].trim()) return `Row ${i + 1}: "input" must be a non-empty string.`
    if (typeof r['output'] !== 'string' || !r['output'].trim()) return `Row ${i + 1}: "output" must be a non-empty string.`
  }
  return ''
}

export const runner = defineRunner(spec, (input, { options }) => {
  if (!input.trim()) return { output: '' }
  const format = opt.oneOf(options.format, ['openai', 'anthropic'] as const, 'openai')
  let data: unknown
  try {
    data = JSON.parse(input)
  } catch (e) {
    return { output: '', error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}` }
  }
  const problem = validateTrainingRows(data)
  if (problem) return { output: '', error: problem }
  const rows = data as { input: string; output: string }[]
  return { output: formatTrainingData(rows, format), meta: { format, rows: rows.length } }
})

export default runner
