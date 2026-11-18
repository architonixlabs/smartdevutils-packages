// Mirrors the website's GanttGeneratorComponent.generate() and prepare().
// The website builds tasks from form rows; headless input is the same rows as JSON:
//   [{ "title": "Design", "start": "2024-01-01", "end": "2024-01-07", "section": "Phase 1" }]
// An object { "milestones": [...] } is accepted too.
import { generateGanttMermaid, type GanttMilestone } from '../../planning'
import { defineRunner } from '../define'
import { spec } from '../specs/gantt-generator'

/** The website's row check and Mermaid-safe cleaning (':', '#', ';' break the Mermaid parser). */
export function prepareGanttRows(rows: GanttMilestone[]): { milestones: GanttMilestone[]; error: string } {
  const clean = (t: string) => t.replace(/[:#;]/g, ' ').replace(/\s+/g, ' ').trim()
  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') && !Number.isNaN(Date.parse(d))
  const filled = rows.filter((r) => (r.title ?? '').trim() || r.start || r.end)
  if (filled.length === 0) return { milestones: [], error: 'Add at least one task with a name, start and end date.' }
  for (const [i, r] of filled.entries()) {
    const label = (r.title ?? '').trim() || `Row ${i + 1}`
    if (!clean(r.title ?? '')) return { milestones: [], error: `${label}: task name is required.` }
    if (!isDate(r.start) || !isDate(r.end)) return { milestones: [], error: `${label}: start and end dates are required.` }
    if (r.end < r.start) return { milestones: [], error: `${label}: end date is before start date.` }
  }
  return {
    milestones: filled.map((r) => ({
      title: clean(r.title),
      start: r.start,
      end: r.end,
      section: clean(r.section ?? '') || undefined,
    })),
    error: '',
  }
}

function toRows(data: unknown): GanttMilestone[] | null {
  const list =
    Array.isArray(data) ? data
    : data && typeof data === 'object' && Array.isArray((data as { milestones?: unknown }).milestones)
      ? (data as { milestones: unknown[] }).milestones
      : null
  if (!list) return null
  const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))
  return list.map((r) => {
    const o = r && typeof r === 'object' ? (r as Record<string, unknown>) : {}
    return { title: str(o['title']), start: str(o['start']), end: str(o['end']), section: str(o['section']) }
  })
}

export const runner = defineRunner(spec, (input) => {
  if (!input.trim()) return { output: '' }
  let data: unknown
  try {
    data = JSON.parse(input)
  } catch (e) {
    return { output: '', error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}` }
  }
  const rows = toRows(data)
  if (!rows) return { output: '', error: 'Input must be a JSON array of { title, start, end, section } tasks.' }
  const { milestones, error } = prepareGanttRows(rows)
  if (error) return { output: '', error }
  return { output: generateGanttMermaid(milestones), meta: { milestones } }
})

export default runner
