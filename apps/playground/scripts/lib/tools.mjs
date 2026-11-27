// Core's tool sections: the runnable tools (one item each, with runTool() snippets built from the
// website's own examples) and the website-only catalog tools.
import fs from 'node:fs'
import { TOOL_SPECS, runTool } from '@smartdevutils/core/tools'
import { TOOL_CATALOG } from '@smartdevutils/core/tools/catalog'
import path from 'node:path'
import { TOOL_EXAMPLES_FILE, TOOL_EXAMPLES_SNAPSHOT } from './paths.mjs'

const WEB = 'https://smartdevutils.com/tools/'
const MAX_EXAMPLES = 3
const MAX_EXTRA_MODES = 2
const MAX_SNIPPET_INPUT = 4000

/**
 * Reads TOOL_EXAMPLES from the website's tool-examples.ts (a TS file made of JSON literals).
 * @returns {{ examples: Record<string, {label: string, input: string, options?: object}[]>, found: boolean, error?: string }}
 */
export function loadWebsiteExamples(file = TOOL_EXAMPLES_FILE) {
  if (!fs.existsSync(file)) return { examples: {}, found: false, error: `not found: ${file}` }
  const text = fs.readFileSync(file, 'utf8')
  const start = text.indexOf('= {', text.indexOf('TOOL_EXAMPLES'))
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return { examples: {}, found: false, error: 'TOOL_EXAMPLES literal not found' }
  try {
    return { examples: JSON.parse(text.slice(start + 2, end + 1)), found: true }
  } catch (e) {
    return { examples: {}, found: false, error: `could not parse TOOL_EXAMPLES: ${e.message}` }
  }
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
  return v
}

/** The website examples of the runnable tools only, raw, with a stable key order and no timestamps. */
export function snapshotOf(examples, toolIds) {
  const out = {}
  for (const id of [...toolIds].sort()) {
    const list = examples[id]
    if (!list?.length) continue
    out[id] = list.map((ex) => ({ label: ex.label, input: ex.input ?? '', ...(ex.options && Object.keys(ex.options).length ? { options: sortKeys(ex.options) } : {}) }))
  }
  return out
}

/**
 * Website examples for the runnable tools. With the website repo next to this one, they are read from
 * tool-examples.ts and the committed snapshot (scripts/data/tool-examples.json) is refreshed; without it
 * (the Docker build) the snapshot is used. Throws when neither is available.
 * @returns {{ examples: object, source: 'website' | 'snapshot', found: boolean, error?: string }}
 */
export function loadToolExamples({ websiteFile = TOOL_EXAMPLES_FILE, snapshotFile = TOOL_EXAMPLES_SNAPSHOT, write = true } = {}) {
  const site = loadWebsiteExamples(websiteFile)
  if (site.found) {
    const snapshot = snapshotOf(site.examples, TOOL_SPECS.map((s) => s.id))
    const text = `${JSON.stringify(snapshot, null, 2)}\n`
    if (write && (!fs.existsSync(snapshotFile) || fs.readFileSync(snapshotFile, 'utf8') !== text)) {
      fs.mkdirSync(path.dirname(snapshotFile), { recursive: true })
      fs.writeFileSync(snapshotFile, text)
    }
    return { examples: snapshot, source: 'website', found: true }
  }
  if (fs.existsSync(snapshotFile)) {
    return { examples: JSON.parse(fs.readFileSync(snapshotFile, 'utf8')), source: 'snapshot', found: true, error: site.error }
  }
  throw new Error(`No tool examples: the website file is missing (${site.error}) and there is no snapshot at ${snapshotFile}.`)
}

