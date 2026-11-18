// Mirrors the website's PerformanceSlaCheckerComponent.check() and parseResponseTimes().
// The website shows a table, not an output panel, so `output` is the table and its summary line
// as text; `meta` holds the core result.
import { computePercentiles } from '../../planning'
import { defineRunner } from '../define'
import { spec } from '../specs/performance-sla-checker'

/** Split on newlines, commas, semicolons or spaces; an optional "ms" suffix is accepted. */
export function parseResponseTimes(input: string): { times: number[]; ignored: string[] } {
  const times: number[] = []
  const ignored: string[] = []
  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    const m = /^(\d+(?:\.\d+)?|\.\d+)(?:ms)?$/i.exec(token)
    if (m) times.push(Number(m[1]))
    else ignored.push(token)
  }
  return { times, ignored }
}

const target = (v: unknown): number | null =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ? null : Number(v)

export const runner = defineRunner(spec, (input, { options }) => {
  if (!input.trim()) return { output: '' }
  const p50Target = target(options.p50Target)
  const p95Target = target(options.p95Target)
  const p99Target = target(options.p99Target)
  const { times, ignored } = parseResponseTimes(input)
  if (times.length === 0) {
    return { output: '', error: 'No valid numbers found. Enter response times in milliseconds, one per line.' }
  }
  const targets = [p50Target, p95Target, p99Target]
  if (targets.some((t) => t === null || !Number.isFinite(t) || t < 0)) {
    return { output: '', error: 'Enter a non-negative target for P50, P95 and P99.' }
  }
  const notice = ignored.length
    ? `Ignored ${ignored.length} value(s) that are not non-negative numbers: ${ignored.slice(0, 5).join(', ')}${ignored.length > 5 ? ', …' : ''}`
    : ''
  const result = computePercentiles(times, { p50: p50Target!, p95: p95Target!, p99: p99Target! })
  const rows = [
    { key: 'p50', label: 'P50', target: p50Target },
    { key: 'p95', label: 'P95', target: p95Target },
    { key: 'p99', label: 'P99', target: p99Target },
  ]
  const lines = [
    ['Percentile', 'Target (ms)', 'Actual (ms)', 'Status'].join('\t'),
    ...rows.map((r) =>
      [r.label, String(r.target), String(result.actual[r.key]), result.withinSla[r.key] ? 'PASS' : 'FAIL'].join('\t'),
    ),
    '',
    result.breachedCount > 0
      ? `${result.breachedCount} request(s) exceeded the P99 target of ${p99Target}ms.`
      : 'All requests within SLA targets.',
  ]
  if (notice) lines.unshift(notice, '')
  return { output: lines.join('\n'), meta: { ...result, times: times.length, ignored, ...(notice ? { notice } : {}) } }
})

export default runner
