# @smartdevutils/recipes

Recipes are the chains of tools on [SmartDevUtils](https://smartdevutils.com/recipes), such as "URL-decode, then Base64-decode, then pretty-print the JSON". This package has:

- the 55 built-in recipes as data (`BUILTIN_RECIPES`), with the same ids as the website;
- an engine that runs a recipe **headless** (in Node or the browser, with no website) through the tool runners in `@smartdevutils/core/tools`;
- the website's run record format, `sdu-recipe-run/1`. A run made here can be uploaded on the website's run summary, and a run downloaded from the website can be read and re-run here.

## Install

```bash
npm i @smartdevutils/recipes
```

`@smartdevutils/core` is installed with it. You need Node 20.19 or later.

## Run a recipe

```ts
import { writeFile } from 'node:fs/promises'
import { getRecipe, isRunnable, runRecipe, runFileText, describeStep } from '@smartdevutils/recipes'

const recipe = getRecipe('decode-base64-json-param')!
isRunnable(recipe) // true: every tool in it has a runner

// With no input, the recipe's own synthetic sample is used.
const run = await runRecipe(recipe, 'eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIn0%3D')

run.trace.at(-1)?.output
// '{\n  "user": "ada",\n  "role": "admin"\n}'

describeStep(run.trace[1]!.input, run.trace[1]!.output).headline
// 'Base64 (29 bytes decoded) became JSON object, 2 keys; 40 -> 29 characters.'

// Save as a file the website's "Upload run" accepts:
await writeFile('run.json', runFileText(run))
```

Your own chains work too:

```ts
import { resolveSteps, runSteps } from '@smartdevutils/recipes'

const steps = resolveSteps([
  { toolId: 'json-formatter', mode: 'minify' },
  { toolId: 'base64-encoder-decoder', mode: 'encode' },
])
const run = await runSteps('JSON to an env var', steps, '{ "debug": true }')
```

### How a run stops

The engine follows the same rules as the website's replay:

- A step that reports an error stops the run. The error is kept in that step's trace.
- A step that gives no output stops the run.
- A tool that shows a report (an analyzer, `output: 'report'`) can only be the last step. Its report text is kept in the trace and the step is marked `noOutputPanel`, as on the website.
- A tool with no runner stops the run before it runs.

`run.stopped` is `{ index, reason }` with the website's wording. The full value is piped from step to step. The stored trace keeps at most `RUN_VALUE_MAX` (200,000) characters per value and marks capped steps `truncated`.

Pass `onStep` to watch progress, `signal` to cancel, or your own `loadRunner` and `hasRunner` to supply extra runners.

## Run files (`sdu-recipe-run/1`)

```ts
import { readRunFile, rerunFile, buildRunFile } from '@smartdevutils/recipes'

const read = readRunFile(textOfDownloadedFile)   // { run, notes } or { error }
const again = await rerunFile(textOfDownloadedFile) // runs it again from the recorded step-1 input
const file = buildRunFile(run)                    // the object the website downloads
```

`readRunFile` uses the website's `parseRunFile`, which treats the file as untrusted:

- The file must be 2 MB or less and must be valid JSON.
- The schema must match exactly.
- Each step is resolved by its website slug from the tool catalog. Tool names are never taken from the file.
- A mode is kept only if the tool has it.
- Step settings are kept only as small plain objects.
- Each value is capped, and unknown fields are ignored.

## Which recipes run headless today

```ts
import { runnableRecipes, missingRunners, getRecipe } from '@smartdevutils/recipes'

runnableRecipes().map(r => r.id)
// ['decode-base64-json-param', 'json-to-base64-env']

missingRunners(getRecipe('inspect-gzipped-payload')!)
// ['gzip-compressor']
```

Today **2 of the 55** built-in recipes are runnable: `decode-base64-json-param` and `json-to-base64-env`. The other 53 use at least one tool whose logic still lives only in the website.

As runners are added to `@smartdevutils/core/tools`, more recipes become runnable without any change to this package. Once all their tools have runners, 51 recipes will run in plain Node. One needs jq-wasm, two need a DOM, and `listen-to-pasted-text` needs a browser's speech synthesis.

## Also exported

These are the website's own pure helpers, unchanged:

- `profileValue`, `jsonChanges`, `lineDiff`, `describeStep` and `capValue` (the run summary's "what changed" view).
- `buildRunFile`, `parseRunFile`, `readStoredRun` and `runFileName`.
- `buildRecipeExport` and `parseRecipeImport` (the `sdu-recipes/1` export file).
- `planSteps`, `builtinTools`, `filterBuiltins` and `recipeDraftErrors`.
- `canPipe`, which decides whether one tool's output can feed another.

## Licence

MIT © ArchitonixLabs