/** When the website has no usable example (or the examples file is missing). */
const FALLBACK_INPUTS = {
  'url-encoder-decoder': { label: 'Query string with spaces', input: 'q=hello world&lang=en' },
  'base64-encoder-decoder': { label: 'JSON payload', input: '{"userId":123,"role":"admin"}' },
  'json-formatter': { label: 'API response', input: '{"id":42,"name":"Jane","roles":["admin","editor"]}' },
  'uuid-generator': { label: 'Five v4 UUIDs', input: '', options: { count: 5 } },
  'hash-generator': { label: 'SHA-256 of a string', input: 'hello world' },
  'sql-create-table': {
    label: 'Users table',
    input: '{"tableName":"users","columns":[{"name":"id","type":"SERIAL","primaryKey":true},{"name":"email","type":"VARCHAR(255)","nullable":false}]}',
  },
  'ddl-diff': {
    label: 'Add a column',
    input: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));',
    options: { after: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255), email TEXT);' },
  },
  'index-advisor': { label: 'Filter and sort', input: 'SELECT * FROM orders WHERE customer_id = 7 ORDER BY created_at DESC;' },
  'slow-query-detector': { label: 'Leading wildcard', input: "SELECT * FROM users WHERE email LIKE '%@example.com';" },
  'migration-generator': {
    label: 'Add a column',
    input: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
    options: { after: 'CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT);' },
  },
  'cicd-pipeline-builder': { label: 'Node on GitHub Actions', input: '', options: { language: 'node', platform: 'github-actions' } },
  'k8s-yaml-validator': {
    label: 'Deployment',
    input: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: nginx:1.27\n',
  },
  'docker-tag-checker': { label: 'Dockerfile', input: 'FROM node:latest\nFROM nginx\n' },
  'log-parser': { label: 'Mixed log lines', input: '2026-11-27 09:00:01 INFO api started\n2026-11-27 09:00:04 ERROR db timeout\n' },
  'system-prompt-analyzer': { label: 'One-line prompt', input: 'You are a helpful assistant.' },
  'training-data-formatter': { label: 'Q&A pairs', input: '[{"input":"What is 2+2?","output":"4"}]' },
  'gantt-generator': {
    label: 'Two tasks',
    input: '[{"title":"Design","start":"2026-01-05","end":"2026-01-16"},{"title":"Build","start":"2026-01-19","end":"2026-02-13"}]',
  },
  'sprint-velocity': { label: 'Six sprints', input: '21, 24, 19, 26, 23, 25' },
  'boundary-value-analyzer': { label: 'Age 18 to 65', input: '', options: { fieldName: 'age', min: 18, max: 65 } },
  'performance-sla-checker': { label: 'Response times', input: '120\n135\n128\n142\n150\n133\n161\n147\n410\n980' },
}

/** The website's examples are written in the runners' input format and option names, so they run as they are. */
function toExample(ex) {
  return { label: ex.label, input: ex.input ?? '', options: { ...ex.options } }
}

async function tryRun(id, input, mode, options) {
  try {
    const r = await runTool(id, input, { ...(mode ? { mode } : {}), options })
    return !r.error && r.output.trim() ? r : null
  } catch {
    return null
  }
}

