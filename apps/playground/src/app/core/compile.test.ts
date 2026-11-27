import { describe, expect, it } from 'vitest'
import { CompileError, compileSnippet, REACT_ROOT_HTML, toCompileError } from './compile'

describe('compileSnippet', () => {
  it('strips TypeScript types and keeps bare imports', async () => {
    const out = await compileSnippet(
      'ts',
      "import type { X } from 'x'\nimport { toBase64 } from '@smartdevutils/core/encoding'\nconst a: number = 1\nconsole.log(toBase64('hi') as string, a)\n",
    )
    expect(out.html).toBeUndefined()
    expect(out.code).toContain("from '@smartdevutils/core/encoding'")
    expect(out.code).not.toContain("from 'x'")
    expect(out.code).not.toContain(': number')
    expect(out.code).not.toContain('as string')
  })

  it('compiles TSX with the automatic production JSX runtime and a React root', async () => {
    const out = await compileSnippet('tsx', 'const App = (p: { n: number }) => <p>{p.n}</p>\nexport default App\n')
    expect(out.html).toBe(REACT_ROOT_HTML)
    expect(out.code).toContain('"react/jsx-runtime"')
    expect(out.code).not.toContain('jsx-dev-runtime')
    expect(out.code).not.toContain('<p>')
  })

  it('passes JavaScript through unchanged', async () => {
    const src = 'export default 1 + 1\n'
    expect(await compileSnippet('js', src)).toEqual({ code: src })
  })

  it('returns html as the preview body with no code', async () => {
    const src = '<sdu-base64></sdu-base64>'
    expect(await compileSnippet('html', src)).toEqual({ code: '', html: src })
  })

  it('reports a syntax error with a 1-based line and column', async () => {
    const err = await compileSnippet('ts', 'const a = 1\nconst b = (\n').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CompileError)
    const ce = err as CompileError
    expect(ce.message).toBe('Unexpected token')
    expect(ce.line).toBe(3)
    expect(ce.column).toBe(1)
  })

  it('reports a TSX error on the first line', async () => {
    const err = (await compileSnippet('tsx', 'let x = <div>').catch((e: unknown) => e)) as CompileError
    expect(err).toBeInstanceOf(CompileError)
    expect(err.line).toBe(1)
    expect(err.column).toBeGreaterThan(1)
  })
})

describe('toCompileError', () => {
  it('falls back to the message suffix when there is no loc', () => {
    const ce = toCompileError(new Error('Unexpected token (4:7)'))
    expect([ce.message, ce.line, ce.column]).toEqual(['Unexpected token', 4, 7])
  })

  it('handles errors without a position', () => {
    const ce = toCompileError(new Error('boom'))
    expect([ce.message, ce.line, ce.column]).toEqual(['boom', undefined, undefined])
  })
})
