/* ---
title: Types and a JSON Schema from an API response
entry: formats/jsonToTypeScript, formats/jsonSchemaGenerate
node: true
--- */
import { jsonToTypeScript, jsonSchemaGenerate } from '@smartdevutils/core/formats'

const sample = JSON.stringify({
  id: 42,
  email: 'jane@example.com',
  active: true,
  roles: ['admin', 'editor'],
  profile: { bio: 'Full-stack engineer', location: 'Berlin' },
})

console.log(jsonToTypeScript(sample))
console.log(jsonSchemaGenerate(sample))
