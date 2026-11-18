// Mirrors the website's LogParserComponent (parse(), enrich() and the level filter).
// The website shows a table, not an output panel, so `output` is the same table as tab-separated text.
import { parseLogLines, type LogEntry } from '../../devops-tools'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/log-parser'

const LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'] as const

/**
 * Fills the gaps the core parser leaves (it reads level/timestamp from JSON lines only):
 * level keywords in the message, Apache/Nginx access-log fields, and a leading ISO timestamp.
 */
export function enrichLogEntry(e: LogEntry): LogEntry {
  if (e.level && e.timestamp) return e
  const out = { ...e }
  const access = /^(\S+) \S+ (\S+) \[([^\]]+)\] "([^"]*)" (\d{3}) (\S+)/.exec(e.raw)
  if (access) {
    const status = Number(access[5])
    out.timestamp ||= access[3]
    out.source ||= access[1]
    out.message = `${access[4]} → ${access[5]}`
    out.level ||= status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO'
    return out
  }
  if (!out.level) {
    const m = /\b(FATAL|CRITICAL|ERROR|ERR|WARNING|WARN|INFO|DEBUG|TRACE)\b/i.exec(e.message || e.raw)
    if (m) {
      const lvl = m[1].toUpperCase()
      out.level =
        lvl === 'ERR' || lvl === 'FATAL' || lvl === 'CRITICAL' ? 'ERROR' : lvl === 'WARNING' ? 'WARN' : lvl
    }
  }
  if (!out.timestamp) {
    const ts = /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?/.exec(e.raw)
    if (ts) out.timestamp = ts[1]
  }
  return out
}

export function filterByLevel(entries: LogEntry[], levelFilter: string): LogEntry[] {
  if (levelFilter === 'ALL') return entries
  return entries.filter((e) => e.level === levelFilter || (levelFilter === 'WARN' && e.level === 'WARNING'))
}

export const runner = defineRunner(spec, (input, { options }) => {
  const entries = parseLogLines(input.replace(/\r\n?/g, '\n')).map(enrichLogEntry)
  if (entries.length === 0) return { output: '' }
  const levelFilter = opt.oneOf(options.levelFilter, LEVELS, 'ALL')
  const shown = filterByLevel(entries, levelFilter)
  const rows = shown.map((e) => [e.timestamp || '—', e.level, e.source || '—', e.message].join('\t'))
  const output = [
    ['Timestamp', 'Level', 'Source', 'Message'].join('\t'),
    ...rows,
    '',
    `Showing ${shown.length} of ${entries.length} entries`,
  ].join('\n')
  return { output, meta: { entries: shown, total: entries.length, levelFilter } }
})

export default runner
