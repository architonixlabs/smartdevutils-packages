#!/usr/bin/env node
// Size check for every package's ESM entry points.
//
// For each subpath in a package's "exports", it measures the entry file plus every
// relative chunk it imports statically (recursively), raw and gzipped. Imports of other
// packages (dependencies and peers) are not counted, because they are not in our dist.
// Dynamic import() chunks are lazy and also not counted.
//
// Usage:
//   node scripts/size-check.mjs            check against size-budgets.json, exit 1 on overrun
//   node scripts/size-check.mjs --report   print sizes only, never fail
//   node scripts/size-check.mjs --json     print sizes as JSON
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { expandExports } from './exports.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const budgets = JSON.parse(readFileSync(join(root, 'size-budgets.json'), 'utf8'))

const STATIC_IMPORT = /(?:^|[\s;])(?:import|export)\s*(?:[^'"]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g

function closure(entry) {
  const seen = new Set()
  const stack = [entry]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(STATIC_IMPORT)) stack.push(resolve(dirname(file), m[1]))
  }
  return [...seen]
}

function measure(files) {
  const buf = Buffer.concat(files.map(f => readFileSync(f)))
  return { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length }
}

const kb = n => (n / 1024).toFixed(1) + ' kB'
const rows = []
for (const dir of readdirSync(join(root, 'packages'))) {
  const pkgDir = join(root, 'packages', dir)
  const pkgFile = join(pkgDir, 'package.json')
  if (!existsSync(pkgFile)) continue
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
  for (const [sub, target] of expandExports(pkgDir, pkg.exports)) {
    const rel = typeof target === 'string' ? target : target.import
    if (!rel || !/\.m?js$/.test(rel)) continue
    const entry = join(pkgDir, rel)
    if (!existsSync(entry)) {
      rows.push({ id: `${pkg.name}${sub === '.' ? '' : sub.slice(1)}`, missing: true })
      continue
    }
    const id = `${pkg.name}${sub === '.' ? '' : sub.slice(1)}`
    rows.push({ id, ...measure(closure(entry)) })
  }
}

if (args.has('--json')) {
  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

let failed = 0
const width = Math.max(...rows.map(r => r.id.length))
for (const r of rows) {
  if (r.missing) {
    console.log(`${r.id.padEnd(width)}  MISSING (run pnpm build first)`)
    failed++
    continue
  }
  const limit = budgets[r.id]
  const over = limit !== undefined && r.gzip > limit * 1024
  if (over) failed++
  const note = limit === undefined ? 'no budget' : `${over ? 'OVER' : 'ok'} (budget ${limit} kB gzip)`
  console.log(`${r.id.padEnd(width)}  ${kb(r.raw).padStart(10)} raw  ${kb(r.gzip).padStart(9)} gzip  ${note}`)
}

if (failed && !args.has('--report')) {
  console.error(`\n${failed} entry point(s) over budget or missing. Budgets live in size-budgets.json.`)
  process.exit(1)
}
