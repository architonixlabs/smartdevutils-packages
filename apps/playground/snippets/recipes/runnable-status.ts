/* ---
title: Which recipes run headless, and what the others need
entry: index/runnableRecipes, index/missingRunners, index/isRunnable, index/BUILTIN_RECIPES
node: true
--- */
import { BUILTIN_RECIPES, runnableRecipes, missingRunners, isRunnable } from '@smartdevutils/recipes'

console.log('runnable:', runnableRecipes().map((r) => r.id))
console.log(`${BUILTIN_RECIPES.filter((r) => isRunnable(r)).length} of ${BUILTIN_RECIPES.length} run headless`)

// The tools that would unlock the most recipes:
const needed = new Map<string, number>()
for (const r of BUILTIN_RECIPES) for (const t of missingRunners(r)) needed.set(t, (needed.get(t) ?? 0) + 1)
const top = [...needed].sort((a, b) => b[1] - a[1]).slice(0, 5)
console.log('most-needed runners:', top)
