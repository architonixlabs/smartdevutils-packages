import { describe, expect, it } from 'vitest'
import { runner } from './hash-generator'

const run = (input: string, mode?: string, options?: Record<string, unknown>) =>
  runner.run(input, { mode, options }) as { output: string; error?: string }

describe('hash-generator runner', () => {
  it('hashes with MD5 by default (website example "Hello World")', () => {
    expect(run('Hello World').output).toBe('b10a8db164e0754105b7a99be72e3fe5')
  })

  it('supports SHA-1, SHA-256, SHA-384 and SHA-512', () => {
    expect(run('Hello World', 'sha1').output).toBe('0a4d55a8d778e5022fab701977c5d840bbc486d0')
    expect(run('Hello World', 'sha256').output).toBe(
      'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    )
    expect(run('Hello World', 'sha384').output).toHaveLength(96)
    expect(run('Hello World', 'sha512').output).toHaveLength(128)
  })

  it('uppercases when asked', () => {
    expect(run('Hello World', 'md5', { uppercase: true }).output).toBe('B10A8DB164E0754105B7A99BE72E3FE5')
  })

  it('computes HMAC with the secret key', () => {
    expect(run('hello', 'hmac-sha256', { secretKey: 'secret' }).output).toBe(
      '88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b',
    )
    expect(run('hello', 'hmac-sha512', { secretKey: 'secret' }).output).toHaveLength(128)
  })

  it('requires a secret key for HMAC', () => {
    expect(run('hello', 'hmac-sha384')).toEqual({ output: '', error: 'Secret key is required for HMAC.' })
  })

  it('treats whitespace as input but empty as nothing to hash', () => {
    expect(run('')).toEqual({ output: '' })
    expect(run(' ').output).toBe('7215ee9c7d9dc229d2921a40e899ec5f')
  })
})
