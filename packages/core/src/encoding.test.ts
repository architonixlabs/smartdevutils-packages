import { describe, it, expect } from 'vitest';
import { base64Encode, base64Decode, urlEncode, urlDecode, htmlEncode, htmlDecode, stringEscape, stringUnescape } from './encoding';

describe('base64Encode', () => {
  it('encodes ASCII string', () => {
    expect(base64Encode('hello world')).toBe('aGVsbG8gd29ybGQ=');
  });

  it('encodes UTF-8 string', () => {
    expect(base64Encode('café')).toBe('Y2Fmw6k=');
  });

  it('round-trips with decode', () => {
    const input = 'Hello, 世界!';
    expect(base64Decode(base64Encode(input))).toBe(input);
  });
});

describe('base64Decode', () => {
  it('decodes valid base64', () => {
    expect(base64Decode('aGVsbG8gd29ybGQ=')).toBe('hello world');
  });

  it('throws on invalid base64', () => {
    expect(() => base64Decode('not!!valid')).toThrow();
  });
});

describe('urlEncode', () => {
  it('encodes special characters', () => {
    expect(urlEncode('hello world')).toBe('hello%20world');
  });

  it('encodes & and =', () => {
    expect(urlEncode('a=1&b=2')).toBe('a%3D1%26b%3D2');
  });
});

describe('urlDecode', () => {
  it('decodes percent-encoded string', () => {
    expect(urlDecode('hello%20world')).toBe('hello world');
  });

  it('throws on malformed encoding', () => {
    expect(() => urlDecode('%GG')).toThrow();
  });
});

describe('htmlEncode', () => {
  it('encodes HTML special chars', () => {
    expect(htmlEncode('<div class="x">Hello & World</div>')).toBe(
      '&#x3C;div class=&#x22;x&#x22;&#x3E;Hello &#x26; World&#x3C;/div&#x3E;'
    );
  });
});

describe('htmlDecode', () => {
  it('decodes HTML entities', () => {
    expect(htmlDecode('&lt;div&gt;&amp;&lt;/div&gt;')).toBe('<div>&</div>');
  });
});

describe('stringEscape', () => {
  it('escapes backslashes and quotes', () => {
    expect(stringEscape('He said "hello"\nNew line')).toBe('He said \\"hello\\"\\nNew line');
  });
});

describe('stringUnescape', () => {
  it('unescapes sequences', () => {
    expect(stringUnescape('He said \\"hello\\"\\nNew line')).toBe('He said "hello"\nNew line');
  });

  it('throws on invalid escape sequence', () => {
    expect(() => stringUnescape('\\q invalid')).toThrow();
  });
});
