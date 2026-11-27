// "Integrate" tab content: install line, imports and per-framework usage, all copyable.
import type { ApiItem, PackageDoc, Snippet } from '../core/model'

export const ELEMENTS_CDN = (version: string) =>
  `https://cdn.jsdelivr.net/npm/@smartdevutils/elements@${version}/dist/cdn/sdu-elements.js`
export const THEME_CDN = (version: string) =>
  `https://cdn.jsdelivr.net/npm/@smartdevutils/theme@${version}/dist/styles.css`

export type IntegrateTarget = 'node' | 'html' | 'react' | 'angular'

export interface IntegrateBlock {
  id: string
  title: string
  lang: 'bash' | 'ts' | 'tsx' | 'html' | 'css'
  code: string
  note?: string
}

export interface IntegrateGuide {
  install: IntegrateBlock
  imports: IntegrateBlock
  /** Shown above the targets, e.g. "website only". */
  note?: string
  targets: Array<IntegrateBlock & { target: IntegrateTarget }>
}

/** How an item is consumed, which decides its import line and wiring. */
export type ItemUsage =
  | { kind: 'css' }
  | { kind: 'catalog-tool' }
  | { kind: 'tool' }
  | { kind: 'element'; tag: string }
  | { kind: 'react-component' }
  | { kind: 'angular-component' }
  | { kind: 'call'; callee: string; call: string }
  | { kind: 'type' }
  | { kind: 'value' }
  | { kind: 'side-effect' }

function isIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name)
}

function tagName(item: ApiItem): string {
  const m = /<?([a-z][a-z0-9]*-[a-z0-9-]+)/.exec(item.signature?.trim() || item.name)
  return m ? m[1] : item.name.replace(/[<>]/g, '')
}

export function itemUsage(pkg: PackageDoc, item: ApiItem): ItemUsage {
  if (item.module.endsWith('.css') || (pkg.id === 'theme' && item.name.startsWith('--'))) return { kind: 'css' }
  if (item.kind === 'tool') return item.module.endsWith('/tools/catalog') ? { kind: 'catalog-tool' } : { kind: 'tool' }
  if (item.kind === 'element') return { kind: 'element', tag: tagName(item) }
  if (item.kind === 'component' && isIdentifier(item.name)) {
    if (pkg.id === 'angular' || item.module.startsWith('@smartdevutils/angular')) return { kind: 'angular-component' }
    return { kind: 'react-component' }
  }
  if (item.kind === 'type' || item.kind === 'interface') {
    return isIdentifier(item.name) ? { kind: 'type' } : { kind: 'side-effect' }
  }
  if (isIdentifier(item.name)) return { kind: 'value' }
  // Data entries such as recipes: `getRecipe('id')`.
  const call = /^([A-Za-z_$][\w$]*)\(.*\)$/.exec(item.signature?.trim() ?? '')
  if (call) return { kind: 'call', callee: call[1], call: item.signature!.trim() }
  return { kind: 'side-effect' }
}

