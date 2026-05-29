import { describe, it, expect } from 'vitest';
import { md5, sha256, sha1, sha512 } from './hashing';

describe('md5', () => {
  it('returns known hash for empty string', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('returns known hash for "hello"', () => {
    expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('returns 32 hex chars', () => {
    expect(md5('anything')).toHaveLength(32);
    expect(md5('anything')).toMatch(/^[0-9a-f]+$/);
  });
});

describe('sha256', () => {
  it('returns known hash for empty string', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('returns known hash for "hello"', () => {
    expect(sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('returns 64 hex chars', () => {
    expect(sha256('anything')).toHaveLength(64);
    expect(sha256('anything')).toMatch(/^[0-9a-f]+$/);
  });
});

describe('sha1', () => {
  it('returns 40-char hex string', () => {
    const result = sha1('hello');
    expect(result).toMatch(/^[0-9a-f]{40}$/);
    expect(result).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });
});

describe('sha512', () => {
  it('returns 128-char hex string', () => {
    const result = sha512('hello');
    expect(result).toMatch(/^[0-9a-f]{128}$/);
  });
});
