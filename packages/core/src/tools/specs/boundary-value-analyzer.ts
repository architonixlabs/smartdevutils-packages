import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'boundary-value-analyzer',
  slug: 'boundary-value-analyzer',
  name: 'Boundary Value Analyzer',
  category: 'developer-tools',
  toolType: 'analyzer',
  modes: [],
  // The website has form fields only. The settings live in options; a non-empty input may be a
  // JSON object { "fieldName"?, "type"?, "min"?, "max"? } that overrides them.
  input: { kind: 'none', label: 'Optional JSON { "fieldName", "type", "min", "max" }' },
  options: [
    { key: 'fieldName', label: 'Field Name', type: 'text', default: 'age' },
    {
      key: 'fieldType',
      label: 'Type',
      type: 'select',
      default: 'integer',
      choices: [
        { value: 'integer', label: 'Integer' },
        { value: 'decimal', label: 'Decimal' },
      ],
    },
    { key: 'min', label: 'Minimum', type: 'number', default: 0 },
    { key: 'max', label: 'Maximum', type: 'number', default: 120 },
  ],
  output: 'report',
}
