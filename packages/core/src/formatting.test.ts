import { describe, it, expect } from 'vitest';
import { jsonFormat, jsonMinify, htmlPrettify } from './formatting';

describe('jsonFormat', () => {
  it('formats valid JSON with 2-space indent', () => {
    expect(jsonFormat('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('formats with custom indent', () => {
    expect(jsonFormat('{"a":1}', 4)).toBe('{\n    "a": 1\n}');
  });

  it('throws on invalid JSON', () => {
    expect(() => jsonFormat('{bad}')).toThrow();
  });
});

describe('jsonMinify', () => {
  it('removes whitespace from JSON', () => {
    expect(jsonMinify('{\n  "a": 1\n}')).toBe('{"a":1}');
  });

  it('throws on invalid JSON', () => {
    expect(() => jsonMinify('{bad}')).toThrow();
  });
});

describe('htmlPrettify', () => {
  it('indents nested HTML', () => {
    const result = htmlPrettify('<div><span>hi</span></div>');
    expect(result).toContain('<div>');
    expect(result).toContain('<span>hi</span>');
  });

  it('returns a non-empty string for valid HTML', () => {
    expect(htmlPrettify('<p>hello</p>').trim().length).toBeGreaterThan(0);
  });
});
