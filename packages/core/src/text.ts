import { camelCase, snakeCase, kebabCase, pascalCase } from 'change-case';
import slugify from 'slugify';

export type CaseVariant = 'camel' | 'snake' | 'kebab' | 'upper' | 'lower' | 'title' | 'pascal';

export function toCase(input: string, variant: CaseVariant): string {
  switch (variant) {
    case 'camel':  return camelCase(input);
    case 'snake':  return snakeCase(input);
    case 'kebab':  return kebabCase(input);
    case 'pascal': return pascalCase(input);
    case 'upper':  return input.toUpperCase();
    case 'lower':  return input.toLowerCase();
    case 'title':  return input.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
}

export function slugifyText(input: string): string {
  return slugify(input, { lower: true, strict: true });
}

export function cleanText(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function sortLines(input: string, direction: 'asc' | 'desc'): string {
  const lines = input.split('\n');
  lines.sort((a, b) => direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
  return lines.join('\n');
}

export function deduplicateLines(input: string): string {
  const seen = new Set<string>();
  return input.split('\n').filter(line => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  }).join('\n');
}

export function wordCount(input: string): string {
  const words = input.trim().split(/\s+/).filter(Boolean).length;
  const chars = input.length;
  const bytes = new TextEncoder().encode(input).length;
  return `${words} words · ${chars} chars · ${bytes} bytes`;
}
