// Mirrors the website's HashGeneratorComponent.process() (the single-hash panel, which feeds the output
// panel) and HashService.generate / hmacHash.
import CryptoJS from 'crypto-js'
import { md5 as coreMd5, sha256 as coreSha256 } from '../../hashing'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/hash-generator'

const HMAC = {
  'hmac-sha256': CryptoJS.HmacSHA256,
  'hmac-sha384': CryptoJS.HmacSHA384,
  'hmac-sha512': CryptoJS.HmacSHA512,
} as const

function hash(text: string, algorithm: string): string {
  switch (algorithm) {
    case 'md5':
      return coreMd5(text)
    case 'sha1':
      return CryptoJS.SHA1(text).toString()
    case 'sha256':
      return coreSha256(text)
    case 'sha384':
      return CryptoJS.SHA384(text).toString()
    case 'sha512':
      return CryptoJS.SHA512(text).toString()
    default:
      throw new Error('Unsupported algorithm')
  }
}

export const runner = defineRunner(spec, (input, { mode, options }) => {
  // Whitespace is significant input for a hash; only an empty value means "nothing to hash".
  if (input === '') return { output: '' }
  const upper = opt.bool(options.uppercase)
  const fmt = (h: string) => (upper ? h.toUpperCase() : h.toLowerCase())

  if (mode in HMAC) {
    const secret = opt.str(options.secretKey)
    if (!secret.trim()) return { output: '', error: 'Secret key is required for HMAC.' }
    try {
      return { output: fmt(HMAC[mode as keyof typeof HMAC](input, secret).toString(CryptoJS.enc.Hex)) }
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : String(e) }
    }
  }
  try {
    return { output: fmt(hash(input, mode)) }
  } catch (e) {
    return { output: '', error: `Hashing failed: ${e instanceof Error ? e.message : String(e)}` }
  }
})

export default runner
