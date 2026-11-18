// Shared rollup "external" list for every package build.
// Everything in dependencies, peerDependencies and optionalDependencies stays an import in
// our dist (never inlined), including subpaths such as '@smartdevutils/core/hashing' or
// 'react/jsx-runtime'.
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// `inline` lists module ids that are bundled on purpose (for example a JSON data file from a
// devDependency that Node cannot import without an import attribute).
export function externalsFor(pkgJsonPath, { inline = [] } = {}) {
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  const names = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]
  const ids = [
    /^@smartdevutils\//,
    /^node:/,
    ...builtinModules.map((m) => new RegExp(`^${escape(m)}$`)),
    ...names.map((n) => new RegExp(`^${escape(n)}(?:/.*)?$`)),
  ]
  return (id) => !inline.includes(id) && ids.some((re) => re.test(id))
}
