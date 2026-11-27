// Share links: the code travels in the URL hash (`#code=…`, lz-string), never through a server.
// Decoded data is untrusted: every field is checked before the UI uses it, and it is never run
// automatically.
import * as lzNs from 'lz-string'
import type { SnippetLang } from '../core/model'

export interface SharePayload {
  pkg: string
  section: string
  entry: string
  snippetId: string
  lang: SnippetLang
  code: string
}

/** Longest source a link may carry (characters). */
export const MAX_SHARE_CODE = 50_000
/** Longest encoded hash value accepted or produced. Longer links break in chat apps and some browsers. */
export const MAX_SHARE_ENCODED = 32_000

export const SHARE_PREFIX = 'code='

// lz-string is a UMD/CommonJS module: Node exposes it as `default`, bundlers also as named exports.
const LZString: typeof lzNs = (lzNs as unknown as { default?: typeof lzNs }).default ?? lzNs

const LANGS: readonly SnippetLang[] = ['ts', 'js', 'tsx', 'html']
const ID_RE = /^[A-Za-z0-9._~-]{1,128}$/

export type EncodeResult = { ok: true; hash: string; length: number } | { ok: false; error: string }
export type DecodeResult = { ok: true; payload: SharePayload } | { ok: false; error: string }

/** Returns the hash value (`code=…`, without `#`). */
export function encodeShare(p: SharePayload): EncodeResult {
  if (p.code.length > MAX_SHARE_CODE) {
    return {
      ok: false,
      error: `The code is too long to share in a link (${p.code.length.toLocaleString('en')} characters, limit ${MAX_SHARE_CODE.toLocaleString('en')}). Use Download or Open in StackBlitz instead.`,
    }
  }
  const body = { v: 1, p: p.pkg, s: p.section, e: p.entry, i: p.snippetId, l: p.lang, c: p.code }
  const enc = LZString.compressToEncodedURIComponent(JSON.stringify(body))
  if (enc.length > MAX_SHARE_ENCODED) {
    return {
      ok: false,
      error: `The shared link would be too long (${enc.length.toLocaleString('en')} characters). Use Download or Open in StackBlitz instead.`,
    }
  }
  return { ok: true, hash: SHARE_PREFIX + enc, length: enc.length }
}

/** True when a URL fragment looks like a share link (with or without the leading `#`). */
export function isShareHash(fragment: string | null | undefined): boolean {
  return !!fragment && fragment.replace(/^#/, '').startsWith(SHARE_PREFIX)
}

export function decodeShare(fragment: string): DecodeResult {
  const raw = fragment.replace(/^#/, '')
  if (!raw.startsWith(SHARE_PREFIX)) return { ok: false, error: 'Not a shared-code link.' }
  const enc = raw.slice(SHARE_PREFIX.length)
  if (!enc) return { ok: false, error: 'The shared link is empty.' }
  if (enc.length > MAX_SHARE_ENCODED) return { ok: false, error: 'The shared link is too long.' }
  if (!/^[A-Za-z0-9+\-$]*$/.test(enc)) return { ok: false, error: 'The shared link is damaged.' }
  let json: string | null
  try {
    json = LZString.decompressFromEncodedURIComponent(enc)
  } catch {
    json = null
  }
  // A 32k-char link cannot legitimately expand past this; guard against decompression bombs anyway.
  if (!json || json.length > MAX_SHARE_CODE * 2 + 2_000) {
    return { ok: false, error: 'The shared link is damaged or incomplete.' }
  }
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, error: 'The shared link is damaged or incomplete.' }
  }
  const payload = validate(data)
  return payload ? { ok: true, payload } : { ok: false, error: 'The shared link has an unexpected format.' }
}

function validate(data: unknown): SharePayload | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const d = data as Record<string, unknown>
  if (d['v'] !== 1) return null
  const ids = [d['p'], d['s'], d['e'], d['i']]
  if (!ids.every((v) => typeof v === 'string' && ID_RE.test(v))) return null
  if (typeof d['l'] !== 'string' || !LANGS.includes(d['l'] as SnippetLang)) return null
  if (typeof d['c'] !== 'string' || d['c'].length > MAX_SHARE_CODE) return null
  return {
    pkg: d['p'] as string,
    section: d['s'] as string,
    entry: d['e'] as string,
    snippetId: d['i'] as string,
    lang: d['l'] as SnippetLang,
    code: d['c'],
  }
}
