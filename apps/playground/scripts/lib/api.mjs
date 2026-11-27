// Reads the public API of a package from its built .d.ts files with the TypeScript compiler API.
// One call per package: every export subpath becomes a list of raw API entries (name, kind,
// signature, params, JSDoc). The orchestrator turns them into DocSections.
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const MAX_SIGNATURE_LINES = 40

/** First sentence of a JSDoc body (or its first line when there is no full stop). */
export function firstSentence(text) {
  const paras = (text ?? '').trim().split(/\r?\n\s*\r?\n/).map((p) => p.replace(/\s*\r?\n\s*/g, ' ').trim())
  // Skip a leading usage line that is only code, such as `<sdu-tool tool="…">`.
  while (paras.length > 1 && /^`[^`]+`:?$/.test(paras[0])) paras.shift()
  const para = paras[0] ?? ''
  if (!para) return ''
  // A full stop that ends a sentence: followed by a space and a capital/backtick/quote, or the end.
  const m = /^(.+?[.!?])(?=\s+[A-Z`"'(<]|\s*$)/.exec(para)
  const s = (m ? m[1] : para).trim()
  return s.length > 240 ? `${s.slice(0, 237).trimEnd()}...` : s
}

function stripExportDeclare(text) {
  return text.replace(/^(export\s+)?(declare\s+)?(default\s+)?/, '').trim()
}

function clampLines(text, max = MAX_SIGNATURE_LINES) {
  const lines = text.split(/\r?\n/)
  if (lines.length <= max) return text
  return `${lines.slice(0, max).join('\n')}\n    // … ${lines.length - max} more lines`
}

/** Removes JSDoc comments inside a printed declaration (the docs show them separately). */
function stripComments(text) {
  return text
    .replace(/\/\*\*[\s\S]*?\*\/\s*/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n{2,}/g, '\n')
}

function tagText(tag) {
  if (!tag.text) return ''
  return typeof tag.text === 'string' ? tag.text : ts.displayPartsToString(tag.text)
}

const KNOWN_TAGS = new Set([
  'param', 'returns', 'return', 'example', 'deprecated', 'see', 'remarks', 'throws', 'template', 'typeParam',
  'default', 'defaultValue', 'internal', 'public', 'private', 'readonly', 'since', 'link', 'fires', 'event',
  'slot', 'csspart', 'cssprop', 'attr', 'prop', 'summary', 'module', 'packageDocumentation', 'type',
])

/**
 * The JSDoc text of a symbol. TypeScript reads a package name such as `@smartdevutils/core` in prose
 * as a tag and cuts the text there; such pseudo-tags are put back into the text.
 */
export function symbolDoc(symbol, checker) {
  let body = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
  for (const t of symbol.getJsDocTags(checker)) {
    if (KNOWN_TAGS.has(t.name)) continue
    const text = tagText(t)
    const glued = /^[/\w-]/.test(text) ? `@${t.name}${text}` : `@${t.name} ${text}`
    body = body ? `${body} ${glued}`.trim() : glued.trim()
  }
  return body
}

function docsOf(symbol, checker) {
  const body = symbolDoc(symbol, checker)
  const tags = symbol.getJsDocTags(checker)
  const deprecatedTag = tags.find((t) => t.name === 'deprecated')
  const examples = tags.filter((t) => t.name === 'example').map(tagText)
  const returnsTag = tags.find((t) => t.name === 'returns' || t.name === 'return')
  const remarks = tags.filter((t) => t.name === 'remarks').map(tagText)
  const see = tags.filter((t) => t.name === 'see').map(tagText)
  return {
    body,
    deprecated: deprecatedTag ? tagText(deprecatedTag) || 'Deprecated.' : undefined,
    examples,
    returnsDoc: returnsTag ? tagText(returnsTag) : '',
    remarks,
    see,
    paramDocs: Object.fromEntries(
      tags
        .filter((t) => t.name === 'param')
        .map((t) => {
          const txt = tagText(t)
          const m = /^(\S+)\s*-?\s*([\s\S]*)$/.exec(txt)
          return m ? [m[1], m[2].trim()] : null
        })
        .filter(Boolean),
    ),
  }
}

function composeDocs(d, extra = []) {
  const parts = []
  if (d.body) parts.push(d.body)
  for (const r of d.remarks) parts.push(r)
  if (d.returnsDoc) parts.push(`**Returns:** ${d.returnsDoc}`)
  for (const e of d.examples) {
    const code = e.trim()
    parts.push(code.startsWith('```') ? code : `\`\`\`ts\n${code}\n\`\`\``)
  }
  if (d.see.length) parts.push(`See also: ${d.see.join(', ')}`)
  parts.push(...extra.filter(Boolean))
  return parts.join('\n\n').trim() || undefined
}

function paramName(p) {
  if (ts.isIdentifier(p.name)) return p.name.text
  if (ts.isObjectBindingPattern(p.name)) return 'props'
  return 'arg'
}

