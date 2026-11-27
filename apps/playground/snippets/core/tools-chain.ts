/* ---
title: Chain tools by piping each output into the next
entry: tools-api/runTool, tools/url-encoder-decoder
description: The same thing a recipe does, by hand. runTool never throws for bad input; check result.error.
node: true
order: 1
--- */
import { runTool } from '@smartdevutils/core/tools'

// A tracking cookie: URL-encoded Base64 of a JSON object.
let value = 'eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIiwidGVhbXMiOlsiY29yZSIsImRvY3MiXX0%3D'

const steps = [
  { tool: 'url-encoder-decoder', mode: 'decode' },
  { tool: 'base64-encoder-decoder', mode: 'decode' },
  { tool: 'json-formatter', mode: 'format' },
]

for (const step of steps) {
  const result = await runTool(step.tool, value, { mode: step.mode })
  if (result.error) throw new Error(`${step.tool}: ${result.error}`)
  value = result.output
  console.log(`after ${step.tool}:`, value)
}
