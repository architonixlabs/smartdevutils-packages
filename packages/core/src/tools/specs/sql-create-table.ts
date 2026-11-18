import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'sql-create-table',
  slug: 'sql-create-table',
  name: 'SQL CREATE TABLE Generator',
  category: 'database-tools',
  toolType: 'generator',
  modes: [],
  input: {
    kind: 'json',
    label: 'Optional JSON: an array of columns, or { "tableName", "columns" }. Empty uses the options.',
  },
  options: [
    {
      key: 'dialect',
      label: 'Dialect',
      type: 'select',
      default: 'postgres',
      choices: [
        { value: 'postgres', label: 'PostgreSQL' },
        { value: 'mysql', label: 'MySQL' },
        { value: 'sqlite', label: 'SQLite' },
        { value: 'mssql', label: 'SQL Server' },
      ],
    },
    { key: 'tableName', label: 'Table', type: 'text', default: 'my_table' },
    {
      key: 'columns',
      label: 'Columns',
      type: 'json',
      default: [{ name: '', type: 'VARCHAR(255)', nullable: true, primaryKey: false, defaultValue: '' }],
      description: 'Array of { name, type, nullable, primaryKey, defaultValue }. Used when the input is empty.',
    },
  ],
  output: 'text',
}
