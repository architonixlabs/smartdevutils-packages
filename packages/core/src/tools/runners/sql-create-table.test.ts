import { describe, it, expect } from 'vitest'
import { generateCreateTable } from '../../database'
import { runner } from './sql-create-table'

const cols = [
  { name: 'id', type: 'INT', nullable: false, primaryKey: true, defaultValue: '' },
  { name: 'email', type: 'VARCHAR(255)', nullable: false, primaryKey: false, defaultValue: '' },
]

describe('sql-create-table runner', () => {
  it('has no modes and generates from options', () => {
    expect(runner.spec.modes).toEqual([])
    const r = runner.run('', { options: { tableName: 'users', columns: cols } }) as { output: string }
    expect(r.output).toBe(generateCreateTable({ tableName: 'users', columns: cols }, 'postgres'))
    expect(r.output).toContain('CREATE TABLE')
  })

  it('reports the website validation error for the default blank column', () => {
    const r = runner.run('') as { output: string; error?: string }
    expect(r.output).toBe('')
    expect(r.error).toBe('Column 1: name is required.')
  })

  it('accepts JSON input with tableName and columns, and the dialect option', () => {
    const input = JSON.stringify({ tableName: 'accounts', columns: cols })
    const r = runner.run(input, { options: { dialect: 'mysql' } }) as { output: string }
    expect(r.output).toBe(generateCreateTable({ tableName: 'accounts', columns: cols }, 'mysql'))
  })

  it('accepts a bare column array as input', () => {
    const r = runner.run(JSON.stringify(cols), { options: { dialect: 'sqlite' } }) as { output: string }
    expect(r.output).toBe(generateCreateTable({ tableName: 'my_table', columns: cols }, 'sqlite'))
  })

  it('trims names and types like the website', () => {
    const r = runner.run('', { options: { tableName: ' t ', columns: [{ name: ' a ', type: ' TEXT ' }] } }) as {
      output: string
    }
    expect(r.output).toBe(
      generateCreateTable({ tableName: 't', columns: [{ name: 'a', type: 'TEXT', nullable: true, primaryKey: false, defaultValue: '' }] }, 'postgres'),
    )
  })

  it('rejects bad identifiers, duplicates and non-JSON input', () => {
    expect((runner.run('', { options: { tableName: '1bad', columns: cols } }) as { error?: string }).error).toMatch(/^Table name must start/)
    const dup = [cols[0], { ...cols[1], name: 'ID' }]
    expect((runner.run('', { options: { columns: dup } }) as { error?: string }).error).toBe('Column "ID" is defined twice.')
    expect((runner.run('not json') as { error?: string }).error).toMatch(/^Input must be JSON/)
  })
})
