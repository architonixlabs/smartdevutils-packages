import { describe, it, expect } from 'vitest';
import { toCase, CaseVariant, slugifyText, cleanText, sortLines, deduplicateLines, wordCount } from './text';

describe('toCase', () => {
  const input = 'hello world foo bar';

  it('camel', () => expect(toCase(input, 'camel')).toBe('helloWorldFooBar'));
  it('snake', () => expect(toCase(input, 'snake')).toBe('hello_world_foo_bar'));
  it('kebab', () => expect(toCase(input, 'kebab')).toBe('hello-world-foo-bar'));
  it('pascal', () => expect(toCase(input, 'pascal')).toBe('HelloWorldFooBar'));
  it('upper', () => expect(toCase(input, 'upper')).toBe('HELLO WORLD FOO BAR'));
  it('lower', () => expect(toCase(input, 'lower')).toBe('hello world foo bar'));
  it('title', () => expect(toCase(input, 'title')).toBe('Hello World Foo Bar'));
});

describe('slugifyText', () => {
  it('converts to url-safe slug', () => {
    expect(slugifyText('Hello World! 123')).toBe('hello-world-123');
  });
});

describe('cleanText', () => {
  it('strips non-printable chars and normalises whitespace', () => {
    expect(cleanText('hello\x00world  foo\tbar')).toBe('hello world foo bar');
  });
});

describe('sortLines', () => {
  it('sorts ascending', () => {
    expect(sortLines('banana\napple\ncherry', 'asc')).toBe('apple\nbanana\ncherry');
  });
  it('sorts descending', () => {
    expect(sortLines('banana\napple\ncherry', 'desc')).toBe('cherry\nbanana\napple');
  });
});

describe('deduplicateLines', () => {
  it('removes duplicate lines preserving first occurrence', () => {
    expect(deduplicateLines('a\nb\na\nc\nb')).toBe('a\nb\nc');
  });
});

describe('wordCount', () => {
  it('returns formatted summary', () => {
    const result = wordCount('hello world');
    expect(result).toContain('2 words');
    expect(result).toContain('11 chars');
  });
});
