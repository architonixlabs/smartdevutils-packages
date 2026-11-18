// Expands a package.json "exports" map, including "./x/*" patterns, into concrete entries.
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'

export function expandExports(pkgDir, exportsMap) {
  const out = []
  for (const [sub, target] of Object.entries(exportsMap ?? {})) {
    if (typeof target !== 'object') continue
    if (!sub.includes('*')) {
      out.push([sub, target])
      continue
    }
    const pattern = target.import
    const dir = join(pkgDir, dirname(pattern))
    const suffix = basename(pattern).replace('*', '')
    if (!existsSync(dir)) {
      out.push([sub, target])
      continue
    }
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(suffix)) continue
      const name = f.slice(0, -suffix.length)
      const fill = (v) => (typeof v === 'string' ? v.replace('*', name) : v)
      out.push([sub.replace('*', name), Object.fromEntries(Object.entries(target).map(([k, v]) => [k, fill(v)]))])
    }
  }
  return out
}
