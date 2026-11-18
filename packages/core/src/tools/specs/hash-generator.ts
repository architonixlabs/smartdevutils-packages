import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'hash-generator',
  slug: 'hash-generator',
  name: 'Hash Generator',
  category: 'security-tools',
  toolType: 'generator',
  modes: [
    { id: 'md5', label: 'MD5', inputLabel: 'Text to Hash', outputLabel: 'MD5 Hash' },
    { id: 'sha1', label: 'SHA-1', inputLabel: 'Text to Hash', outputLabel: 'SHA-1 Hash' },
    { id: 'sha256', label: 'SHA-256', inputLabel: 'Text to Hash', outputLabel: 'SHA-256 Hash' },
    { id: 'sha384', label: 'SHA-384', inputLabel: 'Text to Hash', outputLabel: 'SHA-384 Hash' },
    { id: 'sha512', label: 'SHA-512', inputLabel: 'Text to Hash', outputLabel: 'SHA-512 Hash' },
    { id: 'hmac-sha256', label: 'HMAC-SHA256', inputLabel: 'Message', outputLabel: 'HMAC-SHA256 Hex' },
    { id: 'hmac-sha384', label: 'HMAC-SHA384', inputLabel: 'Message', outputLabel: 'HMAC-SHA384 Hex' },
    { id: 'hmac-sha512', label: 'HMAC-SHA512', inputLabel: 'Message', outputLabel: 'HMAC-SHA512 Hex' },
  ],
  defaultMode: 'md5',
  input: { kind: 'text' },
  options: [
    { key: 'uppercase', label: 'Uppercase hex', type: 'boolean', default: false },
    {
      key: 'secretKey',
      label: 'Secret key',
      type: 'text',
      default: '',
      modes: ['hmac-sha256', 'hmac-sha384', 'hmac-sha512'],
    },
  ],
  output: 'text',
}
