import { describe, expect, it } from 'vitest'
import * as lzNs from 'lz-string'
import { MAX_SHARE_CODE, decodeShare, encodeShare, isShareHash, type SharePayload } from './share-link'

const LZ: typeof lzNs = (lzNs as unknown as { default?: typeof lzNs }).default ?? lzNs

const sample: SharePayload = {
  pkg: 'core',
  section: 'hashing',
  entry: 'sha256',
  snippetId: 'basic',
  lang: 'ts',
  code: "import { sha256 } from '@smartdevutils/core/hashing'\nconsole.log(sha256('héllo ✓'))\n",
}

const encodeRaw = (o: unknown) => 'code=' + LZ.compressToEncodedURIComponent(JSON.stringify(o))

describe('share links', () => {
  it('round-trips a payload', () => {
    const enc = encodeShare(sample)
    expect(enc.ok).toBe(true)
    if (!enc.ok) return
    expect(enc.hash.startsWith('code=')).toBe(true)
    expect(isShareHash('#' + enc.hash)).toBe(true)
    expect(decodeShare('#' + enc.hash)).toEqual({ ok: true, payload: sample })
    expect(decodeShare(enc.hash)).toEqual({ ok: true, payload: sample })
  })

  it('refuses code over the size limit', () => {
    expect(encodeShare({ ...sample, code: 'x'.repeat(MAX_SHARE_CODE + 1) }).ok).toBe(false)
  })

  it('refuses links whose encoded form is too long', () => {
    // pseudo-random text compresses badly
    let s = ''
    let seed = 7
    while (s.length < MAX_SHARE_CODE - 10) {
      seed = (seed * 48271) % 2147483647
      s += String.fromCharCode(33 + (seed % 90))
    }
    expect(encodeShare({ ...sample, code: s }).ok).toBe(false)
  })

  it('rejects non-share and damaged fragments', () => {
    expect(isShareHash('#top')).toBe(false)
    expect(isShareHash(null)).toBe(false)
    expect(decodeShare('#top').ok).toBe(false)
    expect(decodeShare('code=').ok).toBe(false)
    expect(decodeShare('code=<script>').ok).toBe(false)
    expect(decodeShare('code=AAAAAAAA').ok).toBe(false)
    expect(decodeShare('code=' + 'A'.repeat(40_000)).ok).toBe(false)
  })

  it('validates decoded fields', () => {
    const good = { v: 1, p: 'core', s: 'hashing', e: 'sha256', i: 'basic', l: 'ts', c: 'x' }
    expect(decodeShare(encodeRaw(good)).ok).toBe(true)
    expect(decodeShare(encodeRaw({ ...good, v: 2 })).ok).toBe(false)
    expect(decodeShare(encodeRaw({ ...good, l: 'python' })).ok).toBe(false)
    expect(decodeShare(encodeRaw({ ...good, p: '../etc' })).ok).toBe(false)
    expect(decodeShare(encodeRaw({ ...good, e: 'a b' })).ok).toBe(false)
    expect(decodeShare(encodeRaw({ ...good, c: 42 })).ok).toBe(false)
    expect(decodeShare(encodeRaw([good])).ok).toBe(false)
    expect(decodeShare(encodeRaw('just a string')).ok).toBe(false)
    expect(decodeShare('code=' + LZ.compressToEncodedURIComponent('{not json')).ok).toBe(false)
  })
})
