/* ---
title: Copy a value with a button
entry: clipboard/copyToClipboard, clipboard/readFromClipboard
description: The clipboard needs a page with focus and permission, so this cannot run in the playground's sandboxed preview. Copy it into your app.
mode: docs
output: preview
--- */
import { copyToClipboard, readFromClipboard } from '@smartdevutils/browser/clipboard'

const button = document.querySelector<HTMLButtonElement>('#copy-token')!
button.addEventListener('click', async () => {
  try {
    await copyToClipboard('demo-api-token-123')
    button.textContent = 'Copied'
  } catch {
    button.textContent = 'Copy failed: select the text and press Ctrl+C'
  }
})

// Reading asks the visitor for permission first.
document.querySelector('#paste')?.addEventListener('click', async () => {
  console.log('clipboard holds:', await readFromClipboard())
})
