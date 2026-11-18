import type { ToolType } from '@smartdevutils/core/tools'

/**
 * What the recipe helpers need to know about a tool. `TOOL_CATALOG` from
 * '@smartdevutils/core/tools/catalog' fits this shape, and so does the website's registry.
 */
export interface RecipeToolInfo {
  id: string
  slug: string
  name: string
  category?: string
  toolType?: ToolType
  keywords?: readonly string[]
  route?: string
  emoji?: string
  modes?: readonly { id: string }[]
}
