// The Elements section: one item per custom element tag, from packages/elements/custom-elements.json.
import fs from 'node:fs'
import path from 'node:path'
import { NAMED_TOOL_ELEMENTS } from '@smartdevutils/elements/tools'
import { firstSentence } from './api.mjs'

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()

function splitDescription(desc) {
  const text = (desc ?? '').replace(/\r\n/g, '\n').trim()
  const paras = text.split(/\n\s*\n/)
  // The first paragraph is often just a usage tag: `<sdu-tool tool="…">`.
  const usage = /^`(<sdu-[^`]+>)`(?::\s*(.*))?$/s.exec(paras[0] ?? '')
  if (usage) {
    const rest = [usage[2], ...paras.slice(1)].filter(Boolean).join('\n\n')
    return { usage: usage[1], body: rest }
  }
  return { usage: undefined, body: text }
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function table(head, rows) {
  if (!rows.length) return ''
  return `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`
}

function memberDocs(decl, { skip = [] } = {}) {
  const attrs = (decl.attributes ?? []).filter((a) => !skip.includes(a.name))
  const members = (decl.members ?? []).filter((m) => m.privacy !== 'private' && m.privacy !== 'protected' && !m.static && !m.name.startsWith('_'))
  const fields = members.filter((m) => m.kind === 'field' && !skip.includes(m.name))
  const methods = members.filter((m) => m.kind === 'method' && m.name !== 'syncScheme')
  const byAttr = new Map(fields.filter((f) => f.attribute).map((f) => [f.attribute, f]))
  const parts = []
  const attrRows = attrs.map((a) => {
    const f = byAttr.get(a.name) ?? {}
    return [`\`${a.name}\``, f.name && f.name !== a.name ? `\`${f.name}\`` : '', esc(a.type?.text ?? f.type?.text), f.default ? `\`${esc(f.default)}\`` : '', esc(a.description ?? f.description)]
  })
  if (attrRows.length) parts.push(`### Attributes\n\n${table(['Attribute', 'Property', 'Type', 'Default', 'Description'], attrRows)}`)
  const propRows = fields
    .filter((f) => !f.attribute)
    .map((f) => [`\`${f.name}\``, esc(f.type?.text), f.readonly ? 'read-only' : '', esc(f.description)])
  if (propRows.length) parts.push(`### Properties\n\n${table(['Property', 'Type', '', 'Description'], propRows)}`)
  const methodRows = methods.map((m) => [
    `\`${m.name}(${(m.parameters ?? []).map((p) => `${p.name}${p.optional ? '?' : ''}`).join(', ')})\``,
    esc(m.return?.type?.text),
    esc(m.description),
  ])
  if (methodRows.length) parts.push(`### Methods\n\n${table(['Method', 'Returns', 'Description'], methodRows)}`)
  const eventRows = (decl.events ?? []).map((e) => [`\`${e.name}\``, esc(e.description)])
  if (eventRows.length) parts.push(`### Events\n\nEvents bubble and cross shadow roots.\n\n${table(['Event', 'Description'], eventRows)}`)
  const partRows = (decl.cssParts ?? []).map((p) => [`\`${p.name}\``, esc(p.description)])
  if (partRows.length) parts.push(`### CSS parts\n\nStyle with \`${decl.tagName}::part(name)\`.\n\n${table(['Part', 'Description'], partRows)}`)
  const slotRows = (decl.slots ?? []).map((s) => [`\`${s.name || '(default)'}\``, esc(s.description)])
  if (slotRows.length) parts.push(`### Slots\n\n${table(['Slot', 'Description'], slotRows)}`)
  return {
    markdown: parts.join('\n\n'),
    params: attrs.map((a) => {
      const f = byAttr.get(a.name) ?? {}
      return { name: a.name, type: a.type?.text ?? f.type?.text ?? 'string', optional: a.name !== 'tool' && a.name !== 'recipe', ...(a.description || f.description ? { description: a.description ?? f.description } : {}) }
    }),
  }
}

/** @returns {{ section: object, tags: string[] }} */
export function buildElementsSection(pkgDir) {
  const file = path.join(pkgDir, 'custom-elements.json')
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Build @smartdevutils/elements first (it writes the manifest).`)
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  const decls = []
  for (const mod of manifest.modules ?? []) {
    for (const d of mod.declarations ?? []) if (d.tagName) decls.push({ ...d, modulePath: mod.path })
  }
  const toolDecl = decls.find((d) => d.tagName === 'sdu-tool')
  const items = decls.map((d) => {
    const sub = path.basename(d.modulePath, path.extname(d.modulePath))
    const { usage, body } = splitDescription(d.description)
    const fixedTool = NAMED_TOOL_ELEMENTS[d.tagName]
    let docs
    let params
    if (fixedTool && toolDecl) {
      const inherited = memberDocs(toolDecl, { skip: ['tool'] })
      docs = [
        capitalize(body),
        `\`<${d.tagName}>\` is \`<sdu-tool tool="${fixedTool}">\`: the same attributes, properties, methods and events, without \`tool\`.`,
        inherited.markdown,
      ]
      params = inherited.params
    } else {
      const own = memberDocs(d)
      docs = [capitalize(body), own.markdown]
      params = own.params
    }
    return {
      id: d.tagName,
      name: `<${d.tagName}>`,
      kind: 'element',
      module: `@smartdevutils/elements/${sub}`,
      summary: capitalize(firstSentence(body)) || `The <${d.tagName}> custom element.`,
      docs: [...docs, `Register it with \`import '@smartdevutils/elements/${sub}'\`, or every element with \`import '@smartdevutils/elements'\`. JavaScript class: \`${d.name}\`.`]
        .filter(Boolean)
        .join('\n\n'),
      signature: usage ?? (fixedTool ? `<${d.tagName} mode="…" value="…"></${d.tagName}>` : `<${d.tagName}></${d.tagName}>`),
      params,
      snippets: [],
      _className: d.name,
      _fixedTool: fixedTool,
    }
  })
  return {
    section: {
      id: 'elements',
      title: 'Elements',
      kind: 'elements',
      markdown:
        'Custom elements built with Lit. They work in plain HTML and in any framework. Load them once with `import \'@smartdevutils/elements\'` (or one subpath per element), or from the CDN bundle `dist/cdn/sdu-elements.js`. Restyle with the `--sdu-*` tokens from `@smartdevutils/theme` and `::part()`.',
      items,
    },
  }
}
