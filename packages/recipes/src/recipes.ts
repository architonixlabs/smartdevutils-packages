import {
  BuiltinRecipe, RECIPE_EXPORT_SCHEMA, RecipeExportEntry, RecipeExportFile, RecipePlanStep,
} from './model';
import type { RecipeToolInfo } from './tool-info';

/**
 * Pure recipe helpers (no Angular), shared by the gallery, My Recipes, the editor and their tests: built-in lookup,
 * the "custom recipe" rule, JSON export and the validating import.
 */

type RegistryTool = RecipeToolInfo;
interface StepLike { slug: string }

export const RECIPE_NAME_MAX = 80;
export const RECIPE_DESCRIPTION_MAX = 300;
export const RECIPE_MIN_STEPS = 2;
export const RECIPE_MAX_STEPS = 10;
/** Largest recipe file Upload accepts. */
export const RECIPE_IMPORT_MAX_BYTES = 200 * 1024;

/** Ordered tool sequence as a comparable key. */
export function stepsKey(steps: readonly StepLike[]): string {
  return steps.map(s => s.slug).join('>');
}

/** A built-in's tools resolved from the registry, in order (unknown ids are dropped). */
export function builtinTools<T extends RegistryTool>(recipe: BuiltinRecipe, tools: readonly T[]): T[] {
  return recipe.toolIds.map(id => tools.find(t => t.id === id)).filter((t): t is T => !!t);
}

/** A built-in's steps in the saved-recipe shape ({slug, name}), names from the registry. */
export function builtinSteps(recipe: BuiltinRecipe, tools: readonly RegistryTool[]): { slug: string; name: string }[] {
  return builtinTools(recipe, tools).map(t => ({ slug: t.slug, name: t.name }));
}

/** The built-in whose ordered steps equal these, if any. */
export function matchingBuiltin(
  steps: readonly StepLike[], builtins: readonly BuiltinRecipe[], tools: readonly RegistryTool[],
): BuiltinRecipe | undefined {
  const key = stepsKey(steps);
  return builtins.find(b => stepsKey(builtinSteps(b, tools)) === key);
}

/**
 * A saved recipe is custom (new, or changed from a built-in) unless its ordered steps equal a built-in's exactly; a
 * copy of an out-of-box recipe is not. Only custom recipes can be downloaded.
 */
export function isCustomRecipe(
  recipe: { steps: readonly StepLike[] }, builtins: readonly BuiltinRecipe[], tools: readonly RegistryTool[],
): boolean {
  return !matchingBuiltin(recipe.steps, builtins, tools);
}

