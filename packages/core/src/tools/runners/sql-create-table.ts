// Mirrors the website's SqlCreateTableComponent.generate() and its validate().
import { generateCreateTable, type ColumnDef } from '../../database'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/sql-create-table'

type Dialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql'

/** The website's validation: blank or invalid names and types are errors, not invalid SQL. */
export function validateTable(tableName: string, columns: ColumnDef[]): string {
  const ident = /^[A-Za-z_][A-Za-z0-9_$]*$/
  if (!ident.test(tableName.trim()))
    return 'Table name must start with a letter or _ and contain only letters, digits, _ or $.'
  if (columns.length === 0) return 'Add at least one column.'
  const seen = new Set<string>()
  for (const [i, c] of columns.entries()) {
    const name = c.name.trim()
    if (!name) return `Column ${i + 1}: name is required.`
    if (!ident.test(name)) return `Column "${name}": use letters, digits, _ or $ (and don't start with a digit).`
    if (!c.type.trim()) return `Column "${name}": type is required.`
    if (seen.has(name.toLowerCase())) return `Column "${name}" is defined twice.`
    seen.add(name.toLowerCase())
  }
  return ''
}

function toColumns(v: unknown): ColumnDef[] | null {
  if (!Array.isArray(v)) return null
  const cols: ColumnDef[] = []
  for (const c of v) {
    if (!c || typeof c !== 'object') return null
    const r = c as Record<string, unknown>
    cols.push({
      name: opt.str(r.name),
      type: opt.str(r.type),
      nullable: opt.bool(r.nullable, true),
      primaryKey: opt.bool(r.primaryKey, false),
      defaultValue: opt.str(r.defaultValue),
      ...(r.autoIncrement === false ? { autoIncrement: false } : {}),
    })
  }
  return cols
}

const INPUT_ERROR = 'Input must be JSON: an array of columns, or { "tableName": "...", "columns": [...] }.'

export const runner = defineRunner(spec, (input, { options }) => {
  const dialect = opt.oneOf<Dialect>(options.dialect, ['postgres', 'mysql', 'sqlite', 'mssql'], 'postgres')
  let tableName = opt.str(options.tableName, 'my_table')
  let columns = toColumns(options.columns)
  if (!columns) return { output: '', error: 'The columns option must be an array of { name, type } objects.' }

  if (input.trim()) {
    let data: unknown
    try {
      data = JSON.parse(input)
    } catch {
      return { output: '', error: INPUT_ERROR }
    }
    const isObj = !!data && typeof data === 'object' && !Array.isArray(data)
    const rawCols = Array.isArray(data) ? data : isObj ? (data as Record<string, unknown>).columns : undefined
    const parsed = toColumns(rawCols)
    if (!parsed) return { output: '', error: INPUT_ERROR }
    columns = parsed
    const t = isObj ? (data as Record<string, unknown>).tableName : undefined
    if (typeof t === 'string') tableName = t
  }

  const error = validateTable(tableName, columns)
  if (error) return { output: '', error }
  const output = generateCreateTable(
    { tableName: tableName.trim(), columns: columns.map((c) => ({ ...c, name: c.name.trim(), type: c.type.trim() })) },
    dialect,
  )
  return { output }
})

export default runner
