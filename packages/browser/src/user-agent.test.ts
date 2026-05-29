import { describe, it, expect } from 'vitest'
import { parseUserAgent } from './user-agent'

describe('parseUserAgent', () => {
  it('detects Chrome on Windows as desktop', () => {
    const r = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    expect(r.browser).toBe('Chrome')
    expect(r.os).toContain('Windows')
    expect(r.device).toBe('desktop')
  })
  it('detects mobile iPhone', () => {
    const r = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
    expect(r.device).toBe('mobile')
  })
})
