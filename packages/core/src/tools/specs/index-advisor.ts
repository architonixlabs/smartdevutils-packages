import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'index-advisor',
  slug: 'index-advisor',
  name: 'Index Advisor',
  category: 'database-tools',
  toolType: 'analyzer',
  modes: [],
  input: { kind: 'sql', label: 'SQL Query' },
  options: [],
  output: 'report',
}
