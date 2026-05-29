export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const expanded = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) throw new Error(`Invalid hex: ${hex}`)
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sn = s / 100, ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = ln - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60)        { r = c; g = x }
  else if (h < 120)  { r = x; g = c }
  else if (h < 180)  { g = c; b = x }
  else if (h < 240)  { g = x; b = c }
  else if (h < 300)  { r = x; b = c }
  else               { r = c; b = x }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHsl(r, g, b)
}

export function rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
  const toLinear = (v: number) => {
    const n = v / 255
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
  }
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b)
  const X = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047
  const Y = (lr * 0.2126 + lg * 0.7152 + lb * 0.0722) / 1.00000
  const Z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
  return {
    l: Math.round((116 * f(Y) - 16) * 100) / 100,
    a: Math.round((500 * (f(X) - f(Y))) * 100) / 100,
    b: Math.round((200 * (f(Y) - f(Z))) * 100) / 100,
  }
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const toLinear = (v: number) => {
    const n = v / 255
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1), l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2)
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100
}

export function wcagLevel(ratio: number): 'AAA' | 'AA' | 'A' | 'Fail' {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'A'
  return 'Fail'
}