function literal(text) {
  // A template literal reads best for multi-line text; single quotes otherwise, as the docs do.
  if (text.includes('\n') && !/[`\\]|\$\{/.test(text)) return `\`${text}\``
  if (!/['\\\n\r]/.test(text)) return `'${text}'`
  return JSON.stringify(text)
}

const KEY = /^[A-Za-z_$][\w$]*$/

function valueLiteral(v) {
  if (typeof v === 'string') return literal(v)
  if (Array.isArray(v)) return `[${v.map(valueLiteral).join(', ')}]`
  if (v && typeof v === 'object') {
    const body = Object.entries(v).map(([k, x]) => `${KEY.test(k) ? k : literal(k)}: ${valueLiteral(x)}`)
    return body.length ? `{ ${body.join(', ')} }` : '{}'
  }
  return JSON.stringify(v)
}

/** The runTool() call, with multi-line option values hoisted into their own constants. */
function runToolCall(id, mode, options) {
  const pre = []
  const fields = []
  for (const [k, v] of Object.entries(options ?? {})) {
    if (typeof v === 'string' && v.includes('\n') && KEY.test(k) && k !== 'input' && k !== 'result') {
      pre.push(`const ${k} = ${literal(v)}`)
      fields.push(k)
    } else {
      fields.push(`${KEY.test(k) ? k : JSON.stringify(k)}: ${valueLiteral(v)}`)
    }
  }
  const ctx = []
  if (mode) ctx.push(`mode: '${mode}'`)
  if (fields.length) ctx.push(`options: { ${fields.join(', ')} }`)
  const tail = ctx.length ? `, { ${ctx.join(', ')} }` : ''
  const oneLine = `const result = await runTool('${id}', input${tail})`
  if (oneLine.length <= 100) return [...pre, oneLine]
  const lines = [`const result = await runTool('${id}', input, {`]
  if (mode) lines.push(`  mode: '${mode}',`)
  if (fields.length) lines.push('  options: {', ...fields.map((f) => `    ${f},`), '  },')
  lines.push('})')
  return [...pre, ...lines]
}

function runToolSnippet({ id, spec, ex, mode, idSuffix, note }) {
  const hasInput = ex.input !== ''
  const lines = [`import { runTool } from '@smartdevutils/core/tools'`, '']
  if (note) lines.push(`// ${note}`)
  lines.push(`const input = ${hasInput ? literal(ex.input) : "''"}${hasInput ? '' : ' // this tool generates from its options'}`)
  lines.push(...runToolCall(id, mode, ex.options))
  lines.push('')
  lines.push(`if (result.error) console.error(result.error)`)
  lines.push(`else console.log(result.output)`)
  if (spec.output === 'report') lines.push(`// The same findings as data: result.meta`)
  return {
    id: `run-${idSuffix}`,
    title: ex.label,
    lang: 'ts',
    code: lines.join('\n') + '\n',
    mode: 'run',
    output: 'console',
    description: ex.fallback
        ? 'Built-in example (the website examples were not available at build time).'
        : 'Example from the tool’s page on smartdevutils.com.',
    source: 'generated',
    ...(spec.runtime?.length ? {} : { node: true }),
  }
}

/** Joins phrases as sentences without doubling full stops. */
function sentences(...parts) {
  const kept = parts.filter(Boolean).map((p) => String(p).trim().replace(/\.$/, ''))
  return kept.length ? `${kept.join('. ')}.` : ''
}

function mdEscape(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function toolDocs(spec, entry, usedExamples) {
  const parts = []
  if (entry?.description) parts.push(entry.description)
  parts.push(
    [
      `| | |`,
      `|---|---|`,
      `| Tool id | \`${spec.id}\` |`,
      `| Website | [smartdevutils.com/tools/${spec.slug}](${WEB}${spec.slug}) |`,
      `| Category | ${spec.category} |`,
      `| Type | ${spec.toolType} |`,
      `| Input | ${spec.input.kind}${spec.input.label ? ` (${mdEscape(spec.input.label)})` : ''} |`,
      `| Output | ${spec.output === 'report' ? 'report: readable text in `output`, the same findings as data in `meta`' : 'text'} |`,
      `| Runs in | ${spec.runtime?.length ? spec.runtime.join(', ') : 'anywhere: Node 20.19+, browsers, workers, edge'} |`,
      `| Direct import | \`@smartdevutils/core/tools/${spec.id}\` |`,
    ].join('\n'),
  )
  if (spec.modes.length) {
    parts.push(
      `### Modes\n\n| Mode | Label | Input | Output |\n|---|---|---|---|\n` +
        spec.modes
          .map((m) => `| \`${m.id}\`${m.id === spec.defaultMode ? ' (default)' : ''} | ${mdEscape(m.label)} | ${mdEscape(m.inputLabel ?? '')} | ${mdEscape(m.outputLabel ?? '')} |`)
          .join('\n'),
    )
  } else {
    parts.push('### Modes\n\nThis tool has a single mode: leave `mode` out.')
  }
  if (spec.options.length) {
    parts.push(
      `### Options\n\n| Key | Type | Default | Choices | Modes | Notes |\n|---|---|---|---|---|---|\n` +
        spec.options
          .map(
            (o) =>
              `| \`${o.key}\` | ${o.type} | ${o.default === undefined ? '' : `\`${mdEscape(JSON.stringify(o.default))}\``} | ${(o.choices ?? []).map((c) => `\`${c.value}\``).join(', ')} | ${(o.modes ?? []).join(', ')} | ${mdEscape(sentences(o.label, o.description))}${o.min !== undefined || o.max !== undefined ? ` (${o.min ?? ''} to ${o.max ?? ''})` : ''} |`,
          )
          .join('\n'),
    )
  } else {
    parts.push('### Options\n\nNone.')
  }
  if (usedExamples.length) {
    parts.push(`### Examples\n\n${usedExamples.map((e) => `- ${e}`).join('\n')}`)
  }
  parts.push(
    'A runner never throws for bad input: problems come back as `result.error`. Blank input gives `{ output: "" }` (generators excepted).',
  )
  return parts.join('\n\n')
}

/**
 * @returns {Promise<{ runnable: object, website: object, stats: object }>} two DocSections and stats
 */
export async function buildToolSections() {
  const { examples, source, error } = loadToolExamples()
  const catalogById = new Map(TOOL_CATALOG.map((t) => [t.id, t]))
  const stats = { examplesSource: source, examplesError: error, websiteExamplesUsed: 0, fallbacks: 0, dropped: [] }
  const runnableItems = []
  for (const spec of TOOL_SPECS) {
    const entry = catalogById.get(spec.id)
    const candidates = (examples[spec.id] ?? []).map(toExample)
    const working = []
    for (const ex of candidates) {
      if (working.length >= MAX_EXAMPLES) break
      if (ex.input.length > MAX_SNIPPET_INPUT) continue
      const res = await tryRun(spec.id, ex.input, undefined, ex.options)
      if (res) working.push({ ...ex, result: res })
      else stats.dropped.push(`${spec.id}: "${ex.label}"`)
    }
    if (!working.length) {
      const fb = FALLBACK_INPUTS[spec.id]
      const ex = { ...fb, options: fb?.options ?? {}, fallback: true }
      const res = fb ? await tryRun(spec.id, ex.input, undefined, ex.options) : null
      if (res) working.push({ ...ex, result: res })
      stats.fallbacks++
    } else {
      stats.websiteExamplesUsed += working.length
    }
    const snippets = working.map((ex, i) => runToolSnippet({ id: spec.id, spec, ex, idSuffix: i + 1 }))
    // Other modes (decode, minify, other hashes), from the first example or from its output.
    const first = working[0]
    if (first) {
      const others = spec.modes.map((m) => m.id).filter((m) => m !== (spec.defaultMode ?? spec.modes[0]?.id))
      let added = 0
      for (const mode of others) {
        if (added >= MAX_EXTRA_MODES) break
        // Bidirectional tools (decode, …) run the first output back; other modes reuse the same input.
        const inputs = spec.toolType === 'bidirectional' ? [first.result.output, first.input] : [first.input, first.result.output]
        for (const input of inputs) {
          if (!input || input.length > MAX_SNIPPET_INPUT) continue
          const res = await tryRun(spec.id, input, mode, first.options)
          if (res) {
            snippets.push(
              runToolSnippet({
                id: spec.id,
                spec,
                ex: { ...first, input, label: `${spec.modes.find((m) => m.id === mode)?.label ?? mode}: ${first.label}` },
                mode,
                idSuffix: mode,
                note: input === first.result.output ? `The ${spec.defaultMode ?? 'first'} output of "${first.label}", run back through ${mode}.` : undefined,
              }),
            )
            added++
            break
          }
        }
      }
    }
    runnableItems.push({
      id: spec.id,
      name: spec.name,
      kind: 'tool',
      module: '@smartdevutils/core/tools',
      summary: entry?.description || `${spec.name} as a headless runner.`,
      docs: toolDocs(spec, entry, working.map((w) => w.label)),
      signature: `runTool('${spec.id}', input${spec.modes.length > 1 ? `, { mode: '${spec.defaultMode ?? spec.modes[0].id}' }` : ''})`,
      params: [
        { name: 'input', type: 'string', optional: spec.input.kind === 'none', description: `Input (${spec.input.kind}).` },
        ...spec.options.map((o) => ({
          name: `options.${o.key}`,
          type: o.choices?.length ? o.choices.map((c) => `'${c.value}'`).join(' | ') : o.type,
          optional: true,
          description: sentences(o.label, o.description, o.default === undefined ? '' : `Default: \`${JSON.stringify(o.default)}\``),
        })),
      ],
      returns: 'Promise<ToolRunResult>',
      webUrl: `${WEB}${spec.slug}`,
      ...(spec.runtime?.length ? { runtime: [...spec.runtime] } : {}),
      snippets,
    })
  }
  const runnableIds = new Set(TOOL_SPECS.map((s) => s.id))
  const websiteItems = TOOL_CATALOG.filter((t) => !runnableIds.has(t.id))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map((t) => ({
      id: t.id,
      name: t.name,
      kind: 'tool',
      module: '@smartdevutils/core/tools/catalog',
      summary: t.description || t.name,
      docs: [
        t.description,
        `Website only for now: [${t.name}](${WEB}${t.slug}) runs on smartdevutils.com. It has no headless runner in \`@smartdevutils/core/tools\` yet; its catalog entry (\`findToolById('${t.id}')\`) is available.`,
        `Category: ${t.category}. Type: ${t.toolType}.${t.modes.length ? ` Modes: ${t.modes.map((m) => `\`${m.id}\``).join(', ')}.` : ''}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      webUrl: `${WEB}${t.slug}`,
      snippets: [],
    }))
  const byCat = new Map()
  for (const t of TOOL_CATALOG) if (!runnableIds.has(t.id)) byCat.set(t.category, (byCat.get(t.category) ?? 0) + 1)
  return {
    runnable: {
      id: 'tools',
      title: `Runnable tools (${runnableItems.length})`,
      kind: 'tools',
      markdown: [
        'Each of these website tools runs headless through `runTool(id, input, { mode, options })` from `@smartdevutils/core/tools`, with the same modes and options as on smartdevutils.com. The examples are the ones on each tool’s page.',
        'A runner never throws for bad input: problems come back as `error`. `output: \'report\'` tools return a readable report in `output` and the findings as data in `meta`.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      items: runnableItems,
    },
    website: {
      id: 'website-tools',
      title: `Website-only tools (${websiteItems.length})`,
      kind: 'tools',
      markdown: `These ${websiteItems.length} tools run on smartdevutils.com but do not have a headless runner in \`@smartdevutils/core\` yet. Their catalog entries (id, slug, name, category, modes) are in \`TOOL_CATALOG\` from \`@smartdevutils/core/tools/catalog\`. Runners are added in batches.\n\n| Category | Tools |\n|---|---|\n${[...byCat].map(([c, n]) => `| ${c} | ${n} |`).join('\n')}`,
      items: websiteItems,
    },
    stats,
  }
}
