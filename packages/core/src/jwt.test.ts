import { describe, it, expect } from 'vitest';
import { jwtDecode } from './jwt';

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
  'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('jwtDecode', () => {
  it('decodes a valid JWT and returns formatted JSON with header and payload', () => {
    const result = jwtDecode(SAMPLE_JWT);
    const parsed = JSON.parse(result);
    expect(parsed.header.alg).toBe('HS256');
    expect(parsed.payload.name).toBe('John Doe');
    expect(parsed.payload.sub).toBe('1234567890');
  });

  it('throws for non-JWT input', () => {
    expect(() => jwtDecode('not.a.jwt.with.too.many.dots.here')).toThrow('Not a valid JWT');
    expect(() => jwtDecode('only-two')).toThrow('Not a valid JWT');
  });
});
