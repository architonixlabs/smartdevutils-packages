import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'slow-query-detector',
  slug: 'slow-query-detector',
  name: 'Slow Query Pattern Detector',
  category: 'database-tools',
  toolType: 'analyzer',
  modes: [],
  input: { kind: 'sql', label: 'SQL Query' },
  options: [],
  output: 'report',
}
