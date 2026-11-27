/* ---
title: Base64 round trip, including Unicode
entry: encoding/base64Encode, encoding/base64Decode
description: Encode a JSON payload for a header or env var, then decode it back. Works with emoji and accents.
node: true
--- */
import { base64Encode, base64Decode } from '@smartdevutils/core/encoding'

const payload = JSON.stringify({ user: 'ada', city: 'Zürich', mood: '🚀' })

const encoded = base64Encode(payload)
console.log('Base64:', encoded)

const decoded = base64Decode(encoded)
console.log('Decoded:', decoded)
console.log('Same as the original:', decoded === payload)
