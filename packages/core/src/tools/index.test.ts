import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findToolById, findToolBySlug, TOOL_CATALOG } from './catalog-entry'
import { getToolSpec, hasRunner, loadRunner, RUNNABLE_TOOL_IDS, runTool, TOOL_SPECS } from './index'
import { RUNNER_LOADERS } from './loaders'

describe('tool registry', () => {
  it('has one loader per spec and no duplicates', () => {
    expect(new Set(RUNNABLE_TOOL_IDS).size).toBe(TOOL_SPECS.length)
    expect(Object.keys(RUNNER_LOADERS).sort()).toEqual([...RUNNABLE_TOOL_IDS].sort())
  })

  it('registers every runner file in src/tools/runners', () => {
    const files = readdirSync(resolve(__dirname, 'runners'))
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => f.slice(0, -3))
    expect([...RUNNABLE_TOOL_IDS].sort()).toEqual(files.sort())
  })

  it('keeps every spec in line with the website catalog (drift check)', () => {
    for (const spec of TOOL_SPECS) {
      const entry = findToolById(spec.id)
      expect(entry, spec.id).toBeDefined()
      expect(spec.slug, spec.id).toBe(entry!.slug)
      expect(spec.name, spec.id).toBe(entry!.name)
      expect(spec.category, spec.id).toBe(entry!.category)
      expect(spec.toolType, spec.id).toBe(entry!.toolType)
      expect(spec.modes.map((m) => m.id), spec.id).toEqual(entry!.modes.map((m) => m.id))
      if (spec.modes.length) expect(spec.defaultMode, spec.id).toBe(entry!.modes[0].id)
    }
  })

  it('loads every runner, and each runner carries its own spec', async () => {
    for (const id of RUNNABLE_TOOL_IDS) {
      const runner = await loadRunner(id)
      expect(runner.spec).toBe(getToolSpec(id))
      expect(typeof runner.run).toBe('function')
    }
  })

  it('finds runners by slug as well as id', async () => {
    expect(hasRunner('json-formatter-validator-minifier-beautifier')).toBe(true)
    const r = await loadRunner('json-formatter-validator-minifier-beautifier')
    expect(r.spec.id).toBe('json-formatter')
  })

  it('rejects an unknown tool, and runTool reports it as an error', async () => {
    expect(hasRunner('no-such-tool')).toBe(false)
    await expect(loadRunner('no-such-tool')).rejects.toThrow(/No runner/)
    const res = await runTool('no-such-tool', 'x')
    expect(res.output).toBe('')
    expect(res.error).toMatch(/No runner/)
  })

  it('reports an unknown mode instead of guessing', async () => {
    const res = await runTool('base64-encoder-decoder', 'x', { mode: 'rot13' })
    expect(res.error).toMatch(/Unknown mode "rot13"/)
  })

  it('honours an aborted signal', async () => {
    const ac = new AbortController()
    ac.abort()
    const res = await runTool('base64-encoder-decoder', 'x', { signal: ac.signal })
    expect(res.error).toMatch(/cancelled/)
  })

  it('catalog resolves slugs and covers the runnable tools', () => {
    expect(TOOL_CATALOG.length).toBeGreaterThan(200)
    expect(findToolBySlug('url-encoder-decoder')?.id).toBe('url-encoder-decoder')
    expect(new Set(TOOL_CATALOG.map((t) => t.slug)).size).toBe(TOOL_CATALOG.length)
  })
})

describe('form helpers', () => {
  it('filters settings by mode and gives panel labels', async () => {
    const { getToolSpec, optionsForMode, modeLabels, defaultOptions } = await import('./index')
    const hash = getToolSpec('hash-generator')!
    expect(optionsForMode(hash, 'md5').map((o) => o.key)).toEqual(['uppercase'])
    expect(optionsForMode(hash, 'hmac-sha256').map((o) => o.key)).toEqual(['uppercase', 'secretKey'])
    expect(modeLabels(hash, 'sha256')).toEqual({ input: 'Text to Hash', output: 'SHA-256 Hash' })
    expect(defaultOptions(hash)).toEqual({ uppercase: false, secretKey: '' })
  })
})
