// Mirrors the website's DdlDiffComponent.compare(). The website shows three tables and a Mermaid
// diagram, not an output panel, so `output` is the tables as plain text plus the change summary
// sentence shown above the diagram. The diagram source is in `meta.diagram`.
import { diffDdlStatements, type DdlDiff } from '../../database'
import { buildDdlChangeDiagram, type ChangeScope, type DdlChangeSummary } from '../../diagrams/ddl-change-diagram'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/ddl-diff'

export function formatDdlDiff(diff: DdlDiff): string {
  const parts: string[] = []
  if (diff.added.length) {
    parts.push(`Added Columns (${diff.added.length})\n` + diff.added.map((c) => `+ ${c.name}  ${c.type}`).join('\n'))
  }
  if (diff.removed.length) {
    parts.push(`Removed Columns (${diff.removed.length})\n` + diff.removed.map((c) => `- ${c.name}  ${c.type}`).join('\n'))
  }
  if (diff.changed.length) {
    parts.push(
      `Changed Columns (${diff.changed.length})\n` + diff.changed.map((c) => `${c.name}: ${c.before} -> ${c.after}`).join('\n'),
    )
  }
  return parts.length ? parts.join('\n\n') : 'No differences found between the two DDL statements.'
}

/** The sentence the website shows above the diagram ("1 changed table, 1 column added."). */
export function changeSummaryText(s: DdlChangeSummary): string {
  const part = (n: number, one: string, many = one + 's') => (n ? `${n} ${n === 1 ? one : many}` : '')
  return (
    [
      part(s.tablesAdded, 'new table'),
      part(s.tablesRemoved, 'dropped table'),
      part(s.tablesChanged, 'changed table'),
      part(s.columnsAdded, 'column added', 'columns added'),
      part(s.columnsRemoved, 'column removed', 'columns removed'),
      part(s.typesChanged, 'type change'),
      part(s.relationshipsAdded, 'relationship added', 'relationships added'),
      part(s.relationshipsRemoved, 'relationship removed', 'relationships removed'),
    ]
      .filter(Boolean)
      .join(', ') + '.'
  )
}

export const runner = defineRunner(spec, (input, { options }) => {
  const after = opt.str(options.after)
  if (!input.trim() && !after.trim()) return { output: '' }
  const scope = opt.oneOf<ChangeScope>(options.scope, ['changed', 'all'], 'changed')
  const diff = diffDdlStatements(input, after)
  const change = buildDdlChangeDiagram(input, after, scope)
  const summary = change.source ? changeSummaryText(change.summary) : ''
  const output = formatDdlDiff(diff) + (summary ? `\n\nSchema change: ${summary}` : '')
  return {
    output,
    meta: {
      diff,
      diagram: change.source,
      changeSummary: summary,
      summary: change.summary,
      renameHints: change.renameHints,
      capped: change.capped,
    },
  }
})

export default runner
