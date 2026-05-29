import { describe, it, expect } from 'vitest';
import { estimateTokenCount, cleanPrompt, jsonToTrainingJsonl } from './aiml';

describe('estimateTokenCount', () => {
  it('returns chars/4 rounded up', () => { expect(estimateTokenCount('a'.repeat(400))).toBe(100); });
  it('returns 0 for empty string', () => { expect(estimateTokenCount('')).toBe(0); });
  it('returns at least 1 for single char', () => { expect(estimateTokenCount('a')).toBeGreaterThanOrEqual(1); });
});

describe('cleanPrompt', () => {
  it('collapses multiple spaces', () => { expect(cleanPrompt('hello   world')).toBe('hello world'); });
  it('collapses 3+ newlines to 2', () => { expect(cleanPrompt('a\n\n\n\nb')).toBe('a\n\nb'); });
  it('trims whitespace', () => { expect(cleanPrompt('   hello   ')).toBe('hello'); });
});

describe('jsonToTrainingJsonl', () => {
  it('converts array to JSONL lines', () => {
    const input = JSON.stringify([{ messages: [{ role: 'user', content: 'hi' }] }]);
    const lines = jsonToTrainingJsonl(input).trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).messages[0].role).toBe('user');
  });
  it('handles multiple entries', () => {
    const input = JSON.stringify([{ messages: [{ role: 'user', content: 'a' }] }, { messages: [{ role: 'user', content: 'b' }] }]);
    expect(jsonToTrainingJsonl(input).trim().split('\n')).toHaveLength(2);
  });
  it('throws on non-array JSON', () => { expect(() => jsonToTrainingJsonl('{"a":1}')).toThrow(); });
});
