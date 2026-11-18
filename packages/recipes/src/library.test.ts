// Adapted from the website's data/recipe-library.vitest.ts. The checks that read the website's
// Angular components (output panels, example listeners, routes) stay in the website repo.
import { describe, expect, it } from 'vitest'
import { findToolById } from '@smartdevutils/core/tools/catalog'
import { BUILTIN_RECIPES } from './library'
import { canPipe } from './pipe'

const tool = (id: string) => findToolById(id)

describe('built-in recipe library', () => {
  it('has 55 recipes with unique kebab-case ids (same ids as the website)', () => {
    const ids = BUILTIN_RECIPES.map((r) => r.id)
    expect(ids.length).toBe(55)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('uses only tools that exist, 2-4 per recipe, with a name and a one-sentence description', () => {
    for (const r of BUILTIN_RECIPES) {
      expect(r.toolIds.length, r.id).toBeGreaterThanOrEqual(2)
      expect(r.toolIds.length, r.id).toBeLessThanOrEqual(4)
      for (const id of r.toolIds) expect(tool(id), `${r.id}: ${id}`).toBeDefined()
      expect(r.name.length, r.id).toBeGreaterThan(0)
      expect(r.name.length, r.id).toBeLessThanOrEqual(80)
      expect(r.description, r.id).toMatch(/^[A-Z].*\.$/)
      expect(r.description.length, r.id).toBeLessThanOrEqual(300)
    }
  })

  it('gives every recipe a synthetic sample for step 1', () => {
    for (const r of BUILTIN_RECIPES) {
      expect(r.sample.trim().length, r.id).toBeGreaterThan(0)
      expect(r.sample.length, r.id).toBeLessThan(2000)
      expect(r.sample, r.id).not.toMatch(/AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk_live_|xox[bap]-/)
    }
  })

  it('pipes every consecutive pair (canPipe)', () => {
    for (const r of BUILTIN_RECIPES) {
      for (let i = 1; i < r.toolIds.length; i++) {
        expect(canPipe(tool(r.toolIds[i - 1])!, tool(r.toolIds[i])!), `${r.id}: ${r.toolIds[i - 1]} -> ${r.toolIds[i]}`).toBe(true)
      }
    }
  })

  it('only names modes that the step tool has', () => {
    for (const r of BUILTIN_RECIPES) {
      for (const [id, mode] of Object.entries(r.modes ?? {})) {
        expect(r.toolIds, `${r.id}: mode for a tool not in the recipe`).toContain(id)
        expect(tool(id)!.modes.map((m) => m.id), `${r.id}: ${id} has no mode ${mode}`).toContain(mode)
      }
    }
  })

  it('only pipes options to a later step of the same recipe', () => {
    for (const r of BUILTIN_RECIPES) {
      for (const id of Object.keys(r.options ?? {})) {
        expect(r.toolIds.indexOf(id), `${r.id}: options for ${id}`).toBeGreaterThan(0)
      }
    }
  })
})
