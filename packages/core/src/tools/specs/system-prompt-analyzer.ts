import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'system-prompt-analyzer',
  slug: 'system-prompt-analyzer',
  name: 'System Prompt Analyzer',
  category: 'ai-ml-tools',
  toolType: 'analyzer',
  modes: [],
  input: { kind: 'text', label: 'System Prompt' },
  options: [],
  output: 'report',
}
