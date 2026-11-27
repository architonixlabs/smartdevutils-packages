/* ---
title: Check a palette against WCAG contrast
entry: color/contrastRatio, color/wcagLevel
node: true
--- */
import { contrastRatio, wcagLevel } from '@smartdevutils/core/color'

const background = '#ffffff'
const palette = { accent: '#1d4ed8', muted: '#545d6b', warning: '#f59e0b', success: '#067647' }

for (const [name, color] of Object.entries(palette)) {
  const ratio = contrastRatio(color, background)
  console.log(`${name.padEnd(8)} ${color} on ${background}: ${ratio.toFixed(2)}:1 ${wcagLevel(ratio)}`)
}
