import { afterEach, describe, expect, it, vi } from 'vitest'
import { MERMAID_MAX_TEXT, prefersDark, renderMermaid, setMermaidLoader, svgSize } from './mermaid'
import { downloadText } from './file'

afterEach(() => setMermaidLoader(null))

describe('renderMermaid', () => {
  it('renders with the strict security level and the requested theme', async () => {
    const initialize = vi.fn()
    const render = vi.fn(async (id: string) => ({ svg: `<svg id="${id}" viewBox="0 0 10 20"></svg>` }))
    setMermaidLoader(async () => ({ default: { initialize, render } }))
    const r = await renderMermaid('graph TD; A-->B', { dark: true })
    expect(r.ok).toBe(true)
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict', theme: 'dark', htmlLabels: false }))
    expect(render.mock.calls[0][1]).toBe('graph TD; A-->B')
  })

  it('returns an error for empty or oversized source without loading Mermaid', async () => {
    const loader = vi.fn()
    setMermaidLoader(loader)
    expect(await renderMermaid('  ')).toEqual({ ok: false, error: 'There is no diagram source.' })
    const big = await renderMermaid('x'.repeat(MERMAID_MAX_TEXT + 1))
    expect(big.ok).toBe(false)
    expect(loader).not.toHaveBeenCalled()
  })

  it('turns a Mermaid parse error into { ok: false } and keeps rendering later diagrams', async () => {
    let calls = 0
    setMermaidLoader(async () => ({
      initialize() {},
      async render() {
        calls++
        if (calls === 1) throw new Error('Parse error on line 1:\nbad')
        return { svg: '<svg></svg>' }
      },
    }))
    const [a, b] = await Promise.all([renderMermaid('nope'), renderMermaid('graph TD; A')])
    expect(a).toEqual({ ok: false, error: 'Parse error on line 1:\nbad' })
    expect(b.ok).toBe(true)
  })

  it('retries the loader after a failed load', async () => {
    let n = 0
    setMermaidLoader(async () => {
      if (n++ === 0) throw new Error('offline')
      return { initialize() {}, render: async () => ({ svg: '<svg/>' }) }
    })
    expect((await renderMermaid('graph TD; A')).ok).toBe(false)
    expect((await renderMermaid('graph TD; A')).ok).toBe(true)
  })
})

describe('prefersDark', () => {
  it('uses the nearest data-theme, across a shadow root', () => {
    const outer = document.createElement('div')
    outer.setAttribute('data-theme', 'dark')
    const host = document.createElement('div')
    outer.appendChild(host)
    const inner = document.createElement('span')
    host.attachShadow({ mode: 'open' }).appendChild(inner)
    expect(prefersDark(inner)).toBe(true)
    host.setAttribute('data-theme', 'light')
    expect(prefersDark(inner)).toBe(false)
  })
})

describe('svgSize', () => {
  it('reads the viewBox first, then width and height', () => {
    expect(svgSize('<svg viewBox="0 0 120.5 40">')).toEqual({ width: 121, height: 40 })
    expect(svgSize('<svg width="30" height="20">')).toEqual({ width: 30, height: 20 })
  })
})

describe('downloadText', () => {
  it('clicks a temporary link with the file name', () => {
    const create = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
    let clicked = ''
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this.download
    })
    downloadText('{}', 'run.json', 'application/json')
    expect(clicked).toBe('run.json')
    expect(create).toHaveBeenCalled()
    spy.mockRestore()
  })
})
