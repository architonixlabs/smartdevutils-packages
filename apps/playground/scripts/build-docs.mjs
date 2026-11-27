#!/usr/bin/env node
// Builds src/assets/docs.json (PlaygroundDocs, see src/app/core/model.ts) from the built workspace
// packages: package.json, README, CHANGELOG, dist/**/*.d.ts, core's tool specs and catalog, the
// elements manifest, theme tokens and the curated snippets in snippets/<package>/.
//
// Run after `pnpm -r --filter "./packages/*" build`, from the repo root or apps/playground:
//   node apps/playground/scripts/build-docs.mjs [--out <file>] [--no-probe]
//
// Core's root entry (`@smartdevutils/core`) re-exports every utility module, so its section is a
// short index (Markdown table of modules and their exports) instead of a second copy of every item.
// The same rule applies to any package: an export is listed once, under the first non-root subpath
// that exports it; the root module lists only what no subpath has.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PACKAGES_DIR, PACKAGE_IDS, DOCS_OUT, APP_DIR } from './lib/paths.mjs'
import { readPackageApi } from './lib/api.mjs'
import { codeBlocks, readmeBody, latestChangelog, slug } from './lib/markdown.mjs'
import { SUMMARIES } from './lib/summaries.mjs'
import { loadCurated } from './lib/curated.mjs'
import { generatedFunctionSnippet } from './lib/generated.mjs'
import { runInNode, mapLimit, toModuleJs } from './lib/run-snippet.mjs'

const args = process.argv.slice(2)
const outFile = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : DOCS_OUT
let probe = !args.includes('--no-probe')
let quiet = args.includes('--quiet')
const log = (...a) => {
  if (!quiet) console.log(...a)
}

/** Per-package settings. `dom`: needs a browser, so nothing from it runs in Node. */
const PACKAGES = {
  core: { frameworks: ['node', 'browser'], dom: false },
  browser: { frameworks: ['browser'], dom: true },
  recipes: { frameworks: ['node', 'browser'], dom: false },
  elements: { frameworks: ['html', 'browser'], dom: true },
  react: { frameworks: ['react'], dom: true, extraInstall: 'react react-dom' },
  angular: { frameworks: ['angular'], dom: true },
  theme: { frameworks: ['html', 'react', 'angular'], dom: false },
}

const MODULE_TITLES = {
  encoding: 'Encoding',
  formatting: 'Formatting',
  hashing: 'Hashing',
  generation: 'Generation',
  text: 'Text',
  'text-extra': 'Text (extra)',
  formats: 'Formats',
  jwt: 'JWT',
  dba: 'DBA',
  database: 'Database',
  devops: 'DevOps',
  'devops-tools': 'DevOps tools',
  aiml: 'AI/ML',
  'aiml-tools': 'AI/ML tools',
  security: 'Security',
  'security-extra2': 'Security (extra)',
  planning: 'Planning',
  color: 'Colour',
  network: 'Network',
  data: 'Data',
  developer: 'Developer',
  diagrams: 'Diagrams',
  'tools-api': 'Tool runner API',
  'tools-catalog': 'Tool catalog API',
  qrcode: 'QR codes',
  clipboard: 'Clipboard',
  'color-blindness': 'Colour blindness',
  file: 'Files',
  accessibility: 'Accessibility',
  'user-agent': 'User agent',
  mermaid: 'Mermaid',
  hooks: 'Hooks',
  index: 'Root module',
}

/** Subpaths that are not API modules (CSS, JSON, bundles, per-runner entries). */
const SKIP_SUBPATH = (pkgId, sub) =>
  sub === './package.json' || sub.endsWith('.css') || sub.endsWith('.json') || sub.includes('*') || (pkgId === 'elements' && sub === './cdn')

