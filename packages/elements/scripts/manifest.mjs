#!/usr/bin/env node
// Writes custom-elements.json (for editors and Storybook) with the analyzer and our config.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const bin = join(dirname(require.resolve('@custom-elements-manifest/analyzer/package.json')), 'cem.js')
execFileSync(process.execPath, [bin, 'analyze', '--config', 'custom-elements-manifest.config.mjs', '--quiet'], { cwd: root, stdio: 'inherit' })
const m = JSON.parse(readFileSync(join(root, 'custom-elements.json'), 'utf8'))
const tags = m.modules.flatMap((mod) => (mod.declarations ?? []).filter((d) => d.tagName).map((d) => d.tagName))
const want = ['sdu-tool', 'sdu-diagram', 'sdu-recipe', 'sdu-recipe-run', 'sdu-json-formatter']
const missing = want.filter((t) => !tags.includes(t))
if (missing.length) {
  console.error(`custom-elements.json is missing: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`custom-elements.json: ${tags.length} elements (${tags.join(', ')})`)
