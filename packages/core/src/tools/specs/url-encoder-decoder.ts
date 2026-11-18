import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'url-encoder-decoder',
  slug: 'url-encoder-decoder',
  name: 'URL Encoder Decoder',
  category: 'encoder-decoder',
  toolType: 'bidirectional',
  modes: [
    { id: 'encode', label: 'Encode', inputLabel: 'String', outputLabel: 'Encoded URL' },
    { id: 'decode', label: 'Decode', inputLabel: 'Encoded URL', outputLabel: 'String' },
  ],
  defaultMode: 'encode',
  input: { kind: 'text' },
  options: [
    {
      key: 'encodeMode',
      label: 'Encoding',
      type: 'select',
      default: 'component',
      modes: ['encode'],
      choices: [
        { value: 'component', label: 'Component (encodeURIComponent)' },
        { value: 'full', label: 'Full URI (encodeURI)' },
        { value: 'query', label: 'Query string (keeps & and =)' },
      ],
    },
    { key: 'batchMode', label: 'Batch mode (one URL per line)', type: 'boolean', default: false },
  ],
  output: 'text',
}
