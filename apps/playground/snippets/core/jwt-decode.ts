/* ---
title: Decode a JWT and check its expiry
entry: jwt/jwtDecode
description: The demo token is built in the snippet. jwtDecode reads the header and payload; it does not verify the signature.
node: true
--- */
import { jwtDecode } from '@smartdevutils/core/jwt'
import { base64Encode } from '@smartdevutils/core/encoding'

// Build a demo token: header.payload.signature, each part Base64url without padding.
const b64url = (obj: object) =>
  base64Encode(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const now = Math.floor(Date.now() / 1000)
const token = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: 'demo-user-42', role: 'editor', iat: now, exp: now + 3600 }),
  'demo-signature',
].join('.')

const decoded = JSON.parse(jwtDecode(token))
console.log(decoded.header)
console.log(decoded.payload)

const minutesLeft = Math.round((decoded.payload.exp - now) / 60)
console.log(minutesLeft > 0 ? `Expires in ${minutesLeft} minutes` : 'Expired')
