import { describe, expect, it } from 'vitest';
import { BUILTIN_RECIPES } from './library';
import { TOOL_CATALOG as TOOLS_REGISTRY } from '@smartdevutils/core/tools/catalog';
import { RECIPE_EXPORT_SCHEMA } from './model';
import {
  RECIPE_IMPORT_MAX_BYTES, buildRecipeExport, builtinSteps, filterBuiltins, isCustomRecipe, parseRecipeImport,
  recipeDraftErrors, recipeExportFileName, searchRecipeTools, slugifyRecipeName, summariseImport, builtinCategoryCounts,
} from './recipes';

const tools = TOOLS_REGISTRY;
const builtin = BUILTIN_RECIPES.find(r => r.id === 'decode-base64-json-param')!;
const builtinCopy = { name: 'My copy', steps: builtinSteps(builtin, tools) };
const custom = {
  name: 'Repair then escape', description: 'Mine', basedOn: 'repair-and-minify-json',
  steps: [{ slug: 'json-repair', name: 'JSON Repair' }, { slug: 'string-escape-unescape', name: 'String Escape Unescape' }],
};
const file = (recipes: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schema: RECIPE_EXPORT_SCHEMA, exportedAt: '2026-01-01T00:00:00.000Z', recipes, ...extra });
const ctx = (existing: { steps: { slug: string }[] }[] = [], max = 50) => ({ tools, builtins: BUILTIN_RECIPES, existing, max });

describe('custom vs built-in copy', () => {
  it('a saved recipe identical to a built-in is not custom; any change makes it custom', () => {
    expect(isCustomRecipe(builtinCopy, BUILTIN_RECIPES, tools)).toBe(false);
    expect(isCustomRecipe({ steps: builtinCopy.steps.slice(0, 2) }, BUILTIN_RECIPES, tools)).toBe(true);
    expect(isCustomRecipe({ steps: [...builtinCopy.steps].reverse() }, BUILTIN_RECIPES, tools)).toBe(true);
    expect(isCustomRecipe(custom, BUILTIN_RECIPES, tools)).toBe(true);
  });
});

describe('export', () => {
  it('leaves out recipes identical to a built-in and keeps only name, description, basedOn and slugs', () => {
    const out = buildRecipeExport([builtinCopy, custom], BUILTIN_RECIPES, tools, new Date('2026-11-17T10:00:00Z'));
    expect(out.schema).toBe('sdu-recipes/1');
    expect(out.exportedAt).toBe('2026-11-17T10:00:00.000Z');
    expect(out.recipes).toEqual([{
      name: 'Repair then escape', description: 'Mine', basedOn: 'repair-and-minify-json',
      steps: [{ slug: 'json-repair' }, { slug: 'string-escape-unescape' }],
    }]);
  });

  it('names the file by date, or by the recipe slug for one', () => {
    expect(recipeExportFileName(new Date(2026, 10, 7))).toBe('smartdevutils-recipes-20261107.json');
    expect(recipeExportFileName(new Date(), 'Décode & Format: JSON!')).toBe('decode-format-json.json');
    expect(slugifyRecipeName('!!!')).toBe('recipe');
  });

  it('round-trips through import', () => {
    const out = buildRecipeExport([custom], BUILTIN_RECIPES, tools);
    const r = parseRecipeImport(JSON.stringify(out), ctx());
    expect(r.error).toBeUndefined();
    expect(r.recipes).toEqual([custom]);
  });
});

