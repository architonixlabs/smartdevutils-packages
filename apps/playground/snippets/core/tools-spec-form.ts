/* ---
title: Read a tool's spec to build your own form
entry: tools-api/getToolSpec, tools-api/optionsForMode, tools-api/defaultOptions, tools-api/modeLabels
node: true
--- */
import { getToolSpec, optionsForMode, defaultOptions, modeLabels } from '@smartdevutils/core/tools'

const spec = getToolSpec('base64-encoder-decoder')!
console.log(spec.name, '-', spec.modes.map((m) => m.id).join(' / '))

for (const mode of spec.modes) {
  const labels = modeLabels(spec, mode.id)
  const fields = optionsForMode(spec, mode.id).map((o) => `${o.key} (${o.type})`)
  console.log(`${mode.label}: ${labels.input} -> ${labels.output}; settings: ${fields.join(', ')}`)
}

console.log('defaults:', defaultOptions(spec))
