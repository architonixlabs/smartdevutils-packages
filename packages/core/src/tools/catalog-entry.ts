/**
 * @smartdevutils/core/tools/catalog: light metadata (id, slug, name, category, tool type,
 * description, modes) for every SmartDevUtils website tool, whether or not it has a runner.
 * Used to resolve the slugs in recipe run files and to list tools. About 25 kB gzipped,
 * so it is a separate entry point.
 */
import { TOOL_CATALOG } from './catalog'
import type { ToolCatalogEntry } from './types'

export { TOOL_CATALOG }
export type { ToolCatalogEntry, ToolModeSpec, ToolType } from './types'

let ids: Map<string, ToolCatalogEntry> | undefined
let slugs: Map<string, ToolCatalogEntry> | undefined

export function findToolById(id: string): ToolCatalogEntry | undefined {
  ids ??= new Map(TOOL_CATALOG.map((t) => [t.id, t]))
  return ids.get(id)
}

export function findToolBySlug(slug: string): ToolCatalogEntry | undefined {
  slugs ??= new Map(TOOL_CATALOG.map((t) => [t.slug, t]))
  return slugs.get(slug)
}
