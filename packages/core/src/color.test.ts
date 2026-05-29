import { describe, it, expect } from 'vitest'
import {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb,
  hexToHsl, rgbToLab, contrastRatio, wcagLevel,
} from './color'

describe('hexToRgb', () => {
  it('converts #ff0000 to red', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
  })
  it('handles shorthand #fff', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  })
  it('throws on invalid hex', () => {
    expect(() => hexToRgb('not-a-hex')).toThrow()
  })
})

describe('rgbToHex', () => {
  it('converts 255,0,0 to #ff0000', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
  })
  it('zero-pads single-digit hex values', () => {
    expect(rgbToHex(0, 0, 8)).toBe('#000008')
  })
})

describe('rgbToHsl', () => {
  it('converts red to h=0 s=100 l=50', () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 })
  })
  it('converts white to h=0 s=0 l=100', () => {
    expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 100 })
  })
})

describe('hslToRgb', () => {
  it('converts h=0 s=100 l=50 to red', () => {
    expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 })
  })
  it('converts h=0 s=0 l=100 to white', () => {
    expect(hslToRgb(0, 0, 100)).toEqual({ r: 255, g: 255, b: 255 })
  })
})

describe('hexToHsl', () => {
  it('converts #ff0000 to red hsl', () => {
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 })
  })
})

describe('rgbToLab', () => {
  it('converts white to Lab ~100,0,0', () => {
    const { l } = rgbToLab(255, 255, 255)
    expect(l).toBeCloseTo(100, 0)
  })
  it('converts black to Lab ~0,0,0', () => {
    const { l } = rgbToLab(0, 0, 0)
    expect(l).toBeCloseTo(0, 0)
  })
})

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })
  it('returns 1 for same color', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 1)
  })
})

describe('wcagLevel', () => {
  it('AAA for ratio >= 7', () => { expect(wcagLevel(7)).toBe('AAA') })
  it('AA for ratio >= 4.5', () => { expect(wcagLevel(4.5)).toBe('AA') })
  it('A for ratio >= 3', () => { expect(wcagLevel(3)).toBe('A') })
  it('Fail below 3', () => { expect(wcagLevel(2.9)).toBe('Fail') })
})
