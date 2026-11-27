/* ---
title: Change one step and run again from it
entry: index/runFrom, index/buildRunFile
node: true
--- */
import { getRecipe, runRecipe, runFrom, buildRunFile } from '@smartdevutils/recipes'

const run = await runRecipe(getRecipe('json-to-base64-env')!, '{ "debug": true, "region": "eu-west-1" }')
console.log('first run :', run.steps.map((s) => s.name).join(' -> '), '=', run.trace.at(-1)?.output)

// Step 2 (index 1) again, now with URL-safe Base64 without padding.
const again = await runFrom(run, 1, { options: { variant: 'urlsafe-nopad' } })
console.log('second run:', again.trace.at(-1)?.output)

const file = buildRunFile(again)
console.log(file.schema, `${file.steps.length} steps`)