function toolId(item: ApiItem): string {
  const fromUrl = item.webUrl ? /\/tools\/([^/?#]+)/.exec(item.webUrl)?.[1] : undefined
  return fromUrl ?? item.id
}

export function importLines(pkg: PackageDoc, item: ApiItem): string[] {
  const u = itemUsage(pkg, item)
  const mod = item.module || pkg.name
  switch (u.kind) {
    case 'css':
      return [`import '@smartdevutils/theme/styles.css'`]
    case 'catalog-tool':
      return [`import { findToolById } from '${mod}'`]
    case 'tool':
      return [`import { runTool } from '${mod}'`]
    case 'element':
    case 'side-effect':
      return [`import '${mod}'`]
    case 'type':
      return [`import type { ${item.name} } from '${mod}'`]
    case 'call':
      return [`import { ${u.callee} } from '${mod}'`]
    default:
      return [`import { ${item.name} } from '${mod}'`]
  }
}

/** Plain-JS usage lines, after the imports. */
function usageBody(item: ApiItem, u: ItemUsage): string {
  switch (u.kind) {
    case 'tool':
      return `const res = await runTool('${toolId(item)}', 'your input')\nif (res.error) console.error(res.error)\nelse console.log(res.output)`
    case 'catalog-tool':
      return `const tool = findToolById('${toolId(item)}')\nconsole.log(tool?.name, tool?.modes)`
    case 'call':
      return `const value = ${u.call}\nconsole.log(value)`
    case 'value':
      if (item.kind === 'class') return `const instance = new ${item.name}(/* … */)`
      if (item.kind === 'function') {
        const args = (item.params ?? []).filter((p) => !p.optional && isIdentifier(p.name)).map((p) => p.name)
        return `const result = ${item.name}(${args.join(', ')})\nconsole.log(result)`
      }
      return `console.log(${item.name})`
    case 'type':
      return `let value: ${item.name}`
    default:
      return ''
  }
}

/** An expression for React/Angular examples. */
function inlineExpr(item: ApiItem, u: ItemUsage): string {
  switch (u.kind) {
    case 'tool':
      return `runTool('${toolId(item)}', 'your input')`
    case 'call':
      return u.call
    case 'value':
      if (item.kind === 'function') {
        const n = (item.params ?? []).filter((p) => !p.optional).length
        return `${item.name}(${Array.from({ length: n }, () => "''").join(', ')})`
      }
      if (item.kind === 'class') return `new ${item.name}()`
      return item.name
    default:
      return 'null'
  }
}

/** Snippets that are not Angular code, in the given languages. */
function firstSnippet(item: ApiItem, langs: Snippet['lang'][]): Snippet | undefined {
  return item.snippets.find((s) => langs.includes(s.lang) && !/@angular\/core/.test(s.code))
}

type Target = IntegrateGuide['targets'][number]

interface Ctx {
  pkg: PackageDoc
  item: ApiItem
  u: ItemUsage
  fw: Set<string>
  importText: string
  version: string
}

export function buildIntegrateGuide(pkg: PackageDoc, item: ApiItem, version: string): IntegrateGuide {
  const u = itemUsage(pkg, item)
  const importText = importLines(pkg, item).join('\n')
  const ctx: Ctx = { pkg, item, u, fw: new Set(pkg.frameworks), importText, version }
  const install: IntegrateBlock = {
    id: 'install',
    title: 'Install',
    lang: 'bash',
    code: pkg.install || `npm install ${pkg.name}`,
  }
  const imports: IntegrateBlock = { id: 'imports', title: 'Import', lang: 'ts', code: importText }
  if (u.kind === 'css') return { install, imports, targets: cssTargets(ctx) }
  const targets = [nodeTarget(ctx), htmlTarget(ctx), reactTarget(ctx), angularTarget(ctx)].filter(
    (t): t is Target => t !== null,
  )
  const note =
    u.kind === 'catalog-tool'
      ? 'Website only for now: this tool has no headless runner yet. Its catalog entry is available.'
      : undefined
  return { install, imports, note, targets }
}

function cssTargets({ item, fw, version }: Ctx): Target[] {
  const use = cssUse(item)
  const out: Target[] = [
    {
      target: 'html',
      id: 'html',
      title: 'Plain HTML',
      lang: 'html',
      code: `<link rel="stylesheet" href="${THEME_CDN(version)}" />\n\n<style>\n  .card { ${use} }\n</style>`,
    },
  ]
  if (fw.has('react')) {
    out.push({
      target: 'react',
      id: 'react',
      title: 'React',
      lang: 'css',
      code: `// main.tsx\nimport '@smartdevutils/theme/styles.css'\n\n/* your CSS */\n.card { ${use} }`,
    })
  }
  if (fw.has('angular')) {
    out.push({
      target: 'angular',
      id: 'angular',
      title: 'Angular',
      lang: 'css',
      code: `/* styles.css (or "styles" in angular.json) */\n@import '@smartdevutils/theme/styles.css';\n\n.card { ${use} }`,
    })
  }
  return out
}

const NODE_KINDS = new Set<ItemUsage['kind']>(['tool', 'catalog-tool', 'call', 'value', 'type'])

function nodeTarget({ item, u, fw, importText }: Ctx): Target | null {
  if (!(fw.has('node') || fw.has('browser')) || !NODE_KINDS.has(u.kind)) return null
  const snippet = firstSnippet(item, ['ts', 'js'])
  return {
    target: 'node',
    id: 'node',
    title: fw.has('node') ? 'Node.js / bundler' : 'Bundler (browser)',
    lang: 'ts',
    code: snippet?.code.trim() ?? `${importText}\n\n${usageBody(item, u)}`.trim(),
    note: fw.has('node') ? 'Node 20.19+ (ESM or require). Also works in browsers through a bundler.' : undefined,
  }
}

function htmlTarget({ pkg, item, u, fw, version }: Ctx): Target | null {
  if (u.kind === 'element') {
    const body = firstSnippet(item, ['html'])?.code.trim() ?? `<${u.tag}></${u.tag}>`
    return {
      target: 'html',
      id: 'html',
      title: 'Plain HTML (CDN)',
      lang: 'html',
      code: `<script type="module" src="${ELEMENTS_CDN(version)}"></script>\n\n${stripElementImports(body)}`,
      note: 'One script tag registers every <sdu-*> element. No build step.',
    }
  }
  if (!(fw.has('browser') || fw.has('html'))) return null
  let named: string
  if (u.kind === 'tool') named = 'runTool'
  else if (u.kind === 'call') named = u.callee
  else if (u.kind === 'value') named = item.name
  else return null
  const sub = item.module.replace(/^@smartdevutils\/[^/]+/, '')
  return {
    target: 'html',
    id: 'html',
    title: 'Plain HTML (ES module from a CDN)',
    lang: 'html',
    code: `<script type="module">\n  import { ${named} } from 'https://cdn.jsdelivr.net/npm/${pkg.name}@${version}${sub}/+esm'\n\n${indent(usageBody(item, u), 2)}\n</script>`,
    note: 'For production, install the package and bundle it instead of loading it from a CDN.',
  }
}

const FRAMEWORK_SKIP = new Set<ItemUsage['kind']>(['type', 'catalog-tool', 'side-effect', 'css'])

function reactTarget({ item, u, fw, importText }: Ctx): Target | null {
  if (!fw.has('react') || FRAMEWORK_SKIP.has(u.kind) || u.kind === 'angular-component') return null
  let code: string
  if (u.kind === 'react-component') {
    code =
      firstSnippet(item, ['tsx'])?.code.trim() ??
      `${importText}\n\nexport function App() {\n  return <${item.name} />\n}`
  } else if (u.kind === 'element') {
    code = `import '${item.module}'\n\nexport function App() {\n  // React 19 passes properties to custom elements; with React 18 set objects through a ref.\n  return <${u.tag}></${u.tag}>\n}`
  } else {
    const asyncNote = u.kind === 'tool' ? ' // a Promise: await it in an effect' : ''
    code = `${importText}\nimport { useMemo } from 'react'\n\nexport function Example() {\n  const value = useMemo(() => ${inlineExpr(item, u)}, [])${asyncNote}\n  return <pre>{JSON.stringify(value, null, 2)}</pre>\n}`
  }
  return { target: 'react', id: 'react', title: 'React', lang: 'tsx', code }
}

function angularTarget({ item, u, fw, importText }: Ctx): Target | null {
  if (!fw.has('angular') || FRAMEWORK_SKIP.has(u.kind) || u.kind === 'react-component') return null
  const angularSnippet = item.snippets.find((s) => s.code.includes('@angular/core'))
  let code: string
  if (angularSnippet) {
    code = angularSnippet.code.trim()
  } else if (u.kind === 'element') {
    code = `import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core'\nimport '${item.module}'\n\n@Component({\n  selector: 'app-example',\n  schemas: [CUSTOM_ELEMENTS_SCHEMA],\n  template: \`<${u.tag}></${u.tag}>\`,\n})\nexport class Example {}`
  } else if (u.kind === 'angular-component') {
    const sel = /<([a-z][\w-]*)/.exec(item.signature ?? '')?.[1] ?? 'sdu-tool'
    code = `import { Component } from '@angular/core'\n${importText}\n\n@Component({\n  selector: 'app-example',\n  imports: [${item.name}],\n  template: \`<${sel} />\`,\n})\nexport class Example {}`
  } else {
    code = `import { Component } from '@angular/core'\nimport { JsonPipe } from '@angular/common'\n${importText}\n\n@Component({\n  selector: 'app-example',\n  imports: [JsonPipe],\n  template: \`<pre>{{ value | json }}</pre>\`,\n})\nexport class Example {\n  readonly value = ${inlineExpr(item, u)}\n}`
  }
  return { target: 'angular', id: 'angular', title: 'Angular', lang: 'ts', code }
}

function cssUse(item: ApiItem): string {
  const name = item.name
  if (name.includes('font')) return `font-family: var(${name});`
  if (name.includes('radius')) return `border-radius: var(${name});`
  if (name.includes('shadow')) return `box-shadow: var(${name});`
  if (/space|gap|pad/.test(name)) return `padding: var(${name});`
  if (/bg|surface|background/.test(name)) return `background: var(${name});`
  if (name.includes('border')) return `border: 1px solid var(${name});`
  return `color: var(${name});`
}

/** In CDN HTML the elements are already registered; drop `import '@smartdevutils/elements…'` lines. */
function stripElementImports(html: string): string {
  return html
    .split('\n')
    .filter((l) => !/^\s*import ['"]@smartdevutils\/elements[^'"]*['"];?\s*$/.test(l))
    .join('\n')
    .replace(/<script type="module">\s*<\/script>\n*/g, '')
    .trim()
}

function indent(s: string, n: number): string {
  const pad = ' '.repeat(n)
  return s
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n')
}
