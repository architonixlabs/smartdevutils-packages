/* ---
title: Turn an SVG into a PNG
entry: mermaid/svgToPng, mermaid/svgSize
description: The SVG needs an xmlns and a size (viewBox or width and height) to load as an image.
output: preview
--- */
import { svgToPng, svgSize } from '@smartdevutils/browser/mermaid'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120">
  <rect width="240" height="120" rx="12" fill="#1d4ed8"/>
  <text x="120" y="68" font-family="sans-serif" font-size="22" fill="#ffffff" text-anchor="middle">SmartDevUtils</text>
</svg>`

console.log('size:', svgSize(svg))
const png = await svgToPng(svg, { scale: 2 })
console.log(`PNG: ${png.type}, ${png.size} bytes`)

const img = document.createElement('img')
img.src = URL.createObjectURL(png)
img.alt = 'The SVG drawn as a PNG'
img.width = 240
document.body.append(img)
