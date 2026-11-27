/* ---
title: Files to Base64 and back
entry: file/fileToBase64, file/base64ToBlob, file/readFileAsText
description: Pick a file to see it as Base64. In your own page, downloadBlob(blob, name) saves a Blob; the playground preview is sandboxed and cannot download.
output: preview
--- */
import { fileToBase64, readFileAsText, base64ToBlob } from '@smartdevutils/browser/file'

const input = document.createElement('input')
input.type = 'file'
input.setAttribute('aria-label', 'Choose a file')
const out = document.createElement('pre')
document.body.append(input, out)

input.addEventListener('change', async () => {
  const file = input.files?.[0]
  if (!file) return
  const b64 = await fileToBase64(file)
  out.textContent = `${file.name}: ${b64.length} Base64 characters\n${b64.slice(0, 120)}…`
  if (file.type.startsWith('text/')) console.log((await readFileAsText(file)).slice(0, 200))
})

// Base64 back to a Blob:
const blob = base64ToBlob(btoa('hello from the playground'), 'text/plain')
console.log(blob.type, blob.size, 'bytes:', await blob.text())
