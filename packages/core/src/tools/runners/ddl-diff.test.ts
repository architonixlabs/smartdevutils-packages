import { describe, it, expect } from 'vitest'
import { diffDdlStatements } from '../../database'
import { buildDdlChangeDiagram } from '../../diagrams/ddl-change-diagram'
import { formatDdlDiff, runner } from './ddl-diff'

// The website's "Add Column" example.
const BEFORE = 'CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name VARCHAR(100)\n);'
const AFTER = 'CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name VARCHAR(255),\n  email TEXT\n);'

describe('ddl-diff runner', () => {
  it('takes "before" as input and "after" as an option', () => {
    const r = runner.run(BEFORE, { options: { after: AFTER } }) as { output: string; meta?: Record<string, unknown> }
    const diff = diffDdlStatements(BEFORE, AFTER)
    expect(r.meta?.diff).toEqual(diff)
    expect(r.output.startsWith(formatDdlDiff(diff))).toBe(true)
    expect(r.output).toContain('Added Columns (1)\n+ email  TEXT')
    expect(r.output).toContain('Changed Columns (1)\nname: VARCHAR(100) -> VARCHAR(255)')
    expect(r.output).toMatch(/Schema change: .*1 column added.*\.$/)
    expect(r.meta?.diagram).toBe(buildDdlChangeDiagram(BEFORE, AFTER, 'changed').source)
  })

  it('passes the scope option to the diagram', () => {
    const r = runner.run(BEFORE, { options: { after: AFTER, scope: 'all' } }) as { meta?: Record<string, unknown> }
    expect(r.meta?.diagram).toBe(buildDdlChangeDiagram(BEFORE, AFTER, 'all').source)
  })

  it('lists removed columns', () => {
    const r = runner.run(AFTER, { options: { after: BEFORE } }) as { output: string }
    expect(r.output).toContain('Removed Columns (1)\n- email  TEXT')
  })

  it('says when there is no difference, with no summary line', () => {
    const r = runner.run(BEFORE, { options: { after: BEFORE } }) as { output: string }
    expect(r.output).toBe('No differences found between the two DDL statements.')
  })

  it('returns empty output when both sides are empty', () => {
    expect(runner.run('')).toEqual({ output: '' })
  })
})
