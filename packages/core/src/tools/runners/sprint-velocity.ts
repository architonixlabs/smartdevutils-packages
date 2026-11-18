// Mirrors the website's SprintVelocityComponent.calculate(). The website has 12 number boxes;
// headless input is the same numbers as text (newline, comma, semicolon or space separated) or a
// JSON array. As on the website, blanks and non-numbers are skipped and at most 12 sprints count.
// The website shows result cards, not an output panel, so `output` is the same values as text.
import { computeVelocityStats } from '../../planning'
import { defineRunner } from '../define'
import { spec } from '../specs/sprint-velocity'

export const MAX_SPRINTS = 12

export function parseSprintPoints(input: string): number[] {
  let tokens: string[]
  const t = input.trim()
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t) as unknown
      tokens = Array.isArray(arr) ? arr.map((v) => (v === null || v === undefined ? '' : String(v))) : []
    } catch {
      tokens = t.split(/[\s,;]+/)
    }
  } else {
    tokens = t.split(/[\s,;]+/)
  }
  return tokens
    .slice(0, MAX_SPRINTS)
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => Number.parseFloat(s))
    .filter((n) => Number.isFinite(n))
}

export const runner = defineRunner(spec, (input) => {
  if (!input.trim()) return { output: '' }
  const points = parseSprintPoints(input)
  if (points.length === 0) return { output: '', error: 'Enter story points for at least one sprint.' }
  const stats = computeVelocityStats(points)
  const output = [
    `Average Velocity: ${stats.average} story points / sprint`,
    `Trend: ${stats.trend}`,
    `Min: ${stats.min} · Max: ${stats.max}`,
    `Predicted Next Sprint: ${stats.predicted} story points`,
  ].join('\n')
  return { output, meta: { ...stats, points } }
})

export default runner
