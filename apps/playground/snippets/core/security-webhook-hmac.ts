/* ---
title: Verify a webhook signature with HMAC-SHA256
entry: security/hmacSha256
description: Recompute the signature from the raw body and the shared secret, then compare.
node: true
--- */
import { hmacSha256 } from '@smartdevutils/core/security'

const secret = 'demo-webhook-secret' // in real code, read it from your environment
const body = '{"event":"order.paid","orderId":48213}'

// What the sender put in its signature header:
const signature = hmacSha256(body, secret)

function verify(rawBody: string, sig: string): boolean {
  return hmacSha256(rawBody, secret) === sig
}

console.log('signature    :', signature)
console.log('valid body   :', verify(body, signature))
console.log('tampered body:', verify(body.replace('48213', '48214'), signature))
