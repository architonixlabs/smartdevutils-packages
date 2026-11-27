/* ---
title: Save text or a Blob as a file
entry: file/downloadBlob, file/downloadText
description: In your page this saves the file. The playground preview is a sandboxed frame without downloads, so here the browser blocks the save and the example only logs what it would save.
output: console
--- */
import { downloadBlob, downloadText } from '@smartdevutils/browser/file'

const report = JSON.stringify({ tool: 'json-formatter', ok: true, at: new Date().toISOString() }, null, 2)
const blob = new Blob([report], { type: 'application/json' })
console.log(`would save report.json: ${blob.type}, ${blob.size} bytes`)
downloadBlob(blob, 'report.json')

console.log('would save notes.txt: 2 lines of text')
downloadText('First line\nSecond line', 'notes.txt', 'text/plain')
