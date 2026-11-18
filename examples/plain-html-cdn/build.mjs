// Copies the page, the elements CDN build and Mermaid's ES module build into dist/, so the example
// runs from any static file server without a CDN. On a real site you would point the script tag at
// https://cdn.jsdelivr.net/npm/@smartdevutils/elements@0/dist/cdn/sdu-elements.js instead.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, 'package.json'))
const out = join(here, 'dist')
const elements = dirname(require.resolve('@smartdevutils/elements/package.json'))
const mermaid = dirname(require.resolve('mermaid/package.json'))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(join(here, 'index.html'), join(out, 'index.html'))
cpSync(join(elements, 'dist', 'cdn'), join(out, 'sdu'), { recursive: true, filter: (f) => !f.endsWith('.map') })
mkdirSync(join(out, 'mermaid'), { recursive: true })
cpSync(join(mermaid, 'dist', 'mermaid.esm.min.mjs'), join(out, 'mermaid', 'mermaid.esm.min.mjs'))
cpSync(join(mermaid, 'dist', 'chunks', 'mermaid.esm.min'), join(out, 'mermaid', 'chunks', 'mermaid.esm.min'), {
  recursive: true,
  filter: (f) => !f.endsWith('.map'),
})
console.log('plain-html-cdn built: dist/index.html, dist/sdu/, dist/mermaid/')
