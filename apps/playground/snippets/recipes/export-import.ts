/* ---
title: Export your own recipes and import them again
entry: index/toExportEntry, index/buildRecipeExport, index/parseRecipeImport, index/summariseImport
description: The sdu-recipes/1 file the website's recipe page downloads and uploads. Imports are validated as untrusted input.
node: true
--- */
import { BUILTIN_RECIPES, toExportEntry, buildRecipeExport, parseRecipeImport, summariseImport } from '@smartdevutils/recipes'
import { TOOL_CATALOG } from '@smartdevutils/core/tools/catalog'

const mine = {
  name: 'Read a URL-encoded JSON value',
  description: 'URL-decode, then pretty-print.',
  steps: [{ slug: 'url-encoder-decoder' }, { slug: 'json-formatter-validator-minifier-beautifier' }],
}
console.log(toExportEntry(mine))

const file = buildRecipeExport([mine], BUILTIN_RECIPES, TOOL_CATALOG)
const text = JSON.stringify(file, null, 2)
console.log(text)

const imported = parseRecipeImport(text, { tools: TOOL_CATALOG, builtins: BUILTIN_RECIPES, existing: [], max: 50 })
console.log(summariseImport(imported))

// Importing the same recipe again skips it as a duplicate:
const again = parseRecipeImport(text, { tools: TOOL_CATALOG, builtins: BUILTIN_RECIPES, existing: imported.recipes, max: 50 })
console.log(summariseImport(again))
