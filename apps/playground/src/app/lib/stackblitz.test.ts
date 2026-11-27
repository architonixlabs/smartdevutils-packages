import { describe, expect, it } from 'vitest'
import { DOCS_FIXTURE } from '../testing/docs.fixture'
import { findEntry } from './docs-lookup'
import { buildStackBlitzProject, dependenciesFor, stackBlitzAction, stackBlitzFormFields } from './stackblitz'
import { bareImports, downloadFileName, fileExtension, packageOf } from './snippet-files'

const V = DOCS_FIXTURE.version

function entry(pkg: string, section: string, id: string) {
  const e = findEntry(DOCS_FIXTURE, pkg, section, id)
  if (!e) throw new Error('fixture entry missing')
  return e
}

describe('snippet files', () => {
  it('maps languages to extensions and safe file names', () => {
    expect(fileExtension('ts')).toBe('ts')
    expect(fileExtension('tsx')).toBe('tsx')
    expect(fileExtension('html')).toBe('html')
    expect(downloadFileName('<sdu-tool>', 'Basic Demo', 'html')).toBe('sdu-tool-basic-demo.html')
    expect(downloadFileName('a/b\\c', '', 'js')).toBe('a-b-c-snippet.js')
  })

  it('finds bare imports only', () => {
    const code = [
      "import { a } from '@smartdevutils/core/encoding'",
      "import type { T } from '@smartdevutils/core'",
      "import './local'",
      "import x from 'node:fs'",
      'import {',
      '  b,',
      '  c,',
      "} from 'react'",
      "import '@smartdevutils/elements/tool'",
      "const m = await import('lz-string')",
      "export * from 'rxjs'",
    ].join('\n')
    expect(bareImports(code).sort()).toEqual(
      ['@smartdevutils/core/encoding', '@smartdevutils/core', 'react', '@smartdevutils/elements/tool', 'rxjs', 'lz-string'].sort(),
    )
    expect(packageOf('@smartdevutils/core/encoding')).toBe('@smartdevutils/core')
    expect(packageOf('lodash/fp')).toBe('lodash')
  })

  it('pins @smartdevutils packages to the exact docs version', () => {
    const deps = dependenciesFor(
      "import { a } from '@smartdevutils/core/x'\nimport React from 'react'\nimport z from 'zod'",
      '1.3.0',
    )
    expect(deps).toEqual({ '@smartdevutils/core': '1.3.0', react: '^18.3.1', zod: 'latest' })
  })
})

