#!/usr/bin/env node
// Loads every "exports" entry of the Node-safe packages through both import() and require(),
// so a broken external (for example an ESM-only dependency under CommonJS) fails CI.
// browser, react, elements and angular need a DOM or a framework, so they are only checked for files on disk.
// "import" and "types" are required for every subpath; "require" is checked when a package ships CommonJS
// (elements and angular are ES modules only).
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expandExports } from './exports.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOAD = new Set(['@smartdevutils/core', '@smartdevutils/recipes', '@smartdevutils/theme'])
let failed = 0

for (const dir of readdirSync(join(root, 'packages'))) {
  const pkgDir = join(root, 'packages', dir)
  if (!existsSync(join(pkgDir, 'package.json'))) continue
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const require = createRequire(join(pkgDir, 'package.json'))
  // A package with a CommonJS main must ship "require" for every subpath.
  const cjs = typeof pkg.main === 'string' && pkg.main.endsWith('.cjs')
  for (const [sub, t] of expandExports(pkgDir, pkg.exports)) {
    if (typeof t !== 'object') continue
    const conds = ['import', 'types', ...(cjs || t.require ? ['require'] : [])]
    for (const cond of conds) {
      if (!t[cond] || !existsSync(join(pkgDir, t[cond]))) {
        console.error(`MISSING ${pkg.name} ${sub} ${cond}: ${t[cond]}`)
        failed++
      }
    }
    if (!LOAD.has(pkg.name)) continue
    try {
      await import(pathToFileURL(join(pkgDir, t.import)).href)
      if (t.require) require(join(pkgDir, t.require))
    } catch (err) {
      console.error(`LOAD FAILED ${pkg.name} ${sub}: ${err.message}`)
      failed++
    }
  }
}

if (failed) {
  console.error(`${failed} problem(s)`)
  process.exit(1)
}
console.log('dist check ok')
