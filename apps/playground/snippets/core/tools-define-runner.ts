/* ---
title: Write your own runner with the same rules
entry: tools-api/defineRunner
description: defineRunner rejects unknown modes, fills option defaults and turns a thrown error into { output: '', error }.
node: true
--- */
import { defineRunner, type ToolSpec } from '@smartdevutils/core/tools'

const spec: ToolSpec = {
  id: 'line-reverser',
  slug: 'line-reverser',
  name: 'Line Reverser',
  category: 'text-tools',
  toolType: 'single',
  modes: [{ id: 'lines', label: 'Reverse lines' }, { id: 'chars', label: 'Reverse characters' }],
  defaultMode: 'lines',
  input: { kind: 'text' },
  options: [{ key: 'trim', label: 'Trim each line', type: 'boolean', default: true }],
  output: 'text',
}

const runner = defineRunner(spec, (input, { mode, options }) => {
  const lines = input.split('\n').map((l) => (options.trim ? l.trim() : l))
  if (mode === 'chars') return { output: lines.map((l) => [...l].reverse().join('')).join('\n') }
  return { output: lines.reverse().join('\n') }
})

console.log(await runner.run('one\n  two\nthree'))
console.log(await runner.run('stressed', { mode: 'chars' }))
console.log(await runner.run('x', { mode: 'nope' })) // an error, not a silent fallback
