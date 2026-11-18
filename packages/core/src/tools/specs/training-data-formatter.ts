import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'training-data-formatter',
  slug: 'training-data-formatter',
  name: 'Training Data Formatter',
  category: 'ai-ml-tools',
  toolType: 'bidirectional',
  modes: [],
  input: { kind: 'json', label: 'JSON array of {input, output} objects' },
  options: [
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      default: 'openai',
      choices: [
        { value: 'openai', label: 'OpenAI (JSONL)' },
        { value: 'anthropic', label: 'Anthropic (JSONL)' },
      ],
    },
  ],
  output: 'text',
}