function sectionIdFor(pkgId, sub) {
  if (sub === '.') return 'index'
  // core: 'tools' is the section of runnable tools, so the runner API module gets its own id.
  if (pkgId === 'core' && sub === './tools') return 'tools-api'
  if (pkgId === 'core' && sub === './tools/catalog') return 'tools-catalog'
  return slug(sub.replace(/^\.\//, '').replace(/\//g, '-'))
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const readText = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')

function ensureBuilt() {
  const missing = PACKAGE_IDS.filter((id) => !fs.existsSync(path.join(PACKAGES_DIR, id, 'dist')))
  if (missing.length) {
    throw new Error(
      `Built packages missing: ${missing.join(', ')}. Run from the repo root: npx -y pnpm@9.15.0 -r --filter "./packages/*" build`,
    )
  }
}

function typesOf(v) {
  if (typeof v === 'string') return v.endsWith('.d.ts') ? v : null
  return v?.types ?? null
}

/** "| `encoding` | Base64, URL ... |" rows of core's README module table. */
function moduleTableFromReadme(md) {
  const map = {}
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*((?:`[\w-]+`(?:,\s*)?)+)\s*\|\s*(.+?)\s*\|\s*$/.exec(line)
    if (!m) continue
    for (const name of m[1].match(/`([\w-]+)`/g) ?? []) map[name.replace(/`/g, '')] = m[2]
  }
  return map
}

function fallbackSummary(entry, list) {
  const name = entry.name
  if (['type', 'interface', 'enum'].includes(entry.kind)) {
    const re = new RegExp(`\\b${name}\\b`)
    const returnedBy = list.filter((e) => e.kind === 'function' && e.returns && re.test(e.returns)).map((e) => `\`${e.name}()\``)
    if (returnedBy.length) return `The shape ${returnedBy.slice(0, 3).join(', ')} return${returnedBy.length === 1 ? 's' : ''}.`
    const takenBy = list.filter((e) => e.kind === 'function' && (e.params ?? []).some((p) => re.test(p.type))).map((e) => `\`${e.name}()\``)
    if (takenBy.length) return `Argument type of ${takenBy.slice(0, 3).join(', ')}.`
    const inType = list.filter((e) => e !== entry && ['type', 'interface'].includes(e.kind) && re.test(e.signature ?? '')).map((e) => `\`${e.name}\``)
    if (inType.length) return `Part of ${inType.slice(0, 2).join(' and ')}.`
    return `The \`${name}\` ${entry.kind}.`
  }
  if (entry.kind === 'const') return `The \`${name}\` constant.`
  if (entry.kind === 'class') return `The \`${name}\` class.`
  return `\`${name}()\`.`
}

function toItem(pkgId, sub, entry, list, moduleName) {
  const key = `${pkgId}:${sub.replace(/^\.\/?/, '') || 'index'}:${entry.name}`
  const summary = entry.summary || SUMMARIES[key] || fallbackSummary(entry, list)
  const item = {
    id: slug(entry.name),
    name: entry.name,
    kind: entry.kind,
    module: moduleName,
    summary,
    ...(entry.docs ? { docs: entry.docs } : {}),
    ...(entry.signature ? { signature: entry.signature } : {}),
    ...(entry.params?.length ? { params: entry.params } : {}),
    ...(entry.returns ? { returns: entry.returns } : {}),
    ...(entry.deprecated ? { deprecated: entry.deprecated } : {}),
    snippets: [],
  }
  Object.defineProperty(item, '_raw', { value: { ...entry, hasJsDoc: Boolean(entry.summary) }, enumerable: false })
  return item
}

function moduleSection(id, title, markdown, items) {
  return { id, title, kind: 'module', ...(markdown ? { markdown } : {}), items }
}

function indexMarkdown(pkgName, perSub, intro) {
  const rows = []
  for (const [sub, entries] of perSub) {
    if (sub === '.') continue
    const names = entries.map((e) => `\`${e.name}\``)
    rows.push(`| \`${pkgName}/${sub.replace(/^\.\//, '')}\` | ${names.slice(0, 14).join(', ')}${names.length > 14 ? `, … (${names.length})` : ''} |`)
  }
  return `${intro}\n\n| Module | Exports |\n|---|---|\n${rows.join('\n')}`
}

// ---------------------------------------------------------------- packages

async function buildPackage(pkgId) {
  const dir = path.join(PACKAGES_DIR, pkgId)
  const pj = readJson(path.join(dir, 'package.json'))
  const cfg = PACKAGES[pkgId]
  const readme = readText(path.join(dir, 'README.md'))
  const changelog = latestChangelog(readText(path.join(dir, 'CHANGELOG.md')))
  const exportKeys = Object.keys(pj.exports ?? { '.': pj.types })
  const apiSubs = exportKeys
    .filter((k) => !SKIP_SUBPATH(pkgId, k))
    .map((k) => ({ subpath: k, types: typesOf(pj.exports[k]) }))
    .filter((s) => s.types)
  const api = readPackageApi(dir, apiSubs, {
    isComponent: pkgId === 'react' ? (file, ret) => /JSX\.Element|ReactNode|ReactElement/.test(ret) : undefined,
  })

  // One home per declaration: the first non-root subpath that exports it, then the root.
  const seen = new Set()
  const perSub = new Map()
  const ordered = [...apiSubs.filter((s) => s.subpath !== '.'), ...apiSubs.filter((s) => s.subpath === '.')]
  const reexports = new Map()
  for (const { subpath } of ordered) {
    const kept = []
    for (const e of api.get(subpath) ?? []) {
      const key = `${e.declFile}#${e.name}`
      if (seen.has(key)) {
        if (subpath !== '.') reexports.set(subpath, [...(reexports.get(subpath) ?? []), e.name])
        continue
      }
      seen.add(key)
      kept.push(e)
    }
    perSub.set(subpath, kept)
  }

  const sections = []
  sections.push({
    id: 'overview',
    title: 'Overview',
    kind: 'overview',
    markdown: readmeBody(readme),
    items: [],
  })

  const nameOf = (sub) => (sub === '.' ? pj.name : `${pj.name}/${sub.replace(/^\.\//, '')}`)
  const coreTable = pkgId === 'core' ? moduleTableFromReadme(readme) : {}
  const extraSections = { before: [], after: [] }

  if (pkgId === 'core') {
    const { buildToolSections } = await import('./lib/tools.mjs')
    const tools = await buildToolSections()
    extraSections.before.push(tools.runnable)
    extraSections.after.push(tools.website)
    toolStats = tools.stats
  }
  if (pkgId === 'elements') {
    const { buildElementsSection } = await import('./lib/elements.mjs')
    const { section } = buildElementsSection(dir)
    extraSections.before.push(section)
    elementClassNames = new Set(section.items.map((i) => i._className))
    for (const it of section.items) {
      delete it._className
      delete it._fixedTool
    }
  }
  if (pkgId === 'recipes') extraSections.before.push(await buildRecipesSection())
  if (pkgId === 'theme') extraSections.before.push(buildThemeSection(dir, readme))

  const moduleSections = []
  for (const { subpath } of apiSubs) {
    let entries = perSub.get(subpath) ?? []
    if (pkgId === 'elements') entries = entries.filter((e) => !elementClassNames.has(e.name))
    const id = sectionIdFor(pkgId, subpath)
    const moduleName = nameOf(subpath)
    const all = api.get(subpath) ?? []
    if (pkgId === 'react' || pkgId === 'angular') {
      if (subpath === '.') {
        const comps = entries.filter((e) => e.kind === 'component')
        const rest = entries.filter((e) => e.kind !== 'component')
        moduleSections.push({
          id: 'components',
          title: 'Components',
          kind: 'components',
          markdown:
            pkgId === 'react'
              ? 'React components. `Sdu*` components use the plain `.sdu-*` classes from `@smartdevutils/theme` (import `@smartdevutils/theme/styles.css` once); the other panels use Tailwind classes. Every example renders into `#root` with `createRoot`.'
              : 'Angular standalone components with signal inputs and outputs. Angular does not run inside the playground, so these examples are complete components to copy into your app (or open in StackBlitz).',
          items: comps.map((e) => toItem(pkgId, subpath, e, all, moduleName)),
        })
        if (rest.length) moduleSections.push(moduleSection('index', `${pj.name} (other exports)`, `Functions, constants and types exported from \`${pj.name}\`.`, rest.map((e) => toItem(pkgId, subpath, e, all, moduleName))))
        continue
      }
    }
    if (subpath === '.' && apiSubs.length > 1 && entries.length === 0) {
      moduleSections.unshift(
        moduleSection(
          'index',
          `${pj.name} (root)`,
          indexMarkdown(
            pj.name,
            perSub,
            `\`import { … } from '${pj.name}'\` re-exports every module below. Import from a subpath instead, so your bundle only pulls in that module. Each export is documented once, under its module.`,
          ),
          [],
        ),
      )
      continue
    }
    const short = subpath.replace(/^\.\//, '')
    const covers = coreTable[short]
    const re = reexports.get(subpath)
    const md = [
      `\`import { … } from '${moduleName}'\``,
      covers ? `${covers}.` : '',
      re?.length ? `Also re-exports ${re.map((n) => `\`${n}\``).join(', ')} (documented in another module).` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    const title = subpath === '.' ? (apiSubs.length > 1 ? `${pj.name} (root)` : 'API') : (pkgId === 'core' || pkgId === 'browser' ? MODULE_TITLES[id] : undefined) ?? moduleName.replace('@smartdevutils/', '')
    if (!entries.length) continue // everything it exports is documented elsewhere (for example an element)
    moduleSections.push(moduleSection(id, title, md, entries.map((e) => toItem(pkgId, subpath, e, all, moduleName))))
  }

  // Order: overview, root index (if markdown-only), the package's special sections, modules, the rest.
  const idx = moduleSections.findIndex((s) => s.id === 'index' && s.items.length === 0)
  const rootIndex = idx >= 0 ? moduleSections.splice(idx, 1) : []
  sections.push(...rootIndex, ...extraSections.before, ...moduleSections, ...extraSections.after)

  return {
    name: pj.name,
    id: pkgId,
    version: pj.version,
    description: pj.description,
    install: `npm install ${pj.name}${cfg.extraInstall ? ` ${cfg.extraInstall}` : ''}`,
    exports: exportKeys,
    ...(changelog ? { changelog: `## ${changelog.version}\n\n${changelog.markdown}` } : {}),
    frameworks: cfg.frameworks,
    sections,
    _readme: readme,
  }
}

let toolStats = null
let elementClassNames = new Set()

async function buildRecipesSection() {
  const { BUILTIN_RECIPES, isRunnable, missingRunners } = await import('@smartdevutils/recipes')
  const { TOOL_CATALOG } = await import('@smartdevutils/core/tools/catalog')
  const toolName = new Map(TOOL_CATALOG.map((t) => [t.id, t.name]))
  const items = BUILTIN_RECIPES.map((r) => {
    const runnable = isRunnable(r)
    const missing = runnable ? [] : missingRunners(r)
    const steps = r.toolIds
      .map((t, i) => `| ${i + 1} | ${toolName.get(t) ?? t} (\`${t}\`) | ${r.modes?.[t] ? `\`${r.modes[t]}\`` : ''} | ${missing.includes(t) ? 'website only' : 'runner'} |`)
      .join('\n')
    const code = runnable
      ? [
          `import { getRecipe, runRecipe, describeStep } from '@smartdevutils/recipes'`,
          '',
          `const recipe = getRecipe('${r.id}')!`,
          `// With no input, the recipe's own synthetic sample is used.`,
          `const run = await runRecipe(recipe)`,
          '',
          `run.trace.forEach((t, i) => {`,
          `  if (t) console.log(\`\${i + 1}. \${run.steps[i].name}: \${describeStep(t.input, t.output).headline}\`)`,
          `})`,
          `console.log(run.stopped ? 'Stopped: ' + run.stopped.reason : run.trace.at(-1)?.output)`,
        ]
      : [
          `import { getRecipe, isRunnable, missingRunners } from '@smartdevutils/recipes'`,
          '',
          `const recipe = getRecipe('${r.id}')!`,
          `console.log(recipe.name, '-', recipe.toolIds.join(' -> '))`,
          `console.log('Runs headless:', isRunnable(recipe))`,
          `console.log('Tools still website-only:', missingRunners(recipe))`,
        ]
    return {
      id: r.id,
      name: r.name,
      kind: 'const',
      module: '@smartdevutils/recipes',
      summary: r.description,
      docs: [
        r.description,
        `| Step | Tool | Mode | Runs headless |\n|---|---|---|---|\n${steps}`,
        runnable
          ? 'Every tool in this recipe has a runner, so it runs headless with `runRecipe()` in Node or the browser.'
          : `Not runnable headless yet: ${missing.map((m) => `\`${m}\``).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no runner in \`@smartdevutils/core\` yet. It runs on [smartdevutils.com/recipes](https://smartdevutils.com/recipes).`,
        r.sample ? `Sample input: \`${r.sample.length > 120 ? `${r.sample.slice(0, 117)}...` : r.sample}\`` : '',
        `Category: ${r.category}.`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      signature: `getRecipe('${r.id}')`,
      webUrl: 'https://smartdevutils.com/recipes',
      snippets: [
        {
          id: runnable ? 'run' : 'status',
          title: runnable ? 'Run this recipe headless' : 'Check what this recipe needs',
          lang: 'ts',
          code: code.join('\n') + '\n',
          mode: 'run',
          output: 'console',
          source: 'generated',
          node: true,
        },
      ],
    }
  })
  const runnableCount = items.filter((i) => i.snippets[0].id === 'run').length
  return {
    id: 'recipes',
    title: `Built-in recipes (${items.length})`,
    kind: 'recipes',
    markdown: `The ${items.length} built-in recipes of smartdevutils.com as data (\`BUILTIN_RECIPES\`), with the same ids. ${runnableCount} run headless today with \`runRecipe()\`; the others list the tools that still need a runner and run on the website.`,
    items,
  }
}

function buildThemeSection(dir, readme) {
  const tokensCss = readText(path.join(dir, 'dist', 'tokens.css'))
  const baseCss = readText(path.join(dir, 'dist', 'base.css'))
  const light = {}
  const dark = {}
  // tokens.css: the first block is light (and :root), a later block is dark.
  const blocks = [...tokensCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  for (const [, selector, body] of blocks) {
    const target = /dark/.test(selector) ? dark : light
    for (const m of body.matchAll(/--sdu-([\w-]+)\s*:\s*([^;]+);/g)) if (!(m[1] in target)) target[m[1]] = m[2].trim()
  }
  const usedFor = {}
  for (const line of readme.split(/\r?\n/)) {
    const m = /^\|\s*(`--sdu-[^|]+)\|[^|]*\|[^|]*\|\s*(.+?)\s*\|\s*$/.exec(line)
    if (!m) continue
    for (const t of m[1].match(/--sdu-[\w-]+/g) ?? []) usedFor[t.replace('--sdu-', '')] = m[2]
  }
  const names = Object.keys(light)
  const items = names.map((n) => {
    const l = light[n]
    const d = dark[n] ?? l
    return {
      id: slug(`sdu-${n}`),
      name: `--sdu-${n}`,
      kind: 'const',
      module: '@smartdevutils/theme/tokens.css',
      summary: usedFor[n] ? `Design token: ${usedFor[n].charAt(0).toLowerCase()}${usedFor[n].slice(1)}.` : 'Design token.',
      docs: `| Theme | Value |\n|---|---|\n| Light | \`${l}\` |\n| Dark | \`${d}\` |\n\nOverride it anywhere, for example \`:root { --sdu-${n}: …; }\`. The defaults use \`:where()\`, so your rule always wins.`,
      signature: l === d ? `--sdu-${n}: ${l};` : `--sdu-${n}: ${l}; /* dark: ${d} */`,
      snippets: [],
    }
  })
  const classes = [...new Set(baseCss.match(/\.sdu-[a-z0-9-]+/g) ?? [])].sort()
  return {
    id: 'theme',
    title: 'Design tokens',
    kind: 'theme',
    markdown: [
      `The \`--sdu-*\` custom properties in \`@smartdevutils/theme/tokens.css\` (${items.length} tokens, light and dark). They pass into the Web Components' shadow roots, so one rule restyles \`@smartdevutils/elements\`, \`@smartdevutils/angular\` and the \`Sdu*\` React components.`,
      '| File | What it holds |\n|---|---|\n| `@smartdevutils/theme/tokens.css` | The `--sdu-*` custom properties for light and dark |\n| `@smartdevutils/theme/base.css` | The `.sdu-*` classes |\n| `@smartdevutils/theme/styles.css` | Both, in that order |',
      `Classes in \`base.css\`: ${classes.map((c) => `\`${c}\``).join(', ')}.`,
    ].join('\n\n'),
    items,
  }
}

// ---------------------------------------------------------------- snippets

function findItem(pkg, sectionId, itemId) {
  const s = pkg.sections.find((x) => x.id === sectionId)
  return s?.items.find((i) => i.id === itemId)
}

function addSnippet(item, snippet) {
  let id = snippet.id
  let n = 2
  while (item.snippets.some((s) => s.id === id)) id = `${snippet.id}-${n++}`
  item.snippets.push({ ...snippet, id })
}

function attachCurated(packages) {
  const curated = loadCurated()
  const byPkg = new Map(packages.map((p) => [p.id, p]))
  const errors = []
  const sorted = [...curated].sort((a, b) => a.order - b.order || a.file.localeCompare(b.file))
  for (const c of sorted) {
    const pkg = byPkg.get(c.pkg)
    if (!pkg) {
      errors.push(`${c.file}: no package "${c.pkg}"`)
      continue
    }
    for (const e of c.entries) {
      const item = findItem(pkg, e.section, e.item)
      if (!item) errors.push(`${c.file}: no entry ${c.pkg}/${e.section}/${e.item}`)
      else addSnippet(item, c.snippet)
    }
  }
  if (errors.length) throw new Error(`Curated snippets point at missing entries:\n  ${errors.join('\n  ')}`)
  return curated.length
}

/** README code blocks become `readme` snippets on the item they are about (by imported name or tag). */
function readmeCandidates(pkg) {
  const blocks = codeBlocks(pkg._readme).filter((b) => b.snippetLang)
  const titleCount = new Map()
  const out = []
  const allItems = pkg.sections.filter((s) => s.kind !== 'overview').flatMap((s) => s.items.map((i) => ({ s, i })))
  for (const b of blocks) {
    const names = []
    for (const m of b.code.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*'(@smartdevutils\/[^']+)'/g)) {
      for (const n of m[1].split(',')) {
        const clean = n.replace(/\btype\b/, '').split(/\s+as\s+/)[0].trim()
        if (clean) names.push(clean)
      }
    }
    for (const m of b.code.matchAll(/^\s*(?:export\s+)?interface\s+(\w+)/gm)) names.push(m[1])
    const tags = [...b.code.matchAll(/<(sdu-[a-z-]+)/g)].map((m) => m[1])
    let target = null
    for (const t of tags) {
      target = allItems.find((x) => x.s.kind === 'elements' && x.i.id === t)
      if (target) break
    }
    if (!target) {
      for (const n of names) {
        target =
          allItems.find((x) => x.i.name === n && x.s.kind !== 'tools' && x.i.kind !== 'type' && x.i.kind !== 'interface') ??
          allItems.find((x) => x.i.name === n && x.s.kind !== 'tools')
        if (target) break
      }
    }
    if (!target) continue
    const base = b.heading || 'Example'
    const count = (titleCount.get(base) ?? 0) + 1
    titleCount.set(base, count)
    out.push({
      target,
      snippet: {
        id: `readme-${slug(base.toLowerCase())}${count > 1 ? `-${count}` : ''}`,
        title: count > 1 ? `${base} (${count})` : base,
        lang: b.snippetLang,
        code: b.code + '\n',
        mode: 'docs',
        output: b.snippetLang === 'tsx' || b.snippetLang === 'html' ? 'preview' : 'console',
        description: `From the ${pkg.name} README.`,
        source: 'readme',
      },
    })
  }
  return out
}

function hasStatements(snippet) {
  try {
    const js = toModuleJs(snippet.code, snippet.lang)
    return js.replace(/export\s*\{\s*\};?/g, '').replace(/["']use strict["'];?/g, '').trim() !== ''
  } catch {
    return false
  }
}

/** APIs the sandboxed preview (opaque origin, no focus or permissions) can never use. */
const NO_SANDBOX = /\b(copyToClipboard|readFromClipboard|navigator\.clipboard)\b/

const DOM_ERROR = /\b(window|document|navigator|HTMLElement|customElements|localStorage|sessionStorage|Image|ImageData|Blob|FileReader) is not defined/

async function probeAll(cands) {
  if (!probe || !cands.length) return
  const started = Date.now()
  const limit = Math.max(2, Math.min(8, os.cpus().length))
  const results = await mapLimit(cands, limit, (c, i) => runInNode(c.snippet.code, c.snippet.lang, { name: `probe-${i}` }))
  results.forEach((r, i) => {
    cands[i].result = r
  })
  log(`  probed ${cands.length} snippets in Node in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

async function attachReadmeAndGenerated(packages, stats) {
  const readme = []
  const generated = []
  for (const pkg of packages) {
    const cfg = PACKAGES[pkg.id]
    for (const c of readmeCandidates(pkg)) readme.push({ pkg, cfg, ...c })
    for (const section of pkg.sections) {
      if (section.kind !== 'module') continue
      for (const item of section.items) {
        const raw = item._raw
        if (!raw || raw.kind !== 'function') continue
        if (item.snippets.length) continue // curated first
        if (pkg.id === 'react' || pkg.id === 'angular' || pkg.id === 'elements') continue
        if (raw.name.startsWith('use')) continue
        const g = generatedFunctionSnippet(pkg.id, raw, item.module, { dom: cfg.dom })
        if (g) generated.push({ pkg, cfg, item, exact: g.exact, snippet: g.snippet })
      }
    }
  }
  const toProbe = [
    // Type-only blocks (an interface listing) have nothing to run: they stay docs-only.
    // Blocks that use Node built-ins (writing run.json, …) are not executed: they would touch the disk.
    ...readme.filter(
      (c) => !c.cfg.dom && (c.snippet.lang === 'ts' || c.snippet.lang === 'js') && hasStatements(c.snippet) && !/from ['"]node:/.test(c.snippet.code),
    ),
    ...generated.filter((c) => !c.cfg.dom),
  ]
  await probeAll(toProbe)
  for (const c of readme) {
    if (c.result?.ok) {
      c.snippet.mode = 'run'
      c.snippet.node = true
    } else if ((c.snippet.lang === 'ts' || c.snippet.lang === 'js') && c.pkg.id === 'browser' && /@smartdevutils\//.test(c.snippet.code) && !/node:/.test(c.snippet.code) && !NO_SANDBOX.test(c.snippet.code)) {
      // Browser-only README examples run in the preview sandbox.
      c.snippet.mode = 'run'
    } else if (c.result && DOM_ERROR.test(c.result.error ?? '')) {
      c.snippet.mode = 'run'
    }
    addSnippet(c.target.i, c.snippet)
    stats.readme++
    if (c.snippet.node) stats.readmeNode.push(`${c.pkg.id}/${c.target.s.id}/${c.target.i.id}#${c.snippet.id}`)
  }
  for (const c of generated) {
    if (c.result?.ok) {
      c.snippet.node = true
      if (!c.exact) c.snippet.description = 'Generated example with sample arguments.'
    } else if (!c.cfg.dom && probe) {
      // A Run button that always throws is worse than none: offer it as code to adapt.
      stats.generatedFailed.push(`${c.pkg.id}:${c.item.module}#${c.item.name}`)
      c.snippet.mode = 'docs'
      c.snippet.description = 'Generated template: replace the placeholder arguments with real values before using it.'
    } else if (c.cfg.dom && (!c.exact || NO_SANDBOX.test(c.snippet.code))) {
      c.snippet.mode = 'docs'
      c.snippet.description = NO_SANDBOX.test(c.snippet.code)
        ? 'Generated example. The clipboard needs a focused page with permission, so it cannot run in the sandboxed preview.'
        : 'Generated template: replace the placeholder arguments with real values before using it.'
    }
    addSnippet(c.item, c.snippet)
  }
}

/** Placeholder components for React/Angular entries that have no curated snippet. */
function frameworkSnippets(packages) {
  for (const pkg of packages) {
    if (pkg.id !== 'react' && pkg.id !== 'angular') continue
    const comps = pkg.sections.find((s) => s.id === 'components')
    for (const item of comps?.items ?? []) {
      if (item.snippets.length) continue
      const required = (item.params ?? []).filter((p) => !p.optional)
      if (pkg.id === 'react') {
        const isNode = (p) => p.name === 'children' || /ReactNode/.test(p.type)
        const props = required.filter((p) => !isNode(p)).map((p) => ` ${p.name}={${p.type === 'string' ? "'example'" : `undefined as any /* ${p.type} */`}}`).join('')
        const children = required.some(isNode)
        const exact = !props.includes('undefined as any')
        const el = children ? `<${item.name}${props}>\n    <p>Your content here.</p>\n  </${item.name}>` : `<${item.name}${props} />`
        addSnippet(item, {
          id: 'example',
          title: `Render <${item.name}>`,
          lang: 'tsx',
          code: `import { createRoot } from 'react-dom/client'\nimport { ${item.name} } from '${item.module}'\n\ncreateRoot(document.getElementById('root')!).render(\n  ${el},\n)\n`,
          mode: exact ? 'run' : 'docs',
          output: 'preview',
          description: 'Generated example. Most panels are styled with Tailwind classes, which the playground does not load.',
          source: 'generated',
        })
      } else {
        const selector = item.signature?.replace(/[<>]/g, '') ?? 'sdu-tool'
        const inputs = required.map((p) => ` ${p.name}="example"`).join('')
        addSnippet(item, {
          id: 'example',
          title: `Use <${selector}> in a component`,
          lang: 'ts',
          code: [
            `import { Component } from '@angular/core'`,
            `import { ${item.name} } from '${item.module}'`,
            '',
            '@Component({',
            `  selector: 'app-example',`,
            `  imports: [${item.name}],`,
            `  template: \`<${selector}${inputs}></${selector}>\`,`,
            '})',
            'export class ExampleComponent {}',
            '',
          ].join('\n'),
          mode: 'docs',
          output: 'preview',
          description: 'Generated example. Angular entries are not run in the playground; copy this into your app.',
          source: 'generated',
        })
      }
    }
  }
}

/** Every element gets at least one runnable HTML example. */
function elementSnippets(packages) {
  const pkg = packages.find((p) => p.id === 'elements')
  const sec = pkg?.sections.find((s) => s.id === 'elements')
  for (const item of sec?.items ?? []) {
    if (item.snippets.some((s) => s.mode === 'run')) continue
    addSnippet(item, {
      id: 'example',
      title: `A <${item.id}> element`,
      lang: 'html',
      code: `<script type="module">\n  import '${item.module}'\n</script>\n\n<${item.id}></${item.id}>\n`,
      mode: 'run',
      output: 'preview',
      source: 'generated',
    })
  }
}

// ---------------------------------------------------------------- validation and output

function finalize(packages) {
  const problems = []
  for (const pkg of packages) {
    delete pkg._readme
    const sectionIds = new Set()
    for (const s of pkg.sections) {
      if (sectionIds.has(s.id)) problems.push(`${pkg.id}: duplicate section ${s.id}`)
      sectionIds.add(s.id)
      const ids = new Map()
      for (const item of s.items) {
        // Case-only clashes (e.g. a type and a const) get a kind suffix to stay unique.
        let id = item.id
        if (ids.has(id.toLowerCase())) id = `${id}-${item.kind}`
        let n = 2
        while (ids.has(id.toLowerCase())) id = `${item.id}-${n++}`
        ids.set(id.toLowerCase(), true)
        item.id = id
        if (!item.summary) problems.push(`${pkg.id}/${s.id}/${item.id}: empty summary`)
      }
    }
  }
  if (problems.length) throw new Error(problems.join('\n'))
}

function countStats(packages) {
  const c = { packages: packages.length, sections: 0, items: 0, snippets: 0, bySource: {}, node: 0, runnable: 0 }
  for (const p of packages) {
    for (const s of p.sections) {
      c.sections++
      for (const i of s.items) {
        c.items++
        for (const sn of i.snippets) {
          c.snippets++
          c.bySource[sn.source] = (c.bySource[sn.source] ?? 0) + 1
          if (sn.node) c.node++
          if (sn.mode === 'run') c.runnable++
        }
      }
    }
  }
  return c
}

/** @param {{ quiet?: boolean, probe?: boolean }} [opts] */
export async function buildDocs(opts = {}) {
  if (opts.quiet !== undefined) quiet = opts.quiet
  if (opts.probe !== undefined) probe = opts.probe
  ensureBuilt()
  const packages = []
  for (const id of PACKAGE_IDS) {
    log(`- ${id}`)
    packages.push(await buildPackage(id))
  }
  const versions = new Set(packages.map((p) => p.version))
  if (versions.size !== 1) throw new Error(`Packages are not on one version: ${[...versions].join(', ')}`)
  const stats = { readme: 0, readmeNode: [], generatedFailed: [] }
  const curatedCount = attachCurated(packages)
  await attachReadmeAndGenerated(packages, stats)
  frameworkSnippets(packages)
  elementSnippets(packages)
  finalize(packages)
  const docs = { generatedAt: new Date().toISOString(), version: [...versions][0], packages }
  return { docs, stats: { ...stats, curatedFiles: curatedCount, tools: toolStats } }
}

async function main() {
  const t0 = Date.now()
  const { docs, stats } = await buildDocs()
  const json = JSON.stringify(docs)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, json)
  const c = countStats(docs.packages)
  log(
    `wrote ${path.relative(process.cwd(), outFile) || outFile}: ${(json.length / 1024).toFixed(0)} kB, ${c.packages} packages, ${c.sections} sections, ${c.items} items, ${c.snippets} snippets ${JSON.stringify(c.bySource)}, ${c.runnable} runnable, ${c.node} run in Node (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
  )
  if (stats.tools) {
    log(
      `  tools: website examples from the ${stats.tools.examplesSource === 'website' ? 'website repo (snapshot refreshed)' : `committed snapshot (${stats.tools.examplesError})`}, ${stats.tools.websiteExamplesUsed} used, ${stats.tools.fallbacks} tools on built-in examples, ${stats.tools.dropped.length} examples dropped`,
    )
  }
  if (stats.generatedFailed.length) log(`  ${stats.generatedFailed.length} generated snippets do not run as is in Node (left node: false)`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === path.resolve(APP_DIR, 'scripts', 'build-docs.mjs').toLowerCase()
if (isMain) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
