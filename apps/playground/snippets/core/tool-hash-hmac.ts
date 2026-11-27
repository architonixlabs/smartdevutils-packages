/* ---
title: Every hash of one input, and an HMAC
entry: tools/hash-generator
node: true
--- */
import { runTool, getToolSpec } from '@smartdevutils/core/tools'

const input = 'hello world'
for (const mode of getToolSpec('hash-generator')!.modes.map((m) => m.id)) {
  if (mode.startsWith('hmac')) continue
  const { output } = await runTool('hash-generator', input, { mode })
  console.log(mode.padEnd(7), output)
}

const signed = await runTool('hash-generator', '{"event":"order.paid"}', {
  mode: 'hmac-sha256',
  options: { secretKey: 'demo-webhook-secret', uppercase: true },
})
console.log('hmac   ', signed.output)
