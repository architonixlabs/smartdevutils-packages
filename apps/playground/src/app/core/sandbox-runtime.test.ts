// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { MAX_MESSAGE_TEXT } from './sandbox-protocol'
import { formatArgs, formatValue, splitHtml, truncate } from './sandbox-runtime'

describe('formatValue', () => {
  it('formats primitives', () => {
    expect(formatValue('a')).toBe('"a"')
    expect(formatValue(1.5)).toBe('1.5')
    expect(formatValue(10n)).toBe('10n')
    expect(formatValue(undefined)).toBe('undefined')
    expect(formatValue(null)).toBe('null')
    expect(formatValue(Symbol('s'))).toBe('Symbol(s)')
    expect(formatValue(function named() {})).toBe('[Function named]')
  })

  it('formats objects, arrays, maps and sets', () => {
    expect(formatValue({ a: 1, 'b-c': [true, 'x'] })).toBe('{ a: 1, "b-c": [ true, "x" ] }')
    expect(formatValue(new Map([['k', 1]]))).toBe('Map(1) { "k" => 1 }')
    expect(formatValue(new Set([1, 2]))).toBe('Set(2) { 1, 2 }')
    expect(formatValue(new Uint8Array([1, 2]))).toBe('Uint8Array(2) [ 1, 2 ]')
    expect(formatValue(new Date(0))).toBe('1970-01-01T00:00:00.000Z')
    expect(formatValue([])).toBe('[]')
  })

  it('survives cycles, depth, throwing getters and DOM nodes', () => {
    const a: Record<string, unknown> = { name: 'a' }
    a['self'] = a
    expect(formatValue(a)).toBe('{ name: "a", self: [Circular] }')
    let deep: unknown = 1
    for (let i = 0; i < 20; i++) deep = { d: deep }
    expect(formatValue(deep)).toContain('[Object]')
    const bad = Object.defineProperty({}, 'x', { enumerable: true, get: () => { throw new Error('no') } })
    expect(formatValue(bad)).toBe('[Unprintable]')
    const el = document.createElement('b')
    el.textContent = 'hi'
    expect(formatValue(el)).toBe('<b>hi</b>')
  })

  it('formats errors with their stack', () => {
    expect(formatValue(new TypeError('bad'))).toContain('TypeError: bad')
  })

  it('truncates long output', () => {
    const out = formatValue('x'.repeat(MAX_MESSAGE_TEXT * 2))
    expect(out.length).toBe(MAX_MESSAGE_TEXT)
    expect(out.endsWith('(truncated)')).toBe(true)
    expect(truncate('short')).toBe('short')
  })
})

describe('formatArgs', () => {
  it('joins console arguments like a browser console', () => {
    expect(formatArgs(['hash:', 'abc', { n: 1 }, 2])).toBe('hash: abc { n: 1 } 2')
  })
})

describe('splitHtml', () => {
  it('keeps the markup and returns inline module scripts in order', () => {
    const out = splitHtml(
      '<sdu-base64 value="hi"></sdu-base64><script type="module">import "@smartdevutils/elements"</script><p>x</p><script type="module">console.log(2)</script>',
      document,
    )
    expect(out.html).toBe('<sdu-base64 value="hi"></sdu-base64><p>x</p>')
    expect(out.modules).toEqual(['import "@smartdevutils/elements"', 'console.log(2)'])
    expect(out.skipped).toBe(0)
  })

  it('drops classic and external scripts without running them', () => {
    const out = splitHtml('<script>alert(1)</script><script type="module" src="x.js"></script><div></div>', document)
    expect(out.html).toBe('<div></div>')
    expect(out.modules).toEqual([])
    expect(out.skipped).toBe(2)
  })
})
