import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'migration-generator',
  slug: 'migration-generator',
  name: 'Migration Script Generator',
  category: 'database-tools',
  toolType: 'generator',
  modes: [],
  input: { kind: 'sql', label: 'Before DDL' },
  options: [
    {
      key: 'after',
      label: 'After DDL',
      type: 'textarea',
      default: '',
      description: 'The second input: the CREATE TABLE statements after the change. The main input is the "before" DDL.',
    },
    {
      key: 'dialect',
      label: 'Dialect',
      type: 'select',
      default: 'postgres',
      choices: [
        { value: 'postgres', label: 'PostgreSQL' },
        { value: 'mysql', label: 'MySQL' },
      ],
    },
    {
      key: 'part',
      label: 'Output',
      type: 'select',
      default: 'up',
      choices: [
        { value: 'up', label: 'UP migration' },
        { value: 'down', label: 'DOWN migration' },
        { value: 'both', label: 'UP and DOWN' },
      ],
      description: 'Runner-only: the website shows UP and DOWN side by side. Both are always in meta.',
    },
  ],
  output: 'text',
}