describe('import validation', () => {
  it('rejects a file over 200 KB', () => {
    const big = file([], { pad: 'x'.repeat(RECIPE_IMPORT_MAX_BYTES) });
    expect(parseRecipeImport(big, ctx()).error).toMatch(/200 KB/);
  });

  it('rejects text that is not JSON, and JSON without the exact schema', () => {
    expect(parseRecipeImport('{not json', ctx()).error).toMatch(/not valid JSON/);
    expect(parseRecipeImport(JSON.stringify({ schema: 'sdu-recipes/2', recipes: [] }), ctx()).error).toMatch(/sdu-recipes\/1/);
    expect(parseRecipeImport(JSON.stringify({ recipes: [] }), ctx()).error).toBeDefined();
    expect(parseRecipeImport(JSON.stringify({ schema: RECIPE_EXPORT_SCHEMA, recipes: {} }), ctx()).error).toBeDefined();
    expect(parseRecipeImport('[]', ctx()).error).toBeDefined();
    expect(parseRecipeImport('null', ctx()).error).toBeDefined();
  });

  it('skips a recipe with an unknown tool slug', () => {
    const r = parseRecipeImport(file([{ name: 'X', steps: [{ slug: 'json-repair' }, { slug: 'no-such-tool' }] }]), ctx());
    expect(r.recipes).toEqual([]);
    expect(r.skipped.unknownTool).toBe(1);
  });

  it('skips invalid names, descriptions and step counts', () => {
    const two = [{ slug: 'json-repair' }, { slug: 'json-formatter-validator-minifier-beautifier' }];
    const r = parseRecipeImport(file([
      { name: '   ', steps: two },
      { name: 'x'.repeat(81), steps: two },
      { name: 'Long desc', description: 'd'.repeat(301), steps: two },
      { name: 'Bad desc', description: 42, steps: two },
      { name: 'One step', steps: [{ slug: 'json-repair' }] },
      { name: 'Eleven', steps: Array.from({ length: 11 }, () => ({ slug: 'json-repair' })) },
      { name: 'Bad step', steps: [{ slug: 'json-repair' }, 'json-repair'] },
      'not an object',
    ]), ctx());
    expect(r.recipes).toEqual([]);
    expect(r.skipped.invalid).toBe(8);
  });

  it('trims the name, derives step names from the registry and ignores extra fields', () => {
    const r = parseRecipeImport(file([{
      name: '  Mine  ', evil: '<script>', id: 'x', createdAt: 1, basedOn: 'not-a-builtin',
      steps: [{ slug: 'json-repair', name: '<img onerror=alert(1)>' }, { slug: 'string-escape-unescape', extra: true }],
    }]), ctx());
    expect(r.recipes).toEqual([{
      name: 'Mine',
      steps: [{ slug: 'json-repair', name: 'JSON Repair' }, { slug: 'string-escape-unescape', name: 'String Escape Unescape' }],
    }]);
  });

  it('keeps basedOn only when it names a built-in', () => {
    const r = parseRecipeImport(file([{ ...custom }]), ctx());
    expect(r.recipes[0].basedOn).toBe('repair-and-minify-json');
  });

  it('skips recipes identical to a built-in, to a saved recipe or to an earlier one in the file', () => {
    const r = parseRecipeImport(file([
      { name: 'Copy', steps: builtinCopy.steps.map(s => ({ slug: s.slug })) },
      { name: 'Saved already', steps: custom.steps.map(s => ({ slug: s.slug })) },
      { name: 'New', steps: [{ slug: 'text-cleaner' }, { slug: 'string-length' }, { slug: 'read-aloud' }] },
      { name: 'New again', steps: [{ slug: 'text-cleaner' }, { slug: 'string-length' }, { slug: 'read-aloud' }] },
    ]), ctx([{ steps: custom.steps }]));
    expect(r.recipes.map(x => x.name)).toEqual(['New']);
    expect(r.skipped).toMatchObject({ builtin: 1, duplicate: 2 });
    expect(summariseImport(r)).toBe('Imported 1, skipped 3: 2 duplicates, 1 copy of a ready-made recipe.');
  });

  it('respects the saved-recipe cap', () => {
    const existing = Array.from({ length: 49 }, (_, i) => ({ steps: [{ slug: 'a' + i }, { slug: 'b' }] }));
    const r = parseRecipeImport(file([
      { name: 'One', steps: [{ slug: 'text-cleaner' }, { slug: 'string-length' }] },
      { name: 'Two', steps: [{ slug: 'text-cleaner' }, { slug: 'whitespace-visualiser' }] },
    ]), ctx(existing));
    expect(r.recipes.map(x => x.name)).toEqual(['One']);
    expect(r.skipped.overLimit).toBe(1);
    expect(summariseImport(r)).toBe('Imported 1, skipped 1: 1 over the saved-recipe limit.');
  });

  it('reports an empty file and a mixed result', () => {
    expect(summariseImport(parseRecipeImport(file([]), ctx()))).toBe('That file has no recipes in it.');
    const r = parseRecipeImport(file([
      { name: 'Ok', steps: [{ slug: 'text-cleaner' }, { slug: 'string-length' }] },
      { name: 'Unknown', steps: [{ slug: 'text-cleaner' }, { slug: 'nope' }] },
    ]), ctx());
    expect(summariseImport(r)).toBe('Imported 1, skipped 1: 1 unknown tool.');
  });
});

describe('gallery filtering', () => {
  it('filters by category', () => {
    const r = filterBuiltins(BUILTIN_RECIPES, tools, { category: 'data-tools' });
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r.every(x => x.category === 'data-tools')).toBe(true);
  });

  it('searches name, description and tool names, every word must match', () => {
    expect(filterBuiltins(BUILTIN_RECIPES, tools, { query: 'bookmarklet' }).map(r => r.id)).toEqual(['build-a-bookmarklet']);
    // "Kubernetes Secret Decoder / Encoder" is only in a tool name.
    expect(filterBuiltins(BUILTIN_RECIPES, tools, { query: 'secret decoder' }).map(r => r.id)).toContain('env-to-k8s-secret');
    expect(filterBuiltins(BUILTIN_RECIPES, tools, { query: 'JSONPATH' }).map(r => r.id)).toContain('query-csv-with-jsonpath');
    expect(filterBuiltins(BUILTIN_RECIPES, tools, { query: 'csv zzzz' })).toEqual([]);
    expect(filterBuiltins(BUILTIN_RECIPES, tools, { category: 'css-tools', query: 'base64' })).toEqual([]);
    expect(filterBuiltins(BUILTIN_RECIPES, tools, {}).length).toBe(BUILTIN_RECIPES.length);
  });

  it('counts recipes per category', () => {
    const counts = builtinCategoryCounts(BUILTIN_RECIPES);
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(BUILTIN_RECIPES.length);
    expect(counts.size).toBe(17);
  });
});

describe('editor helpers', () => {
  it('validates the draft', () => {
    expect(recipeDraftErrors('Name', '', 2)).toEqual([]);
    expect(recipeDraftErrors(' ', '', 2)).toEqual(['Give the recipe a name.']);
    expect(recipeDraftErrors('x'.repeat(81), 'd'.repeat(301), 1)).toHaveLength(3);
    expect(recipeDraftErrors('Name', '', 11)).toEqual(['A recipe can have at most 10 tools.']);
  });

  // The catalog has no keywords (the website registry does), so only the name ranking is checked here.
  it('searches tools by name first', () => {
    const r = searchRecipeTools(tools, 'base64');
    expect(r[0].name.toLowerCase().startsWith('base64')).toBe(true);
    expect(searchRecipeTools(tools, '', 5)).toHaveLength(5);
  });
});
