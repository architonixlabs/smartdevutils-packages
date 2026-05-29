import { describe, it, expect } from 'vitest'
import { buildCspHeader, validateCsp, parseCorsPolicy, gitCommitLint } from './security-extra2'

describe('buildCspHeader', () => {
  it('builds a basic CSP header', () => {
    const result = buildCspHeader({ defaultSrc: ["'self'"], scriptSrc: ["'self'", 'cdn.example.com'] })
    expect(result).toContain("default-src 'self'")
    expect(result).toContain("script-src 'self' cdn.example.com")
  })
  it('adds report-uri when provided', () => {
    const result = buildCspHeader({ defaultSrc: ["'self'"], reportUri: '/csp-report' })
    expect(result).toContain('report-uri /csp-report')
  })
})

describe('validateCsp', () => {
  it('validates a correct CSP', () => {
    const result = validateCsp("default-src 'self'")
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
  it('warns when no default-src', () => {
    const result = validateCsp("script-src 'self'")
    expect(result.warnings.some(w => w.includes('default-src'))).toBe(true)
  })
  it('errors on unsafe-eval', () => {
    const result = validateCsp("script-src 'unsafe-eval'")
    expect(result.errors.some(e => e.includes('unsafe-eval'))).toBe(true)
  })
})

describe('parseCorsPolicy', () => {
  it('parses access-control headers', () => {
    const result = parseCorsPolicy({
      'access-control-allow-origin': 'https://example.com',
      'access-control-allow-methods': 'GET, POST',
    })
    expect(result.origins).toContain('https://example.com')
    expect(result.methods).toContain('GET')
    expect(result.allowed).toBe(true)
  })
  it('not allowed when no origin header', () => {
    expect(parseCorsPolicy({}).allowed).toBe(false)
  })
})

describe('gitCommitLint', () => {
  it('accepts conventional commit', () => {
    const result = gitCommitLint('feat(auth): add OAuth2 login')
    expect(result.valid).toBe(true)
    expect(result.convention).toBe('conventional')
  })
  it('rejects empty message', () => {
    expect(gitCommitLint('').valid).toBe(false)
  })
  it('rejects message over 72 chars', () => {
    expect(gitCommitLint('a'.repeat(73)).valid).toBe(false)
  })
  it('detects unknown convention for non-conventional messages', () => {
    expect(gitCommitLint('Updated the thing').convention).toBe('unknown')
  })
})
