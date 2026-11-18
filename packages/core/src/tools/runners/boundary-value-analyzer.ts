// Mirrors the website's BoundaryValueAnalyzerComponent and its analyzeBoundaries() wrapper.
// The website has form fields only (field name, type, min, max), so they are options here with the
// website defaults (age, integer, 0, 120). A non-empty input may be a JSON object
// { "fieldName"?, "type"?, "min"?, "max"? } that overrides them.
// The website shows a table, not an output panel, so `output` is the table as tab-separated text.
import { computeBoundaryValues, type BoundaryCase } from '../../planning'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/boundary-value-analyzer'

type FieldType = 'integer' | 'decimal'

/**
 * Boundary cases for a numeric range: validates the range, keeps the decimal midpoint, rounds
 * decimals to 2 places and drops repeated values. Returns an error message for a bad range.
 */
export function analyzeBoundaries(type: FieldType, min: number | null, max: number | null): BoundaryCase[] | string {
  if (min === null || max === null || !Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) {
    return 'Enter both a minimum and a maximum.'
  }
  const lo = Number(min)
  const hi = Number(max)
  if (lo > hi) return `Minimum (${lo}) is greater than maximum (${hi}).`
  if (type === 'integer' && (!Number.isInteger(lo) || !Number.isInteger(hi))) {
    return 'Integer fields need whole-number limits. Switch the type to Decimal for fractional limits.'
  }
  const round = (v: number) => (type === 'integer' ? v : Math.round(v * 100) / 100)
  const mid = type === 'integer' ? Math.floor((lo + hi) / 2) : (lo + hi) / 2
  const seen = new Set<number>()
  return computeBoundaryValues({ type, min: lo, max: hi })
    .map((c) => ({ ...c, value: round(c.type === 'nominal' ? mid : Number(c.value)) }))
    .filter((c) => !seen.has(c.value) && seen.add(c.value) !== undefined)
}

const toNumberOrNull = (v: unknown): number | null =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ? null : Number(v)

export const runner = defineRunner(spec, (input, { options }) => {
  const fields: Record<string, unknown> = {
    fieldName: options.fieldName,
    type: options.fieldType,
    min: options.min,
    max: options.max,
  }
  if (input.trim()) {
    let data: unknown
    try {
      data = JSON.parse(input)
    } catch (e) {
      return { output: '', error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}` }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { output: '', error: 'Input must be a JSON object { "fieldName", "type", "min", "max" }.' }
    }
    const o = data as Record<string, unknown>
    for (const k of ['fieldName', 'type', 'min', 'max']) if (o[k] !== undefined) fields[k] = o[k]
    if (o['fieldType'] !== undefined && o['type'] === undefined) fields['type'] = o['fieldType']
  }
  const fieldName = opt.str(fields['fieldName'], 'age')
  const type = opt.oneOf<FieldType>(fields['type'], ['integer', 'decimal'], 'integer')
  const result = analyzeBoundaries(type, toNumberOrNull(fields['min']), toNumberOrNull(fields['max']))
  if (typeof result === 'string') return { output: '', error: result }
  const output = [
    ['Label', `Value for "${fieldName}"`, 'Type'].join('\t'),
    ...result.map((c) => [c.label, String(c.value), c.type].join('\t')),
  ].join('\n')
  return { output, meta: { fieldName, type, cases: result } }
})

export default runner
