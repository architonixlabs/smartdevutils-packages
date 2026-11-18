import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defineRunner, type ToolRunner, type ToolSpec } from '@smartdevutils/core/tools'
import {
  BUILTIN_RECIPES,
  RECIPE_RUN_SCHEMA,
  RUN_VALUE_MAX,
  STOP_REASONS,
  buildRunFile,
  describeStep,
  getRecipe,
  isRunnable,
  missingRunners,
  readRunFile,
  recipeSteps,
  rerunFile,
  resolveSteps,
  runFileText,
  runRecipe,
  runSteps,
  runnableRecipes,
} from './index'

// A run file in the exact shape the website's "Download run" writes (buildRunFile in recipe-run.ts).
const WEBSITE_FILE = readFileSync(resolve(__dirname, 'fixtures/website-run-decode-base64-json-param.json'), 'utf8')

const fakeSpec = (id: string, output: 'text' | 'report' = 'text'): ToolSpec => ({
  id, slug: id, name: id, category: 'test', toolType: output === 'report' ? 'analyzer' : 'single',
  modes: [], input: { kind: 'text' }, options: [], output,
})
const fake = (id: string, fn: (s: string) => { output: string; error?: string }, output: 'text' | 'report' = 'text'): ToolRunner =>
  defineRunner(fakeSpec(id, output), (s) => fn(s))

function fakes(map: Record<string, ToolRunner>) {
  return {
    hasRunner: (id: string) => id in map,
    loadRunner: async (id: string) => map[id],
  }
}
const step = (id: string) => ({ toolId: id, slug: id, name: id })

describe('runnable recipes', () => {
  it('knows which built-ins run headless with the runners in core today', () => {
    const ids = runnableRecipes().map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(['decode-base64-json-param', 'json-to-base64-env']))
    for (const r of BUILTIN_RECIPES) expect(isRunnable(r)).toBe(missingRunners(r).length === 0)
  })

  it('runs decode-base64-json-param on its sample', async () => {
    const run = await runRecipe(getRecipe('decode-base64-json-param')!)
    expect(run.stopped).toBeUndefined()
    expect(run.basedOn).toBe('decode-base64-json-param')
    expect(run.steps.map((s) => s.mode)).toEqual(['decode', 'decode', undefined])
    expect(run.trace.map((t) => t!.output)).toEqual([
      'eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIn0=',
      '{"user":"ada","role":"admin"}',
      '{\n  "user": "ada",\n  "role": "admin"\n}',
    ])
  })

  it('runs json-to-base64-env: minify then encode', async () => {
    const recipe = getRecipe('json-to-base64-env')!
    const run = await runRecipe(recipe)
    expect(run.stopped).toBeUndefined()
    const minified = JSON.stringify(JSON.parse(recipe.sample))
    expect(run.trace[0]!.output).toBe(minified)
    expect(Buffer.from(run.trace[1]!.output, 'base64').toString('utf8')).toBe(minified)
  })

  it('every runnable built-in finishes on its own sample', async () => {
    for (const r of runnableRecipes()) {
      const run = await runRecipe(r)
      expect(run.stopped, r.id).toBeUndefined()
      expect(run.trace.every((t) => t && !t.error), r.id).toBe(true)
    }
  })

  it('stops before a tool that has no runner, without running it', async () => {
    const recipe = getRecipe('inspect-gzipped-payload')!
    expect(isRunnable(recipe)).toBe(false)
    expect(missingRunners(recipe)).toEqual(['gzip-compressor'])
    const run = await runRecipe(recipe)
    expect(run.stopped?.index).toBe(0)
    expect(run.stopped?.reason).toMatch(/cannot run headless yet/)
    expect(run.trace).toEqual([null, null])
  })

  it('applies the recipe modes and options to the steps, as the website plan does', () => {
    const steps = recipeSteps(getRecipe('query-csv-with-jsonpath')!)
    expect(steps[0]).toMatchObject({ toolId: 'json-csv-converter', mode: 'csv-to-json' })
    expect(steps[1].options).toEqual({ expression: "$[?(@.plan == 'pro')].name" })
  })
})

