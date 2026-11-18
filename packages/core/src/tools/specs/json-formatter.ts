import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'json-formatter',
  slug: 'json-formatter-validator-minifier-beautifier',
  name: 'JSON Formatter Validator Minifier Beautifier',
  category: 'formatter-minifier',
  toolType: 'bidirectional',
  modes: [
    { id: 'format', label: 'Format/Beautify', inputLabel: 'JSON', outputLabel: 'Formatted JSON' },
    { id: 'minify', label: 'Minify', inputLabel: 'JSON', outputLabel: 'Minified JSON' },
    { id: 'validate', label: 'Validate', inputLabel: 'JSON', outputLabel: 'Validation Result' },
  ],
  defaultMode: 'format',
  input: { kind: 'json' },
  options: [],
  output: 'text',
}
