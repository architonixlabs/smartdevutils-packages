import { describe, it, expect } from 'vitest';
import { generateUuid, generateTimestamp, generateLoremIpsum, generatePassword, generatePassphrase } from './generation';

describe('generateUuid', () => {
  it('returns a valid UUID v4', () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('returns unique values on each call', () => {
    expect(generateUuid()).not.toBe(generateUuid());
  });
});

describe('generateTimestamp', () => {
  it('returns a valid ISO 8601 string', () => {
    const ts = generateTimestamp();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('parses to a valid Date', () => {
    expect(new Date(generateTimestamp()).getTime()).toBeGreaterThan(0);
  });
});

describe('generateLoremIpsum', () => {
  it('returns default 30 words when no arg', () => {
    expect(generateLoremIpsum().split(' ')).toHaveLength(30);
  });

  it('returns requested word count', () => {
    expect(generateLoremIpsum(10).split(' ')).toHaveLength(10);
  });

  it('returns non-empty string', () => {
    expect(generateLoremIpsum(5).length).toBeGreaterThan(0);
  });
});

describe('generatePassword', () => {
  it('returns string of requested length', () => {
    expect(generatePassword(12)).toHaveLength(12);
    expect(generatePassword(32)).toHaveLength(32);
  });

  it('contains only allowed characters', () => {
    const result = generatePassword(100);
    expect(result).toMatch(/^[A-Za-z0-9!@#$%^&*()_+\-=[\]{}|;:,.<>?]{100}$/);
  });
});

describe('generatePassphrase', () => {
  it('returns N space-separated words', () => {
    const result = generatePassphrase(4);
    const words = result.split(' ');
    expect(words).toHaveLength(4);
    words.forEach(w => expect(w.length).toBeGreaterThan(0));
  });

  it('returns different values on each call', () => {
    expect(generatePassphrase(4)).not.toBe(generatePassphrase(4));
  });
});
