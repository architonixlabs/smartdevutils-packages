// Mirrors the website's JsonFormatterComponent.process() and JsonUtilityService format/minify/validate.
import { jsonFormat as coreJsonFormat, jsonMinify as coreJsonMinify } from '../../formatting'
import { defineRunner } from '../define'
import { spec } from '../specs/json-formatter'

/** Strip a leading UTF-8 byte-order mark (common in files saved by Windows editors). */
const stripBom = (s: string): string => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s)
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const runner = defineRunner(spec, (input, { mode }) => {
  if (!input.trim()) return { output: '' }
  const json = stripBom(input)
  try {
    if (mode === 'format') return { output: coreJsonFormat(json, 2) }
    if (mode === 'minify') return { output: coreJsonMinify(json) }
    JSON.parse(json)
    return { output: 'Valid JSON', meta: { valid: true } }
  } catch (e) {
    // The website shows the error and clears the output panel, in every mode.
    return {
      output: '',
      error: 'Invalid JSON: ' + message(e),
      ...(mode === 'validate' ? { meta: { valid: false } } : {}),
    }
  }
})

export default runner
