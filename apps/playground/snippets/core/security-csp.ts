/* ---
title: Build and check a Content-Security-Policy
entry: security-extra2/buildCspHeader, security-extra2/validateCsp
node: true
--- */
import { buildCspHeader, validateCsp } from '@smartdevutils/core/security-extra2'

const header = buildCspHeader({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https://cdn.example.com'],
  imgSrc: ["'self'", 'data:'],
  objectSrc: ["'none'"],
})
console.log('Content-Security-Policy:', header)
console.log(validateCsp(header))

// A risky policy:
console.log(validateCsp("script-src 'self' 'unsafe-inline' 'unsafe-eval'"))
