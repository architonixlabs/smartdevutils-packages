import { v4 as uuidv4 } from 'uuid';
import effWords from 'eff-diceware-passphrase/wordlist.json';

function getRandomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
];

export function generateUuid(): string {
  return uuidv4();
}

export function generateTimestamp(): string {
  return new Date().toISOString();
}

export function generateLoremIpsum(words = 30): string {
  const result: string[] = [];
  for (let i = 0; i < words; i++) {
    result.push(LOREM_WORDS[i % LOREM_WORDS.length]);
  }
  return result.join(' ');
}

const PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

export function generatePassword(length: number): string {
  const chars = PASSWORD_CHARS;
  const bytes = getRandomBytes(length);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export function generatePassphrase(wordCount: number): string {
  const words: string[] = [];
  const list = effWords as string[];
  const bytes = getRandomBytes(wordCount * 2);
  for (let i = 0; i < wordCount; i++) {
    const idx = ((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % list.length;
    words.push(list[idx]);
  }
  return words.join(' ');
}
