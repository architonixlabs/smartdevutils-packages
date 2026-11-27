/* ---
title: Run a built-in recipe and explain each step
entry: index/runRecipe, index/getRecipe, recipes/decode-base64-json-param
description: runRecipe pipes each step's output into the next; describeStep says what changed.
node: true
order: 1
--- */
import { getRecipe, isRunnable, runRecipe, describeStep } from '@smartdevutils/recipes'

const recipe = getRecipe('decode-base64-json-param')!
console.log(recipe.name, '| runnable:', isRunnable(recipe))

const run = await runRecipe(recipe, 'eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIn0%3D')

run.trace.forEach((step, i) => {
  if (!step) return
  console.log(`${i + 1}. ${run.steps[i].name}: ${describeStep(step.input, step.output).headline}`)
})
console.log(run.stopped ? `Stopped: ${run.stopped.reason}` : run.trace.at(-1)?.output)
