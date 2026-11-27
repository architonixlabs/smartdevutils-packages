/* ---
title: Look recipes up against the tool catalog
entry: index/builtinTools, index/builtinSteps, index/recipeSteps, index/filterBuiltins, index/isCustomRecipe
description: These helpers take the tool registry as an argument; TOOL_CATALOG from core is the full one.
node: true
--- */
import { BUILTIN_RECIPES, getRecipe, builtinTools, builtinSteps, recipeSteps, filterBuiltins, isCustomRecipe } from '@smartdevutils/recipes'
import { TOOL_CATALOG } from '@smartdevutils/core/tools/catalog'

const recipe = getRecipe('decode-base64-json-param')!

console.log('tools:', builtinTools(recipe, TOOL_CATALOG).map((t) => t.name))
console.log('saved-recipe steps:', builtinSteps(recipe, TOOL_CATALOG))
console.log('plan:', recipeSteps(recipe).map((s) => `${s.name}${s.mode ? ` (${s.mode})` : ''}`))

const jwt = filterBuiltins(BUILTIN_RECIPES, TOOL_CATALOG, { query: 'jwt' })
console.log('recipes mentioning JWT:', jwt.map((r) => r.id))

// A copy of a built-in is not custom; a changed chain is.
const copy = { steps: builtinSteps(recipe, TOOL_CATALOG) }
const changed = { steps: [...copy.steps].reverse() }
console.log('copy is custom:', isCustomRecipe(copy, BUILTIN_RECIPES, TOOL_CATALOG))
console.log('reversed is custom:', isCustomRecipe(changed, BUILTIN_RECIPES, TOOL_CATALOG))