function functionParams(decl, checker, paramDocs) {
  return (decl.parameters ?? []).map((p) => {
    const name = paramName(p)
    let type = p.type ? p.type.getText() : checker.typeToString(checker.getTypeAtLocation(p))
    if (p.dotDotDotToken) type = `...${type}`
    const tagDoc = ts
      .getJSDocParameterTags(p)
      .map((t) => (typeof t.comment === 'string' ? t.comment : ts.getTextOfJSDocComment(t.comment) ?? ''))
      .join(' ')
      .trim()
    const description = tagDoc || paramDocs[name] || undefined
    return {
      name: p.dotDotDotToken ? `...${name}` : name,
      type: type.replace(/\s+/g, ' '),
      optional: Boolean(p.questionToken || p.initializer || p.dotDotDotToken),
      ...(description ? { description: description.replace(/^-\s*/, '') } : {}),
    }
  })
}

/** Properties of a props object type (React components), with their JSDoc. */
function propsParams(decl, checker) {
  const p = decl.parameters?.[0]
  if (!p) return []
  const type = checker.getTypeAtLocation(p)
  return checker.getPropertiesOfType(type).map((prop) => {
    const propType = checker.getTypeOfSymbolAtLocation(prop, p)
    const description = symbolDoc(prop, checker)
    const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0
    let typeText = checker.typeToString(propType, p, ts.TypeFormatFlags.NoTruncation)
    if (optional) typeText = typeText.replace(/\s*\|\s*undefined$/, '')
    return { name: prop.getName(), type: typeText, optional, ...(description ? { description } : {}) }
  })
}

const SIGNAL_KINDS = [
  ['ModelSignal', 'model'],
  ['InputSignalWithTransform', 'input'],
  ['InputSignal', 'input'],
  ['OutputEmitterRef', 'output'],
]

function genericArg(text) {
  const i = text.indexOf('<')
  if (i < 0) return text
  let depth = 0
  for (let j = i; j < text.length; j++) {
    if (text[j] === '<') depth++
    else if (text[j] === '>') {
      depth--
      if (depth === 0) {
        const inner = text.slice(i + 1, j)
        // InputSignalWithTransform<T, U>: keep T.
        let d = 0
        for (let k = 0; k < inner.length; k++) {
          const c = inner[k]
          if (c === '<' || c === '{' || c === '(' || c === '[') d++
          else if (c === '>' || c === '}' || c === ')' || c === ']') d--
          else if (c === ',' && d === 0) return inner.slice(0, k).trim()
        }
        return inner.trim()
      }
    }
  }
  return text
}

/** Angular component class: selector from the ɵcmp declaration, inputs/models/outputs from signal members. */
function angularComponent(decl, checker) {
  const cmp = decl.members.find((m) => m.name && m.name.getText() === 'ɵcmp')
  if (!cmp) return null
  const cmpText = cmp.type?.getText() ?? ''
  const sel = /ɵɵComponentDeclaration<\s*\w+\s*,\s*"([^"]+)"/.exec(cmpText)
  const params = []
  for (const m of decl.members) {
    if (!ts.isPropertyDeclaration(m) || !m.name || !ts.isIdentifier(m.name)) continue
    const mods = ts.getCombinedModifierFlags(m)
    if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected | ts.ModifierFlags.Static)) continue
    const typeText = m.type?.getText() ?? ''
    const kind = SIGNAL_KINDS.find(([k]) => typeText.includes(`${k}<`))
    if (!kind) continue
    const sym = checker.getSymbolAtLocation(m.name)
    const description = sym ? symbolDoc(sym, checker) : ''
    const name = m.name.text
    const label = kind[1] === 'model' ? `[(${name})]` : kind[1] === 'output' ? `(${name})` : `[${name}]`
    params.push({
      name: label,
      type: genericArg(typeText).replace(/import\("[^"]+"\)\./g, '').replace(/\s+/g, ' '),
      optional: true,
      ...(description ? { description } : {}),
    })
  }
  // Required inputs: ɵcmp lists `"isRequired": true` per input.
  for (const p of params) {
    const bare = p.name.replace(/[[\]()]/g, '')
    const re = new RegExp(`"${bare}":\\s*\\{[^}]*"isRequired":\\s*true`)
    if (re.test(cmpText)) p.optional = false
  }
  return { selector: sel ? sel[1] : undefined, params }
}

function classSignature(decl, name) {
  const heritage = (decl.heritageClauses ?? []).map((h) => h.getText()).join(' ')
  const members = []
  for (const m of decl.members) {
    if (!m.name) {
      if (ts.isConstructorDeclaration(m)) members.push(`  ${stripComments(m.getText()).trim()}`)
      continue
    }
    const n = m.name.getText()
    if (n.startsWith('ɵ') || n.startsWith('_') || n.startsWith('#')) continue
    const mods = ts.getCombinedModifierFlags(m)
    if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue
    members.push(`  ${stripComments(m.getText()).replace(/\s+/g, ' ').trim()}`)
  }
  return clampLines(`class ${name}${heritage ? ` ${heritage}` : ''} {\n${members.join('\n')}\n}`)
}

