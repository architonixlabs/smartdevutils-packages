import { describe, expect, it } from 'vitest'
import { DOCS_FIXTURE } from '../testing/docs.fixture'
import { findEntry } from './docs-lookup'
import { ELEMENTS_CDN, buildIntegrateGuide, importLines } from './integrate'

const V = DOCS_FIXTURE.version
const get = (p: string, s: string, i: string) => findEntry(DOCS_FIXTURE, p, s, i)!

describe('integrate guide', () => {
  it('core functions: install, import, node and html', () => {
    const { pkg, item } = get('core', 'hashing', 'sha256')
    const g = buildIntegrateGuide(pkg, item, V)
    expect(g.install.code).toBe('npm install @smartdevutils/core')
    expect(g.imports.code).toBe("import { sha256 } from '@smartdevutils/core/hashing'")
    expect(g.targets.map((t) => t.target)).toEqual(['node', 'html'])
    expect(g.targets[0].code).toContain("sha256('hello world')")
    expect(g.targets[1].code).toContain(`https://cdn.jsdelivr.net/npm/@smartdevutils/core@${V}/hashing/+esm`)
  })

  it('types use import type and only get the node block', () => {
    const { pkg, item } = get('core', 'hashing', 'hashalgorithm')
    expect(importLines(pkg, item)).toEqual(["import type { HashAlgorithm } from '@smartdevutils/core/hashing'"])
    expect(buildIntegrateGuide(pkg, item, V).targets.map((t) => t.target)).toEqual(['node'])
  })

  it('tools use runTool', () => {
    const { pkg, item } = get('core', 'tools', 'base64-encoder-decoder')
    expect(importLines(pkg, item)).toEqual(["import { runTool } from '@smartdevutils/core/tools'"])
    const g = buildIntegrateGuide(pkg, item, V)
    expect(g.targets.find((t) => t.target === 'html')?.code).toContain("runTool('base64-encoder-decoder'")
  })

  it('elements: CDN html, React and Angular', () => {
    const { pkg, item } = get('elements', 'elements', 'sdu-tool')
    const g = buildIntegrateGuide(pkg, item, V)
    expect(g.imports.code).toBe("import '@smartdevutils/elements/tool'")
    expect(g.targets.map((t) => t.target)).toEqual(['html', 'react', 'angular'])
    const html = g.targets[0].code
    expect(html).toContain(ELEMENTS_CDN(V))
    expect(html).toContain('<sdu-tool')
    expect(html).not.toContain("import '@smartdevutils/elements/tool'")
    expect(g.targets[2].code).toContain('CUSTOM_ELEMENTS_SCHEMA')
  })

  it('react components only offer React', () => {
    const { pkg, item } = get('react', 'components', 'sdutool')
    const g = buildIntegrateGuide(pkg, item, V)
    expect(g.targets.map((t) => t.target)).toEqual(['react'])
    expect(g.targets[0].code).toContain('<SduTool')
  })

  it('angular components reuse the Angular snippet', () => {
    const { pkg, item } = get('angular', 'components', 'sdutoolcomponent')
    const g = buildIntegrateGuide(pkg, item, V)
    expect(g.targets.map((t) => t.target)).toEqual(['angular'])
    expect(g.targets[0].code).toContain('SduToolComponent')
  })
})

describe('integrate guide: data entries', () => {
  const pkgTheme = { ...DOCS_FIXTURE.packages[0], id: 'theme', name: '@smartdevutils/theme', frameworks: ['html', 'react', 'angular'] as const }
  const token = { id: 'sdu-font', name: '--sdu-font', kind: 'const' as const, module: '@smartdevutils/theme/tokens.css', summary: 'x', snippets: [] }
  const recipe = { id: 'r1', name: 'Read a Base64 JSON query parameter', kind: 'const' as const, module: '@smartdevutils/recipes', summary: 'x', signature: "getRecipe('r1')", snippets: [] }
  const catalog = { id: 'color-blindness', name: 'Color Blindness Simulator', kind: 'tool' as const, module: '@smartdevutils/core/tools/catalog', summary: 'x', webUrl: 'https://smartdevutils.com/tools/color-blindness', snippets: [] }

  it('theme tokens use the stylesheet', () => {
    const pkg = { ...pkgTheme, frameworks: [...pkgTheme.frameworks] }
    const g = buildIntegrateGuide(pkg, token, V)
    expect(g.imports.code).toBe("import '@smartdevutils/theme/styles.css'")
    expect(g.targets.map((t) => t.target)).toEqual(['html', 'react', 'angular'])
    expect(g.targets[0].code).toContain('font-family: var(--sdu-font)')
  })

  it('recipes import their accessor', () => {
    const pkg = { ...DOCS_FIXTURE.packages[0], id: 'recipes', name: '@smartdevutils/recipes' }
    expect(importLines(pkg, recipe)).toEqual(["import { getRecipe } from '@smartdevutils/recipes'"])
    expect(buildIntegrateGuide(pkg, recipe, V).targets[0].code).toContain("const value = getRecipe('r1')")
  })

  it('website-only tools point at the catalog', () => {
    const pkg = DOCS_FIXTURE.packages[0]
    const g = buildIntegrateGuide(pkg, catalog, V)
    expect(g.imports.code).toBe("import { findToolById } from '@smartdevutils/core/tools/catalog'")
    expect(g.note).toMatch(/Website only/)
    expect(g.targets.map((t) => t.target)).toEqual(['node'])
  })
})
