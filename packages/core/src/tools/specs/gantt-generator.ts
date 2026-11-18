import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'gantt-generator',
  slug: 'gantt-generator',
  name: 'Gantt Chart Generator',
  category: 'planning-tools',
  toolType: 'generator',
  modes: [],
  input: {
    kind: 'json',
    label: 'JSON array of tasks: [{ "title", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "section"? }]',
  },
  options: [],
  output: 'text',
}
