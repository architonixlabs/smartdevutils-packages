/* ---
title: Pretty-print, minify and validate JSON
entry: formatting/jsonFormat, formatting/jsonMinify
node: true
--- */
import { jsonFormat, jsonMinify } from '@smartdevutils/core/formatting'

const raw = '{"id":42,"name":"Jane Smith","roles":["admin","editor"],"profile":{"location":"Berlin"}}'

console.log(jsonFormat(raw)) // 2-space indent
console.log(jsonFormat(raw, 4)) // 4-space indent
console.log('minify restores the original:', jsonMinify(jsonFormat(raw)) === raw)

// Both throw on invalid JSON, so they double as a validator:
try {
  jsonFormat('{"id": 42,}')
} catch (e) {
  console.log('Invalid JSON:', (e as Error).message)
}
