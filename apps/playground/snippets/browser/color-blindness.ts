/* ---
title: Simulate colour blindness on a canvas
entry: color-blindness/simulateDeuteranopia, color-blindness/simulateProtanopia, color-blindness/simulateTritanopia
output: preview
--- */
import { simulateProtanopia, simulateDeuteranopia, simulateTritanopia } from '@smartdevutils/browser/color-blindness'

const colors = ['#d32f2f', '#388e3c', '#1976d2', '#fbc02d', '#7b1fa2']

function swatches(label: string, filter?: (d: ImageData) => ImageData) {
  const canvas = document.createElement('canvas')
  canvas.width = 50 * colors.length
  canvas.height = 40
  const ctx = canvas.getContext('2d')!
  colors.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.fillRect(i * 50, 0, 50, 40)
  })
  if (filter) ctx.putImageData(filter(ctx.getImageData(0, 0, canvas.width, canvas.height)), 0, 0)
  const row = document.createElement('p')
  row.textContent = label + ' '
  row.append(canvas)
  document.body.append(row)
}

swatches('Original')
swatches('Protanopia', simulateProtanopia)
swatches('Deuteranopia', simulateDeuteranopia)
swatches('Tritanopia', simulateTritanopia)
