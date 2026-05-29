import { describe, it, expect } from 'vitest';
import { scanForSecrets, hmacSha256, sha384, base64UrlDecode } from './security-extra';

describe('scanForSecrets', () => {
  it('detects AWS access key', () => {
    const r = scanForSecrets('export AWS_KEY=AKIAIOSFODNN7EXAMPLE');
    expect(r.some(m => m.type === 'AWS Access Key')).toBe(true);
  });
  it('detects private key header', () => {
    const r = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----\ndata');
    expect(r.some(m => m.type === 'Private Key Header')).toBe(true);
  });
  it('returns empty for clean text', () => {
    expect(scanForSecrets('hello world\nno secrets here')).toHaveLength(0);
  });
  it('returns correct line number', () => {
    const text = 'line one\nAKIAIOSFODNN7EXAMPLE here\nline three';
    const r = scanForSecrets(text);
    expect(r[0].line).toBe(2);
  });
  it('detects GitHub token', () => {
    const r = scanForSecrets('token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890');
    expect(r.some(m => m.type === 'GitHub Token')).toBe(true);
  });
});

describe('hmacSha256', () => {
  it('returns 64-char hex string', () => {
    const r = hmacSha256('message', 'secret');
    expect(r).toHaveLength(64);
    expect(r).toMatch(/^[0-9a-f]+$/);
  });
  it('different keys produce different results', () => {
    expect(hmacSha256('msg', 'key1')).not.toBe(hmacSha256('msg', 'key2'));
  });
});

describe('sha384', () => {
  it('returns 96-char hex string', () => {
    const r = sha384('hello');
    expect(r).toHaveLength(96);
    expect(r).toMatch(/^[0-9a-f]+$/);
  });
});

describe('base64UrlDecode', () => {
  it('decodes standard base64url without padding', () => {
    const encoded = btoa('hello world').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(base64UrlDecode(encoded)).toBe('hello world');
  });
  it('handles input with existing padding', () => {
    const encoded = btoa('test').replace(/\+/g, '-').replace(/\//g, '_');
    expect(base64UrlDecode(encoded)).toBe('test');
  });
});