describe('stop rules (same as the website replay)', () => {
  it('stops on an error and records it', async () => {
    const map = { a: fake('a', (s) => ({ output: s + '!' })), b: fake('b', () => ({ output: '', error: 'bad input' })), c: fake('c', (s) => ({ output: s })) }
    const run = await runSteps('t', [step('a'), step('b'), step('c')], 'x', fakes(map))
    expect(run.stopped).toEqual({ index: 1, reason: STOP_REASONS.error('bad input') })
    expect(run.trace[1]).toEqual({ input: 'x!', output: '', error: 'bad input' })
    expect(run.trace[2]).toBeNull()
  })

  it('stops when a step gives no output', async () => {
    const map = { a: fake('a', () => ({ output: '' })), b: fake('b', (s) => ({ output: s })) }
    const run = await runSteps('t', [step('a'), step('b')], 'x', fakes(map))
    expect(run.stopped).toEqual({ index: 0, reason: STOP_REASONS.noOutput })
  })

  it('a report tool ends the run: done when last, stopped when not', async () => {
    const map = { a: fake('a', (s) => ({ output: s })), r: fake('r', () => ({ output: 'Report' }), 'report') }
    const done = await runSteps('t', [step('a'), step('r')], 'x', fakes(map))
    expect(done.stopped).toBeUndefined()
    expect(done.trace[1]).toEqual({ input: 'x', output: 'Report', noOutputPanel: true })
    const stopped = await runSteps('t', [step('r'), step('a')], 'x', fakes(map))
    expect(stopped.stopped).toEqual({ index: 0, reason: STOP_REASONS.report })
  })

  it('caps stored values but pipes the full value on', async () => {
    const big = 'y'.repeat(RUN_VALUE_MAX + 10)
    let seen = 0
    const map = { a: fake('a', () => ({ output: big })), b: fake('b', (s) => { seen = s.length; return { output: 'ok' } }) }
    const run = await runSteps('t', [step('a'), step('b')], 'x', fakes(map))
    expect(seen).toBe(big.length)
    expect(run.trace[0]!.output.length).toBe(RUN_VALUE_MAX)
    expect(run.trace[0]!.truncated).toBe(true)
    expect(run.trace[1]!.truncated).toBe(true)
  })

  it('calls onStep for every step that ran, and honours an aborted signal', async () => {
    const seen: number[] = []
    const map = { a: fake('a', (s) => ({ output: s })) }
    await runSteps('t', [step('a'), step('a')], 'x', { ...fakes(map), onStep: (i) => seen.push(i) })
    expect(seen).toEqual([0, 1])
    const ac = new AbortController()
    ac.abort()
    const run = await runSteps('t', [step('a')], 'x', { ...fakes(map), signal: ac.signal })
    expect(run.stopped).toEqual({ index: 0, reason: STOP_REASONS.cancelled })
  })

  it('resolves steps by id or slug and rejects unknown tools', () => {
    const s = resolveSteps([{ slug: 'json-formatter-validator-minifier-beautifier', mode: 'minify' }, { toolId: 'url-encoder-decoder' }])
    expect(s.map((x) => x.toolId)).toEqual(['json-formatter', 'url-encoder-decoder'])
    expect(() => resolveSteps([{ toolId: 'nope' }])).toThrow(/unknown tool/)
  })
})

describe('run files (sdu-recipe-run/1)', () => {
  it('reads a run file downloaded from the website', () => {
    const read = readRunFile(WEBSITE_FILE)
    if ('error' in read) throw new Error(read.error)
    expect(read.notes).toEqual([])
    expect(read.run.basedOn).toBe('decode-base64-json-param')
    expect(read.run.steps.map((s) => s.toolId)).toEqual(['url-encoder-decoder', 'base64-encoder-decoder', 'json-formatter'])
    expect(read.run.steps[0].name).toBe('URL Encoder Decoder')
  })

  it('re-runs a website file headless and gets the same trace', async () => {
    const res = await rerunFile(WEBSITE_FILE)
    if ('error' in res) throw new Error(res.error)
    const original = JSON.parse(WEBSITE_FILE)
    expect(res.run.stopped).toBeUndefined()
    expect(res.run.trace).toEqual(original.trace)
  })

  it('writes a file the website reads back (round trip)', async () => {
    const run = await runRecipe(getRecipe('decode-base64-json-param')!)
    const now = new Date('2026-11-18T10:00:00.000Z')
    const file = buildRunFile(run, now)
    expect(file.schema).toBe(RECIPE_RUN_SCHEMA)
    expect(file.exportedAt).toBe('2026-11-18T10:00:00.000Z')
    // Same fields as the website file, nothing extra.
    expect(Object.keys(file).sort()).toEqual(Object.keys(JSON.parse(WEBSITE_FILE)).sort())
    expect(file.steps).toEqual(JSON.parse(WEBSITE_FILE).steps)
    expect(file.trace).toEqual(JSON.parse(WEBSITE_FILE).trace)

    const back = readRunFile(runFileText(run, now))
    if ('error' in back) throw new Error(back.error)
    expect(back.run.steps).toEqual(run.steps)
    expect(back.run.trace).toEqual(run.trace)
    expect(back.run.basedOn).toBe(run.basedOn)
  })

  it('keeps a stopped run readable, with the not-reached steps as null', async () => {
    const run = await runRecipe(getRecipe('inspect-gzipped-payload')!)
    const back = readRunFile(runFileText(run))
    if ('error' in back) throw new Error(back.error)
    expect(back.run.trace).toEqual([null, null])
    expect(back.notes).toContain('The file has no input for step 1; add one before re-running.')
  })

  it('rejects files that are not run files', async () => {
    expect(readRunFile('{"schema":"sdu-recipes/1"}')).toEqual({ error: expect.stringMatching(/not a SmartDevUtils recipe run/) })
    expect(await rerunFile('nope')).toEqual({ error: 'That file is not valid JSON.' })
  })

  it('describes each step the way the run summary does', async () => {
    const run = await runRecipe(getRecipe('decode-base64-json-param')!)
    const t = run.trace[1]!
    expect(describeStep(t.input, t.output).headline).toBe(
      'Base64 (29 bytes decoded) became JSON object, 2 keys; 40 -> 29 characters.',
    )
  })
})
