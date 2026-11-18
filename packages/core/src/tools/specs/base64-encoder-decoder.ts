import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'base64-encoder-decoder',
  slug: 'base64-encoder-decoder',
  name: 'Base64 Encoder Decoder',
  category: 'encoder-decoder',
  toolType: 'bidirectional',
  modes: [
    { id: 'encode', label: 'Encode', inputLabel: 'Text', outputLabel: 'Base64' },
    { id: 'decode', label: 'Decode', inputLabel: 'Base64', outputLabel: 'Text' },
  ],
  defaultMode: 'encode',
  input: { kind: 'text' },
  options: [
    {
      key: 'variant',
      label: 'Variant',
      type: 'select',
      default: 'standard',
      choices: [
        { value: 'standard', label: 'Standard' },
        { value: 'urlsafe', label: 'URL-safe (with padding)' },
        { value: 'urlsafe-nopad', label: 'URL-safe (no padding)' },
      ],
    },
    { key: 'wrapOutput', label: 'Wrap output at 76 characters', type: 'boolean', default: false, modes: ['encode'] },
  ],
  output: 'text',
}
