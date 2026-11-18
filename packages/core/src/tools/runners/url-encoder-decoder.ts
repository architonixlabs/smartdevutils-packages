// Mirrors the website's UrlEncoderDecoderComponent.process() and EncodingService URL methods.
import { urlDecode as coreUrlDecode, urlEncode as coreUrlEncode } from '../../encoding'
import { defineRunner, opt } from '../define'
import { spec } from '../specs/url-encoder-decoder'

type EncodeMode = 'full' | 'component' | 'query'

export function urlEncodeAs(text: string, mode: EncodeMode): string {
  if (mode === 'full') return encodeURI(text)
  if (mode === 'query') return text.replace(/[^&=A-Za-z0-9\-_.!~*'()]/g, (ch) => encodeURIComponent(ch))
  return coreUrlEncode(text)
}

/** The query parameters of a URL or a bare query string ('+' is a space), as the website lists them. */
export function parseQueryParams(url: string): { key: string; value: string }[] {
  try {
    const questionMark = url.indexOf('?')
    if (questionMark < 0 && url.includes('://')) return []
    let queryString = questionMark >= 0 ? url.slice(questionMark + 1) : url
    const hashIdx = queryString.indexOf('#')
    if (hashIdx >= 0) queryString = queryString.slice(0, hashIdx)
    if (!queryString.trim()) return []
    const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, ' '))
    return queryString
      .split('&')
      .filter((p) => p)
      .map((pair) => {
        const eqIdx = pair.indexOf('=')
        if (eqIdx === -1) return { key: decode(pair), value: '' }
        return { key: decode(pair.slice(0, eqIdx)), value: decode(pair.slice(eqIdx + 1)) }
      })
  } catch {
    return []
  }
}

export const runner = defineRunner(spec, (input, { mode, options }) => {
  if (!input.trim()) return { output: '' }
  const encodeMode = opt.oneOf<EncodeMode>(options.encodeMode, ['full', 'component', 'query'], 'component')

  if (opt.bool(options.batchMode)) {
    const lines = input.split('\n')
    const output = lines
      .map((l) => {
        try {
          return mode === 'encode' ? urlEncodeAs(l, encodeMode) : coreUrlDecode(l)
        } catch {
          return l
        }
      })
      .join('\n')
    return { output }
  }

  if (mode === 'encode') {
    try {
      return { output: urlEncodeAs(input, encodeMode), meta: { queryParams: parseQueryParams(input) } }
    } catch (e) {
      return { output: '', error: 'URL encode failed: ' + (e instanceof Error ? e.message : String(e)) }
    }
  }
  try {
    return { output: coreUrlDecode(input) }
  } catch (e) {
    return { output: '', error: e instanceof Error ? e.message : 'Invalid URL encoded string' }
  }
})

export default runner
