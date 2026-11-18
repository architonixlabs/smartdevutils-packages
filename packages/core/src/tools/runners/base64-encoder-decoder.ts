// Mirrors the website's Base64EncoderDecoderComponent.process() and EncodingService Base64 methods.
import { base64Decode as coreBase64Decode, base64Encode as coreBase64Encode } from '../../encoding'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/base64-encoder-decoder'

type Variant = 'standard' | 'urlsafe' | 'urlsafe-nopad'

export function base64UrlEncode(text: string, stripPadding = false): string {
  const bytes = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, p1: string) =>
    String.fromCharCode(parseInt(p1, 16)),
  )
  let urlSafe = btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_')
  if (stripPadding) urlSafe = urlSafe.replace(/=+$/, '')
  return urlSafe
}

export function base64UrlDecode(text: string): string {
  const standard = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  const decoded = atob(padded)
  return decodeURIComponent(
    Array.prototype.map
      .call(decoded, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  )
}

export function wrapBase64(b64: string, width = 76): string {
  if (width <= 0) return b64
  const chunks: string[] = []
  for (let i = 0; i < b64.length; i += width) chunks.push(b64.slice(i, i + width))
  return chunks.join('\n')
}

function findInvalidBase64Char(text: string): number {
  const clean = text.replace(/\s/g, '')
  for (let i = 0; i < clean.length; i++) {
    if (!/[A-Za-z0-9+/=]/.test(clean[i])) return i
  }
  return -1
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const runner = defineRunner(spec, (input, { mode, options }) => {
  if (!input.trim()) return { output: '' }
  const variant = opt.oneOf<Variant>(options.variant, ['standard', 'urlsafe', 'urlsafe-nopad'], 'standard')

  if (mode === 'encode') {
    let encoded: string
    if (variant === 'standard') {
      try {
        encoded = coreBase64Encode(input)
      } catch {
        return { output: '', error: 'Failed to Base64 encode' }
      }
    } else {
      try {
        encoded = base64UrlEncode(input, variant === 'urlsafe-nopad')
      } catch (e) {
        return { output: '', error: 'Failed to Base64 URL-safe encode: ' + message(e) }
      }
    }
    return { output: opt.bool(options.wrapOutput) ? wrapBase64(encoded) : encoded }
  }

  if (variant === 'standard') {
    try {
      return { output: coreBase64Decode(input) }
    } catch {
      const invalidPos = findInvalidBase64Char(input)
      const clean = input.replace(/\s/g, '')
      const posMsg = invalidPos >= 0 ? ` (invalid character at position ${invalidPos}: '${clean[invalidPos]}')` : ''
      return { output: '', error: 'Invalid Base64 encoded string' + posMsg }
    }
  }
  try {
    return { output: base64UrlDecode(input) }
  } catch (e) {
    return { output: '', error: 'Failed to Base64 URL-safe decode: ' + message(e) }
  }
})

export default runner
