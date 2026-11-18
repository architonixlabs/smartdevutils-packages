import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'uuid-generator',
  slug: 'uuid-generator',
  name: 'UUID Generator',
  category: 'developer-tools',
  toolType: 'generator',
  modes: [
    { id: 'generate', label: 'Generate', inputLabel: 'Number of UUIDs to generate', outputLabel: 'Generated UUIDs' },
  ],
  defaultMode: 'generate',
  input: { kind: 'none', label: 'Optional: number of UUIDs (used when the count option is not set)' },
  options: [
    {
      key: 'version',
      label: 'Version',
      type: 'select',
      default: 'v4',
      choices: [
        { value: 'v4', label: 'v4 (random)' },
        { value: 'v1', label: 'v1 (time-based)' },
        { value: 'v7', label: 'v7 (time-ordered)' },
        { value: 'v5', label: 'v5 (name-based SHA-1)' },
      ],
    },
    {
      key: 'count',
      label: 'How many',
      type: 'number',
      min: 1,
      max: 1000,
      description: 'Default 5, or the number given as input. Ignored for v5, which gives one UUID.',
    },
    { key: 'namespace', label: 'Namespace UUID (v5)', type: 'text', default: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
    { key: 'v5name', label: 'Name (v5)', type: 'text', default: 'example.com' },
    {
      key: 'outputFormat',
      label: 'Output format',
      type: 'select',
      default: 'newline',
      choices: [
        { value: 'newline', label: 'One per line' },
        { value: 'json-array', label: 'JSON array' },
        { value: 'csv', label: 'CSV' },
        { value: 'sql-insert', label: 'SQL INSERT' },
      ],
    },
  ],
  output: 'text',
}
