/* ---
title: Convert a colour between hex, RGB, HSL and Lab
entry: color/hexToRgb, color/rgbToHsl, color/hslToRgb, color/rgbToHex
node: true
--- */
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToLab } from '@smartdevutils/core/color'

const { r, g, b } = hexToRgb('#1d4ed8')
console.log('rgb', r, g, b)

const hsl = rgbToHsl(r, g, b)
console.log('hsl', hsl)
console.log('lab', rgbToLab(r, g, b))

// A lighter tint: same hue and saturation, more lightness.
const tint = hslToRgb(hsl.h, hsl.s, Math.min(95, hsl.l + 30))
console.log('tint', rgbToHex(tint.r, tint.g, tint.b))