function kindOf(decl) {
  if (ts.isFunctionDeclaration(decl)) return 'function'
  if (ts.isClassDeclaration(decl)) return 'class'
  if (ts.isInterfaceDeclaration(decl)) return 'interface'
  if (ts.isTypeAliasDeclaration(decl)) return 'type'
  if (ts.isEnumDeclaration(decl)) return 'enum'
  if (ts.isVariableDeclaration(decl)) return 'const'
  return null
}

function renameDecl(text, declName, exportName) {
  if (!declName || declName === exportName) return text
  return text.replace(new RegExp(`\\b${declName}\\b`), exportName)
}

/** One raw entry per exported name of a module file. */
function entriesOfModule(file, program, checker, opts) {
  const sf = program.getSourceFile(file)
  if (!sf) throw new Error(`d.ts not in program: ${file}`)
  const modSym = checker.getSymbolAtLocation(sf)
  if (!modSym) return []
  const out = []
  for (const exp of checker.getExportsOfModule(modSym)) {
    const name = exp.getName()
    if (name === 'default' || name.startsWith('ɵ') || name.startsWith('_')) continue
    const sym = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp
    const decls = sym.declarations ?? []
    const decl = decls[0]
    if (!decl) continue
    const kind = kindOf(decl)
    if (!kind) continue
    const declFile = decl.getSourceFile().fileName
    const d = docsOf(sym, checker)
    const declName = decl.name && ts.isIdentifier(decl.name) ? decl.name.text : name
    const entry = { name, kind, declFile, summary: firstSentence(d.body), deprecated: d.deprecated }
    if (kind === 'function') {
      const overloads = decls.filter(ts.isFunctionDeclaration)
      entry.signature = overloads
        .map((o) => renameDecl(stripExportDeclare(stripComments(o.getText())).replace(/;\s*$/, ''), declName, name))
        .join('\n')
      const main = overloads[overloads.length - 1]
      const returns = main.type ? main.type.getText().replace(/import\("[^"]+"\)\./g, '') : undefined
      if (opts.isComponent?.(declFile, returns ?? '')) {
        entry.kind = 'component'
        entry.params = propsParams(main, checker)
        entry.signature = `<${name}${entry.params.filter((p) => !p.optional).map((p) => ` ${p.name}={…}`).join('')} />`
      } else {
        entry.params = functionParams(main, checker, d.paramDocs)
        entry.returns = returns
      }
      entry.docs = composeDocs(d)
    } else if (kind === 'class') {
      const ng = ts.isClassDeclaration(decl) ? angularComponent(decl, checker) : null
      if (ng) {
        entry.kind = 'component'
        entry.selector = ng.selector
        entry.params = ng.params
        entry.signature = ng.selector ? `<${ng.selector}>` : `class ${name}`
      } else {
        entry.signature = classSignature(decl, name)
      }
      entry.docs = composeDocs(d)
    } else if (kind === 'const') {
      const typeNode = decl.type
      let typeText = typeNode ? typeNode.getText() : checker.typeToString(checker.getTypeAtLocation(decl))
      typeText = stripComments(typeText).replace(/import\("[^"]+"\)\./g, '')
      const init = decl.initializer && ts.isLiteralExpression(decl.initializer) ? ` = ${decl.initializer.getText()}` : ''
      entry.signature = clampLines(`const ${name}${typeNode || !init ? `: ${typeText}` : ''}${init}`)
      entry.docs = composeDocs(d)
    } else {
      entry.signature = clampLines(renameDecl(stripExportDeclare(stripComments(decl.getText())), declName, name))
      entry.docs = composeDocs(d)
    }
    out.push(entry)
  }
  return out
}

/**
 * Reads every export subpath of a package.
 * @param pkgDir absolute package folder
 * @param subpaths [{ subpath: './encoding', types: 'dist/encoding.d.ts' }]
 * @param opts.isComponent (declFile, returnsText) => boolean
 * @returns Map<subpath, rawEntry[]>
 */
export function readPackageApi(pkgDir, subpaths, opts = {}) {
  const files = subpaths.map((s) => path.join(pkgDir, s.types))
  for (const f of files) if (!fs.existsSync(f)) throw new Error(`Missing ${f}. Build the packages first.`)
  const program = ts.createProgram(files, {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    noEmit: true,
    allowJs: false,
    types: [],
  })
  const checker = program.getTypeChecker()
  const result = new Map()
  subpaths.forEach((s, i) => {
    result.set(s.subpath, entriesOfModule(files[i], program, checker, opts))
  })
  return result
}
