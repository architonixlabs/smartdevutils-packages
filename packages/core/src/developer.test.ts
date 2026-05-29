import { describe, it, expect } from 'vitest'
import {
  chmodToString, stringToChmod, umaskToPermissions,
  convertBase, formatBytes, parseSemver, compareSemver,
  bitwiseOps, ieee754Inspect, convertEndianness,
} from './developer'

describe('chmodToString', () => {
  it('755 → rwxr-xr-x', () => { expect(chmodToString('755')).toBe('rwxr-xr-x') })
  it('644 → rw-r--r--', () => { expect(chmodToString('644')).toBe('rw-r--r--') })
  it('000 → ---------', () => { expect(chmodToString('000')).toBe('---------') })
})

describe('stringToChmod', () => {
  it('rwxr-xr-x → 755', () => { expect(stringToChmod('rwxr-xr-x')).toBe('755') })
  it('rw-r--r-- → 644', () => { expect(stringToChmod('rw-r--r--')).toBe('644') })
})

describe('umaskToPermissions', () => {
  it('022 → 755 for files', () => { expect(umaskToPermissions('022')).toBe('755') })
})

describe('convertBase', () => {
  it('decimal 255 to hex ff', () => { expect(convertBase('255', 10, 16)).toBe('ff') })
  it('binary 1010 to decimal 10', () => { expect(convertBase('1010', 2, 10)).toBe('10') })
  it('hex ff to binary', () => { expect(convertBase('ff', 16, 2)).toBe('11111111') })
})

describe('formatBytes', () => {
  it('1024 → 1 KB', () => { expect(formatBytes(1024)).toBe('1 KB') })
  it('1048576 → 1 MB', () => { expect(formatBytes(1048576)).toBe('1 MB') })
  it('0 → 0 Bytes', () => { expect(formatBytes(0)).toBe('0 Bytes') })
})

describe('parseSemver', () => {
  it('parses 1.2.3', () => { expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 }) })
  it('parses 2.0.0-alpha.1', () => {
    expect(parseSemver('2.0.0-alpha.1')).toMatchObject({ major: 2, prerelease: 'alpha.1' })
  })
  it('throws on invalid', () => { expect(() => parseSemver('not-semver')).toThrow() })
})

describe('compareSemver', () => {
  it('1.0.0 < 2.0.0', () => { expect(compareSemver('1.0.0', '2.0.0')).toBe(-1) })
  it('2.0.0 > 1.9.9', () => { expect(compareSemver('2.0.0', '1.9.9')).toBe(1) })
  it('1.0.0 == 1.0.0', () => { expect(compareSemver('1.0.0', '1.0.0')).toBe(0) })
})

describe('bitwiseOps', () => {
  it('AND 5 & 3 = 1', () => { expect(bitwiseOps(5, 3).and).toBe(1) })
  it('OR 5 | 3 = 7', () => { expect(bitwiseOps(5, 3).or).toBe(7) })
  it('XOR 5 ^ 3 = 6', () => { expect(bitwiseOps(5, 3).xor).toBe(6) })
})

describe('ieee754Inspect', () => {
  it('returns sign, exponent, mantissa, hex, binary for 1.0', () => {
    const r = ieee754Inspect(1.0)
    expect(r.sign).toBe(0)
    expect(r.hex).toBe('3f800000')
  })
})

describe('convertEndianness', () => {
  it('reverses byte pairs of deadbeef', () => {
    expect(convertEndianness('deadbeef')).toBe('efbeadde')
  })
})