/** Plan steps for a guided run; `modes` (from a built-in) opens a step in the mode the chain needs. */
export function planSteps(
  tools: readonly RegistryTool[], modes?: Readonly<Record<string, string>>,
  options?: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): RecipePlanStep[] {
  return tools.map(t => ({
    toolId: t.id, slug: t.slug, name: t.name,
    ...(modes?.[t.id] ? { mode: modes[t.id] } : {}),
    ...(options?.[t.id] ? { options: { ...options[t.id] } } : {}),
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Gallery filtering

export interface BuiltinFilter { category?: string; query?: string }

/** Built-ins in a category (all when empty) whose name, description or tool names contain every query word. */
export function filterBuiltins(
  builtins: readonly BuiltinRecipe[], tools: readonly RegistryTool[], filter: BuiltinFilter,
): BuiltinRecipe[] {
  const words = (filter.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return builtins.filter(b => {
    if (filter.category && b.category !== filter.category) return false;
    if (!words.length) return true;
    const hay = [b.name, b.description, ...builtinTools(b, tools).map(t => t.name)].join(' ').toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

/** How many built-ins each category has (categories without any are absent). */
export function builtinCategoryCounts(builtins: readonly BuiltinRecipe[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of builtins) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
  return counts;
}

// ---------------------------------------------------------------------------------------------------------------
// Export

export interface ExportableRecipe { name: string; description?: string; basedOn?: string; steps: readonly StepLike[] }

export function toExportEntry(r: ExportableRecipe): RecipeExportEntry {
  return {
    name: r.name,
    ...(r.description ? { description: r.description } : {}),
    ...(r.basedOn ? { basedOn: r.basedOn } : {}),
    steps: r.steps.map(s => ({ slug: s.slug })),
  };
}

/** The download for these recipes, leaving out any that are only a copy of a built-in. */
export function buildRecipeExport(
  recipes: readonly ExportableRecipe[], builtins: readonly BuiltinRecipe[], tools: readonly RegistryTool[], now = new Date(),
): RecipeExportFile {
  return {
    schema: RECIPE_EXPORT_SCHEMA,
    exportedAt: now.toISOString(),
    recipes: recipes.filter(r => isCustomRecipe(r, builtins, tools)).map(toExportEntry),
  };
}

export function slugifyRecipeName(name: string): string {
  const words = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.join('-').slice(0, 60).replace(/-$/, '') || 'recipe';
}

/** `smartdevutils-recipes-YYYYMMDD.json`, or the recipe's slug when downloading one. */
export function recipeExportFileName(now = new Date(), singleName?: string): string {
  if (singleName !== undefined) return `${slugifyRecipeName(singleName)}.json`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `smartdevutils-recipes-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
}

// ---------------------------------------------------------------------------------------------------------------
// Import

export interface ImportedRecipe {
  name: string;
  description?: string;
  basedOn?: string;
  steps: { slug: string; name: string }[];
}

export interface ImportSkips { duplicate: number; builtin: number; unknownTool: number; invalid: number; overLimit: number }

export interface ImportResult {
  /** Set when the file itself was rejected; nothing was imported. */
  error?: string;
  recipes: ImportedRecipe[];
  skipped: ImportSkips;
}

export interface ImportContext {
  tools: readonly RegistryTool[];
  builtins: readonly BuiltinRecipe[];
  /** Recipes already saved in this browser. */
  existing: readonly { steps: readonly StepLike[] }[];
  /** The saved-recipe cap. */
  max: number;
}

const noSkips = (): ImportSkips => ({ duplicate: 0, builtin: 0, unknownTool: 0, invalid: 0, overLimit: 0 });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Reads an uploaded recipe file. The file is untrusted: size-capped, parsed in a try/catch, the schema checked
 * exactly, every field validated, step names re-derived from the registry (never taken from the file) and unknown
 * fields ignored. Recipes identical to a built-in or to one already saved are skipped, and the cap is respected.
 */
export function parseRecipeImport(text: string, ctx: ImportContext): ImportResult {
  const fail = (error: string): ImportResult => ({ error, recipes: [], skipped: noSkips() });
  if (byteLength(text) > RECIPE_IMPORT_MAX_BYTES) return fail('That file is larger than 200 KB, so it was not read.');

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail('That file is not valid JSON.');
  }
  if (!isRecord(data) || data['schema'] !== RECIPE_EXPORT_SCHEMA || !Array.isArray(data['recipes'])) {
    return fail(`That file is not a SmartDevUtils recipe export (expected "schema": "${RECIPE_EXPORT_SCHEMA}").`);
  }

  const bySlug = new Map(ctx.tools.map(t => [t.slug, t]));
  const builtinIds = new Set(ctx.builtins.map(b => b.id));
  const builtinKeys = new Set(ctx.builtins.map(b => stepsKey(builtinSteps(b, ctx.tools))));
  const seen = new Set(ctx.existing.map(r => stepsKey(r.steps)));
  const skipped = noSkips();
  const recipes: ImportedRecipe[] = [];

  for (const raw of data['recipes'] as unknown[]) {
    const entry = readImportEntry(raw, bySlug, builtinIds);
    if (typeof entry === 'string') { skipped[entry]++; continue; }
    const key = stepsKey(entry.steps);
    if (builtinKeys.has(key)) { skipped.builtin++; continue; }
    if (seen.has(key)) { skipped.duplicate++; continue; }
    if (ctx.existing.length + recipes.length >= ctx.max) { skipped.overLimit++; continue; }
    seen.add(key);
    recipes.push(entry);
  }
  return { recipes, skipped };
}

/** Optional trimmed string field: '' when absent, null when present but not a string. */
function optionalText(v: unknown): string | null {
  if (v === undefined) return '';
  return typeof v === 'string' ? v.trim() : null;
}

/** One entry of an import file, validated on its own; a skip reason when it cannot be used. */
function readImportEntry(
  raw: unknown, bySlug: ReadonlyMap<string, RegistryTool>, builtinIds: ReadonlySet<string>,
): ImportedRecipe | 'invalid' | 'unknownTool' {
  if (!isRecord(raw)) return 'invalid';
  const name = typeof raw['name'] === 'string' ? raw['name'].trim() : '';
  const description = optionalText(raw['description']);
  const rawSteps = raw['steps'];
  if (!name || name.length > RECIPE_NAME_MAX) return 'invalid';
  if (description === null || description.length > RECIPE_DESCRIPTION_MAX) return 'invalid';
  if (!Array.isArray(rawSteps) || rawSteps.length < RECIPE_MIN_STEPS || rawSteps.length > RECIPE_MAX_STEPS) return 'invalid';
  if (!rawSteps.every(s => isRecord(s) && typeof s['slug'] === 'string')) return 'invalid';
  // Names come from the registry, never from the file.
  const resolved = (rawSteps as Record<string, unknown>[]).map(s => bySlug.get(s['slug'] as string));
  if (resolved.some(t => !t)) return 'unknownTool';
  const steps = (resolved as RegistryTool[]).map(t => ({ slug: t.slug, name: t.name }));
  const basedOn = typeof raw['basedOn'] === 'string' && builtinIds.has(raw['basedOn']) ? raw['basedOn'] : undefined;
  return { name, ...(description ? { description } : {}), ...(basedOn ? { basedOn } : {}), steps };
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** "Imported 3, skipped 2: 1 duplicate, 1 unknown tool." */
export function summariseImport(r: ImportResult): string {
  if (r.error) return r.error;
  const s = r.skipped;
  const parts = [
    s.duplicate && plural(s.duplicate, 'duplicate'),
    s.builtin && plural(s.builtin, 'copy of a ready-made recipe', 'copies of ready-made recipes'),
    s.unknownTool && plural(s.unknownTool, 'unknown tool'),
    s.invalid && plural(s.invalid, 'invalid recipe'),
    s.overLimit && `${s.overLimit} over the saved-recipe limit`,
  ].filter(Boolean) as string[];
  const total = s.duplicate + s.builtin + s.unknownTool + s.invalid + s.overLimit;
  if (!r.recipes.length && !total) return 'That file has no recipes in it.';
  return `Imported ${r.recipes.length}` + (total ? `, skipped ${total}: ${parts.join(', ')}.` : '.');
}

// ---------------------------------------------------------------------------------------------------------------
// Editor validation

/** Problems that stop a draft from being saved (empty when it can be). */
export function recipeDraftErrors(name: string, description: string, stepCount: number): string[] {
  const errors: string[] = [];
  const n = name.trim();
  if (!n) errors.push('Give the recipe a name.');
  else if (n.length > RECIPE_NAME_MAX) errors.push(`Keep the name to ${RECIPE_NAME_MAX} characters.`);
  if (description.trim().length > RECIPE_DESCRIPTION_MAX) errors.push(`Keep the description to ${RECIPE_DESCRIPTION_MAX} characters.`);
  if (stepCount < RECIPE_MIN_STEPS) errors.push(`Add at least ${RECIPE_MIN_STEPS} tools.`);
  if (stepCount > RECIPE_MAX_STEPS) errors.push(`A recipe can have at most ${RECIPE_MAX_STEPS} tools.`);
  return errors;
}

/** Registry tools matching a picker query (name or keywords), best matches first. */
export function searchRecipeTools<T extends RegistryTool>(tools: readonly T[], query: string, limit = 20): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return tools.slice(0, limit);
  const score = (t: T): number => {
    const name = t.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.includes(q)) return 1;
    return (t.keywords ?? []).some(k => k.toLowerCase().includes(q)) ? 2 : -1;
  };
  const scored = tools.map(t => ({ t, score: score(t) })).filter(x => x.score >= 0);
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map(x => x.t);
}
