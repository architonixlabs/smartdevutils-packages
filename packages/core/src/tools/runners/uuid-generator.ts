// Mirrors the website's UuidGeneratorComponent.process() and GeneratorService UUID methods.
// v4 is what core's generateUuid() returns; importing it from uuid directly keeps the EFF word list (in ../../generation) out of this chunk.
import { v1 as uuidv1, v4 as coreGenerateUuid, v5 as uuidv5, v7 as uuidv7 } from 'uuid'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/uuid-generator'

type Version = 'v4' | 'v1' | 'v7' | 'v5'
type Format = 'newline' | 'json-array' | 'csv' | 'sql-insert'

export function formatUuids(uuids: string[], format: Format): string {
  switch (format) {
    case 'json-array':
      return JSON.stringify(uuids, null, 2)
    case 'csv':
      return uuids.join(',')
    case 'sql-insert':
      return uuids.map((u) => `INSERT INTO uuids (id) VALUES ('${u}');`).join('\n')
    default:
      return uuids.join('\n')
  }
}

/** The count as the website reads it: options.count, else a number given as input, else 5; clamped to 1..1000. */
function resolveCount(countOption: unknown, input: string): number {
  const fromOption = opt.num(countOption, NaN)
  const fromInput = input.trim() === '' ? NaN : Number(input)
  const raw = Number.isFinite(fromOption) ? fromOption : Number.isFinite(fromInput) && fromInput >= 1 ? fromInput : 5
  return Math.max(1, Math.min(1000, Math.floor(raw)))
}

export const runner = defineRunner(spec, (input, { options }) => {
  const version = opt.oneOf<Version>(options.version, ['v4', 'v1', 'v7', 'v5'], 'v4')
  const format = opt.oneOf<Format>(options.outputFormat, ['newline', 'json-array', 'csv', 'sql-insert'], 'newline')
  const count = resolveCount(options.count, input)
  let uuids: string[]
  try {
    if (version === 'v5') {
      const ns = opt.str(options.namespace).trim()
      const name = opt.str(options.v5name).trim()
      if (!ns || !name) return { output: '', error: 'Namespace UUID and Name are required for v5.' }
      uuids = [uuidv5(name, ns)]
    } else {
      const gen: () => string = version === 'v1' ? uuidv1 : version === 'v7' ? uuidv7 : coreGenerateUuid
      uuids = Array.from({ length: count }, () => gen())
    }
  } catch (e) {
    return { output: '', error: e instanceof Error ? e.message : 'Generation failed' }
  }
  return { output: formatUuids(uuids, format), meta: { uuids, version } }
})

export default runner
