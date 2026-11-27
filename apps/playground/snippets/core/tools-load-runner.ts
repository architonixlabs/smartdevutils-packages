/* ---
title: Load a runner once and reuse it
entry: tools-api/loadRunner, tools-api/hasRunner, tools-api/RUNNABLE_TOOL_IDS
node: true
--- */
import { loadRunner, hasRunner, RUNNABLE_TOOL_IDS } from '@smartdevutils/core/tools'

console.log(`${RUNNABLE_TOOL_IDS.length} runnable tools:`, RUNNABLE_TOOL_IDS.join(', '))

// Check first: loadRunner rejects for a tool without a runner.
console.log('gzip-compressor has a runner:', hasRunner('gzip-compressor'))

const hash = await loadRunner('hash-generator')
for (const word of ['alpha', 'beta', 'gamma']) {
  const { output } = await hash.run(word, { mode: 'sha256' })
  console.log(word, output.slice(0, 16) + '…')
}
