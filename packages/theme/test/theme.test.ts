import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS module without types
import { COMMON, DARK, LIGHT, TOKEN_NAMES } from '../src/tokens.mjs'
// @ts-expect-error plain JS module without types
import { buildCss, minify } from '../scripts/build.mjs'
import * as dist from '../dist/index.js'

type Palette = Record<string, string>

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('tokens', () => {
  it('every colour token has a light and a dark value', () => {
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort())
    expect(TOKEN_NAMES).toEqual([...Object.keys(COMMON), ...Object.keys(LIGHT)])
  })

  const sets: [string, Palette][] = [
    ['light', LIGHT],
    ['dark', DARK],
  ]
  for (const [name, set] of sets) {
    it(`${name}: text colours meet WCAG AA (4.5:1)`, () => {
      for (const bg of [set.bg, set.surface]) {
        expect(contrast(set.fg, bg)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(set.muted, bg)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(set.accent, bg)).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(set['accent-fg'], set.accent)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(set.danger, set['danger-bg'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(set.fg, set['add-bg'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(set.fg, set['del-bg'])).toBeGreaterThanOrEqual(4.5)
    })

    it(`${name}: the focus ring and input borders stand out from the page`, () => {
      expect(contrast(set.focus, set.bg)).toBeGreaterThanOrEqual(3)
      expect(contrast(set.border, set.bg)).toBeGreaterThanOrEqual(1.4)
    })
  }
})

describe('minify', () => {
  it('keeps selectors, values and strings that matter', () => {
    expect(minify('/* x */ .a > .b , .c {\n  color: red ;\n}')).toBe('.a>.b,.c{color:red}')
    expect(minify(':where([data-theme="dark"]) { --sdu-bg: #000; }')).toBe(':where([data-theme="dark"]){--sdu-bg:#000}')
    expect(minify('.a :focus-visible { outline: 0 }')).toBe('.a :focus-visible{outline:0}')
  })
})

describe('generated css', () => {
  const css = buildCss()

  it('tokens.css has zero-specificity light, dark media and [data-theme] blocks', () => {
    expect(css.tokens).toContain(':where(:root), :where([data-theme="light"])')
    expect(css.tokens).toContain('@media (prefers-color-scheme: dark)')
    expect(css.tokens).toContain(':where([data-theme="dark"])')
    for (const k of TOKEN_NAMES) expect(css.tokens).toContain(`--sdu-${k}:`)
  })

  it('host.css gives Shadow DOM defaults under --sdu-d-* so page tokens still win', () => {
    expect(css.host).toContain(':host {')
    expect(css.host).toContain(':host([data-sdu-scheme="dark"]), :host([data-theme="dark"])')
    expect(css.host).toContain(':host([data-sdu-scheme="light"]), :host([data-theme="light"])')
    expect(css.host).not.toMatch(/--sdu-(?!d-)[a-z]/)
  })

  it('base.css reads the public token first, then the host default', () => {
    expect(css.base).toContain('--sdu-c-bg: var(--sdu-bg, var(--sdu-d-bg, #ffffff));')
    expect(css.base).not.toMatch(/tailwind|@apply/i)
  })

  it('dist strings match the files built from source', () => {
    expect(dist.stylesCss).toBe(minify(css.styles))
    expect(dist.hostCss).toBe(minify(css.host))
    expect(dist.baseCss).not.toContain('/*')
    expect(dist.TOKENS.dark.bg).toBe(DARK.bg)
  })
})
