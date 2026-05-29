const PERM_CHARS = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx']

export function chmodToString(octal: string): string {
  return octal.split('').map(d => PERM_CHARS[parseInt(d, 8)]).join('')
}

export function stringToChmod(symbolic: string): string {
  const triples = [symbolic.slice(0, 3), symbolic.slice(3, 6), symbolic.slice(6, 9)]
  return triples.map(t => {
    let val = 0
    if (t[0] === 'r') val += 4
    if (t[1] === 'w') val += 2
    if (t[2] === 'x') val += 1
    return val.toString()
  }).join('')
}

export function umaskToPermissions(umask: string): string {
  const base = 0o777
  const mask = parseInt(umask, 8)
  return (base & ~mask & 0o777).toString(8)
}

export function convertBase(value: string, from: number, to: number): string {
  return parseInt(value, from).toString(to)
}

export function formatBytes(bytes: number, decimals = 0): string {
  if (bytes === 0) return '0 Bytes'
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${parseFloat(val.toFixed(decimals))} ${units[i]}`
}

export function parseSemver(version: string): { major: number; minor: number; patch: number; prerelease?: string } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!match) throw new Error(`Invalid semver: ${version}`)
  const result: { major: number; minor: number; patch: number; prerelease?: string } = {
    major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]),
  }
  if (match[4]) result.prerelease = match[4]
  return result
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a), pb = parseSemver(b)
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (pa[key] < pb[key]) return -1
    if (pa[key] > pb[key]) return 1
  }
  return 0
}

export function bitwiseOps(a: number, b: number): { and: number; or: number; xor: number; not_a: number; shiftLeft: number; shiftRight: number } {
  return { and: a & b, or: a | b, xor: a ^ b, not_a: ~a, shiftLeft: a << 1, shiftRight: a >> 1 }
}

export function ieee754Inspect(n: number): { sign: number; exponent: number; mantissa: string; hex: string; binary: string } {
  const buf = new ArrayBuffer(4)
  new DataView(buf).setFloat32(0, n)
  const bits = new Uint8Array(buf)
  const hex = Array.from(bits).map(b => b.toString(16).padStart(2, '0')).join('')
  const bin = Array.from(bits).map(b => b.toString(2).padStart(8, '0')).join('')
  const sign = parseInt(bin[0])
  const exponent = parseInt(bin.slice(1, 9), 2) - 127
  const mantissa = bin.slice(9)
  return { sign, exponent, mantissa, hex, binary: bin }
}

export function convertEndianness(hex: string): string {
  const bytes = hex.match(/.{2}/g) ?? []
  return bytes.reverse().join('')
}
