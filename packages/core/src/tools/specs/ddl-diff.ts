import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'ddl-diff',
  slug: 'ddl-diff',
  name: 'DDL Diff Comparator',
  category: 'database-tools',
  toolType: 'compare',
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
      key: 'scope',
      label: 'Tables to show in the diagram',
      type: 'select',
      default: 'changed',
      choices: [
        { value: 'changed', label: 'Only changed tables' },
        { value: 'all', label: 'Whole schema' },
      ],
      description: 'Only affects meta.diagram (Mermaid erDiagram source).',
    },
  ],
  output: 'report',
}
