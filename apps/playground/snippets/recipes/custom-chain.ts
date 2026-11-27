/* ---
title: Run your own chain of tools
entry: index/runSteps, index/resolveSteps
node: true
--- */
import { resolveSteps, runSteps } from '@smartdevutils/recipes'

const steps = resolveSteps([
  { toolId: 'json-formatter', mode: 'minify' },
  { toolId: 'base64-encoder-decoder', mode: 'encode', options: { variant: 'urlsafe-nopad' } },
])

const run = await runSteps('JSON config to an env var', steps, '{\n  "debug": true,\n  "region": "eu-west-1"\n}')
console.log(`CONFIG_B64=${run.trace.at(-1)?.output}`)

// A step that fails stops the run, with the website's wording:
const bad = await runSteps('Broken', steps, '{ not json')
console.log(bad.stopped)
