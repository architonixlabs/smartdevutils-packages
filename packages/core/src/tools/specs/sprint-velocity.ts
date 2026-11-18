import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'sprint-velocity',
  slug: 'sprint-velocity',
  name: 'Sprint Velocity Calculator',
  category: 'planning-tools',
  toolType: 'analyzer',
  modes: [],
  input: {
    kind: 'text',
    label: 'Story points per sprint, oldest first (up to 12; one per line, comma- or space-separated, or a JSON array)',
  },
  options: [],
  output: 'report',
}