describe('buildStackBlitzProject', () => {
  it('ts snippets become a node project', () => {
    const { pkg, item } = entry('core', 'hashing', 'sha256')
    const s = item.snippets[0]
    const p = buildStackBlitzProject({ pkg, item, lang: s.lang, code: s.code, version: V })
    expect(p.template).toBe('node')
    expect(p.files['index.ts']).toBe(s.code)
    const pj = JSON.parse(p.files['package.json'])
    expect(pj.dependencies['@smartdevutils/core']).toBe('1.3.0')
    expect(pj.scripts.start).toContain('index.ts')
    expect(p.dependencies['@smartdevutils/core']).toBe('1.3.0')
    expect(stackBlitzAction(p)).toBe('https://stackblitz.com/run?file=index.ts')
  })

  it('js snippets run with node', () => {
    const { pkg, item } = entry('core', 'encoding', 'base64encode')
    const s = item.snippets[1]
    const p = buildStackBlitzProject({ pkg, item, lang: 'js', code: s.code, version: V })
    expect(Object.keys(p.files)).toEqual(['index.js', 'package.json'])
    expect(JSON.parse(p.files['package.json']).scripts.start).toBe('node index.js')
  })

  it('html snippets become a static project with scripts moved to index.js', () => {
    const { pkg, item } = entry('elements', 'elements', 'sdu-tool')
    const s = item.snippets[0]
    const p = buildStackBlitzProject({ pkg, item, lang: 'html', code: s.code, version: V })
    expect(p.template).toBe('javascript')
    expect(p.files['index.html']).toContain('<sdu-tool tool="base64-encoder-decoder"')
    expect(p.files['index.html']).not.toContain('<script type="module">')
    expect(p.files['index.js']).toContain("import '@smartdevutils/elements/tool'")
    expect(p.files['index.js']).toContain("import '@smartdevutils/theme/styles.css'")
    expect(p.dependencies).toMatchObject({ '@smartdevutils/elements': V, '@smartdevutils/theme': V })
  })

  it('tsx snippets become a Vite React project', () => {
    const { pkg, item } = entry('react', 'components', 'sdutool')
    const s = item.snippets[0]
    const p = buildStackBlitzProject({ pkg, item, lang: 'tsx', code: s.code, version: V })
    expect(p.template).toBe('node')
    expect(p.files['src/App.tsx']).toBe(s.code)
    expect(p.files['src/main.tsx']).toContain("import App from './App'")
    expect(p.files['index.html']).toContain('<div id="root"></div>')
    const pj = JSON.parse(p.files['package.json'])
    expect(pj.dependencies).toMatchObject({ '@smartdevutils/react': V, react: '^18.3.1', 'react-dom': '^18.3.1' })
    expect(pj.devDependencies.vite).toBeDefined()
  })

  it('tsx snippets with a named export or their own createRoot are wired correctly', () => {
    const { pkg, item } = entry('react', 'components', 'sdutool')
    const named = buildStackBlitzProject({
      pkg,
      item,
      lang: 'tsx',
      code: 'export function Tools() { return null }',
      version: V,
    })
    expect(named.files['src/main.tsx']).toContain("import { Tools as App } from './App'")
    const own = buildStackBlitzProject({
      pkg,
      item,
      lang: 'tsx',
      code: "import { createRoot } from 'react-dom/client'\ncreateRoot(document.getElementById('root')!).render(null)",
      version: V,
    })
    expect(own.files['src/main.tsx']).toContain('createRoot')
    expect(own.files['src/App.tsx']).toBeUndefined()
  })

  it('Angular docs snippets become an Angular CLI project', () => {
    const { pkg, item } = entry('angular', 'components', 'sdutoolcomponent')
    const s = item.snippets[0]
    const p = buildStackBlitzProject({ pkg, item, lang: 'ts', code: s.code, version: V })
    expect(p.template).toBe('node')
    expect(p.files['src/app.ts']).toBe(s.code)
    expect(p.files['src/main.ts']).toContain('bootstrapApplication(AppComponent')
    expect(p.files['src/index.html']).toContain('<app-root></app-root>')
    expect(JSON.parse(p.files['angular.json']).projects.demo).toBeDefined()
    const pj = JSON.parse(p.files['package.json'])
    expect(pj.dependencies['@smartdevutils/angular']).toBe(V)
    expect(pj.devDependencies['@angular/cli']).toBeDefined()
  })

  it('produces StackBlitz form fields', () => {
    const { pkg, item } = entry('core', 'hashing', 'sha256')
    const p = buildStackBlitzProject({ pkg, item, lang: 'ts', code: item.snippets[0].code, version: V })
    const fields = stackBlitzFormFields(p)
    const names = fields.map(([n]) => n)
    expect(names.slice(0, 3)).toEqual(['project[title]', 'project[description]', 'project[template]'])
    expect(names).toContain('project[files][index.ts]')
    expect(names).toContain('project[files][package.json]')
    expect(JSON.parse(fields.find(([n]) => n === 'project[dependencies]')![1])).toEqual(p.dependencies)
    expect(p.title).toBe('sha256 — @smartdevutils/core')
  })

  it('escapes titles in generated HTML', () => {
    const { pkg, item } = entry('elements', 'elements', 'sdu-tool')
    const p = buildStackBlitzProject({ pkg, item, lang: 'html', code: '<p>x</p>', version: V })
    expect(p.files['index.html']).toContain('<title>&lt;sdu-tool&gt; — @smartdevutils/elements</title>')
  })
})
