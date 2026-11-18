import {
  RECIPE_RUN_SCHEMA, RecipePlanStep, RecipeRun, RecipeRunFile, RecipeTraceStep,
} from './model';
import type { RecipeToolInfo } from './tool-info';
import { RECIPE_MAX_STEPS, RECIPE_NAME_MAX, slugifyRecipeName } from './recipes';

/**
 * Pure helpers for the run summary (/recipes/run): what kind of value each step saw, what changed between a step's
 * input and output (JSON paths or lines), and the downloadable run file with its validating upload. No Angular.
 */

/** Longest value kept per input or output in a stored run (sessionStorage is about 5 MB per origin). */
export const RUN_VALUE_MAX = 200_000;
/** Largest run file Upload accepts. */
export const RUN_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
/** Largest step-settings object accepted from a run file, as JSON. */
export const RUN_OPTIONS_MAX_CHARS = 10_000;

type RunTool = RecipeToolInfo;

/** Cut a value to RUN_VALUE_MAX; `cut` says whether it was. */
export function capValue(v: string): { value: string; cut: boolean } {
  return v.length > RUN_VALUE_MAX ? { value: v.slice(0, RUN_VALUE_MAX), cut: true } : { value: v, cut: false };
}

// ---------------------------------------------------------------------------------------------------------------
// What kind of value is this?

export type ValueKind =
  | 'empty' | 'json' | 'jwt' | 'base64' | 'url-encoded' | 'hex' | 'markup' | 'csv' | 'number' | 'text';

export interface ValueProfile {
  kind: ValueKind;
  /** Human label: "JSON object, 4 keys", "Base64 (36 bytes decoded)". */
  label: string;
  chars: number;
  lines: number;
  /** UTF-8 size. */
  bytes: number;
}

const JWT_RE = /^[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$|^[A-Za-z0-9_-]+$/;
const HEX_RE = /^(0x)?[0-9a-fA-F]+$/;
const PCT_RE = /%[0-9A-Fa-f]{2}/;

function tryJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const t = text.trim();
  if (!t || !/^[[{"]/.test(t)) return { ok: false };
  try { return { ok: true, value: JSON.parse(t) }; } catch { return { ok: false }; }
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** A best guess at what a step's value is, for the summary's "JSON -> Base64" line. Never throws. */
export function profileValue(text: string): ValueProfile {
  const chars = text.length;
  const lines = text ? text.split('\n').length : 0;
  const bytes = new TextEncoder().encode(text).length;
  const base = { chars, lines, bytes };
  const t = text.trim();
  if (!t) return { kind: 'empty', label: 'empty', ...base };

  const json = tryJson(t);
  if (json.ok) {
    const v = json.value;
    if (Array.isArray(v)) return { kind: 'json', label: `JSON array, ${plural(v.length, 'item')}`, ...base };
    if (v && typeof v === 'object') return { kind: 'json', label: `JSON object, ${plural(Object.keys(v).length, 'key')}`, ...base };
    return { kind: 'json', label: `JSON ${typeof v}`, ...base };
  }
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return { kind: 'number', label: 'number', ...base };
  if (!/\s/.test(t) && JWT_RE.test(t) && t.startsWith('eyJ')) return { kind: 'jwt', label: 'JWT (3 parts)', ...base };
  if (/^<[!?a-zA-Z]/.test(t) && />\s*$/.test(t)) return { kind: 'markup', label: 'HTML / XML markup', ...base };
  if (!/\s/.test(t) && PCT_RE.test(t)) return { kind: 'url-encoded', label: 'URL-encoded text', ...base };
  if (!/\s/.test(t) && t.length >= 8 && t.length % 2 === 0 && HEX_RE.test(t) && /[a-fA-F]/.test(t)) {
    return { kind: 'hex', label: `hex (${t.replace(/^0x/, '').length / 2} bytes)`, ...base };
  }
  if (!/\s/.test(t) && t.length >= 8 && BASE64_RE.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && /\d|[+/=_-]/.test(t)) {
    const body = t.replace(/=+$/, '');
    return { kind: 'base64', label: `Base64 (${Math.floor(body.length * 3 / 4)} bytes decoded)`, ...base };
  }
  const rows = t.split('\n');
  if (rows.length >= 2) {
    const commas = rows.slice(0, 20).map(r => (r.match(/,/g) ?? []).length);
    if (commas[0] > 0 && commas.every(c => c === commas[0])) {
      return { kind: 'csv', label: `CSV, ${plural(rows.length - 1, 'row')} x ${commas[0] + 1} columns`, ...base };
    }
  }
  return { kind: 'text', label: lines > 1 ? `text, ${plural(lines, 'line')}` : 'text', ...base };
}

// ---------------------------------------------------------------------------------------------------------------
// JSON changes: which values were added, removed or changed

export interface JsonChange {
  /** JSONPath-like: $.user.roles[0] */
  path: string;
  kind: 'added' | 'removed' | 'changed';
  before?: string;
  after?: string;
}

const MAX_JSON_PREVIEW = 120;
function preview(v: unknown): string {
  const s = JSON.stringify(v) ?? String(v);
  return s.length > MAX_JSON_PREVIEW ? s.slice(0, MAX_JSON_PREVIEW - 1) + '…' : s;
}
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keyPath = (base: string, k: string) => /^[A-Za-z_$][\w$]*$/.test(k) ? `${base}.${k}` : `${base}[${JSON.stringify(k)}]`;

/**
 * The value changes from one JSON document to another, depth first, at most `limit` of them (`more` counts the rest).
 * Arrays compare by index. Key order alone is not a change. Null when either side is not JSON.
 */
export function jsonChanges(before: string, after: string, limit = 100): { changes: JsonChange[]; more: number } | null {
  const a = tryJson(before);
  const b = tryJson(after);
  if (!a.ok || !b.ok) return null;
  const changes: JsonChange[] = [];
  let more = 0;
  const push = (c: JsonChange) => { if (changes.length < limit) changes.push(c); else more++; };
  const walk = (x: unknown, y: unknown, path: string) => {
    if (isPlainObject(x) && isPlainObject(y)) {
      for (const k of Object.keys(x)) {
        if (!(k in y)) push({ path: keyPath(path, k), kind: 'removed', before: preview(x[k]) });
        else walk(x[k], y[k], keyPath(path, k));
      }
      for (const k of Object.keys(y)) if (!(k in x)) push({ path: keyPath(path, k), kind: 'added', after: preview(y[k]) });
      return;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      const n = Math.max(x.length, y.length);
      for (let i = 0; i < n; i++) {
        const p = `${path}[${i}]`;
        if (i >= y.length) push({ path: p, kind: 'removed', before: preview(x[i]) });
        else if (i >= x.length) push({ path: p, kind: 'added', after: preview(y[i]) });
        else walk(x[i], y[i], p);
      }
      return;
    }
    if (JSON.stringify(x) !== JSON.stringify(y)) push({ path, kind: 'changed', before: preview(x), after: preview(y) });
  };
  walk(a.value, b.value, '$');
  return { changes, more };
}

// ---------------------------------------------------------------------------------------------------------------
// Line changes

export interface LineOp { op: 'same' | 'add' | 'del'; text: string }

/** Biggest input the line diff takes (lines before x lines after), so a large value cannot freeze the page. */
export const LINE_DIFF_MAX_CELLS = 400_000;

/** A line-by-line diff (longest common subsequence); null when the values are too large to compare. */
export function lineDiff(before: string, after: string): LineOp[] | null {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > LINE_DIFF_MAX_CELLS) return null;
  const n = a.length, m = b.length;
  // lcs[i][j] = LCS length of a[i..] and b[j..], kept as one flat array.
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const ops: LineOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ op: 'same', text: a[i] }); i++; j++; }
    else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) ops.push({ op: 'del', text: a[i++] });
    else ops.push({ op: 'add', text: b[j++] });
  }
  while (i < n) ops.push({ op: 'del', text: a[i++] });
  while (j < m) ops.push({ op: 'add', text: b[j++] });
  return ops;
}

// ---------------------------------------------------------------------------------------------------------------
// One step's summary

export interface StepChange {
  before: ValueProfile;
  after: ValueProfile;
  /** One sentence: "JSON object, 3 keys became Base64 (48 bytes decoded); 52 -> 64 characters." */
  headline: string;
  json: { changes: JsonChange[]; more: number } | null;
  /** Shown when both sides have several lines and are not both JSON. */
  lines: LineOp[] | null;
  /** The output equals the input. */
  unchanged: boolean;
}

export function describeStep(input: string, output: string): StepChange {
  const before = profileValue(input);
  const after = profileValue(output);
  const unchanged = input === output;
  const json = before.kind === 'json' && after.kind === 'json' ? jsonChanges(input, output) : null;
  const lines = !json && before.lines > 1 && after.lines > 1 ? lineDiff(input, output) : null;
  const size = `${before.chars.toLocaleString('en-US')} -> ${after.chars.toLocaleString('en-US')} characters`;
  let headline: string;
  if (unchanged) headline = 'The output is the same as the input.';
  else if (before.kind === after.kind && before.kind === 'json') {
    const n = json ? json.changes.length + json.more : 0;
    headline = n
      ? `${after.label}; ${plural(n, 'value')} changed; ${size}.`
      : `Same JSON values, reformatted (${before.lines} -> ${after.lines} lines); ${size}.`;
  } else if (before.kind === after.kind) headline = `${after.label}; ${size}.`;
  else headline = `${before.label} became ${after.label}; ${size}.`;
  return { before, after, headline, json, lines, unchanged };
}

// ---------------------------------------------------------------------------------------------------------------
// Run file: download and upload

/** The run as a downloadable file: its steps (with modes and settings) and every recorded input and output. */
export function buildRunFile(run: RecipeRun, now = new Date()): RecipeRunFile {
  return {
    schema: RECIPE_RUN_SCHEMA,
    exportedAt: now.toISOString(),
    name: run.name,
    ...(run.basedOn ? { basedOn: run.basedOn } : {}),
    steps: run.steps.map(s => ({
      slug: s.slug,
      ...(s.mode ? { mode: s.mode } : {}),
      ...(s.options ? { options: s.options } : {}),
    })),
    trace: run.steps.map((_, i) => run.trace[i] ?? null),
  };
}

export function runFileName(name: string, now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${slugifyRecipeName(name)}-run-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Step settings from a file: a plain JSON object of small size, else undefined. */
export function readOptions(v: unknown): Record<string, unknown> | undefined {
  if (!isRecord(v)) return undefined;
  let text: string;
  try { text = JSON.stringify(v); } catch { return undefined; }
  if (text.length > RUN_OPTIONS_MAX_CHARS) return undefined;
  return JSON.parse(text) as Record<string, unknown>;
}

function readTraceStep(v: unknown): RecipeTraceStep | null | 'invalid' {
  if (v === null) return null;
  if (!isRecord(v) || typeof v['input'] !== 'string' || typeof v['output'] !== 'string') return 'invalid';
  if (v['error'] !== undefined && typeof v['error'] !== 'string') return 'invalid';
  const input = capValue(v['input']);
  const output = capValue(v['output']);
  return {
    input: input.value,
    output: output.value,
    ...(typeof v['error'] === 'string' && v['error'] ? { error: v['error'].slice(0, 2000) } : {}),
    ...(v['noOutputPanel'] === true ? { noOutputPanel: true } : {}),
    ...(input.cut || output.cut || v['truncated'] === true ? { truncated: true } : {}),
  };
}

export type RunImport = { run: RecipeRun; notes: string[] } | { error: string };

/**
 * Reads an uploaded run file. The file is untrusted: size-capped, parsed in a try/catch, the schema checked exactly,
 * tools resolved from the registry by slug (names never taken from the file), modes kept only when the tool has
 * them, settings kept only as small plain objects, values capped, unknown fields ignored.
 */
export function parseRunFile(text: string, tools: readonly RunTool[], now = Date.now()): RunImport {
  if (new TextEncoder().encode(text).length > RUN_IMPORT_MAX_BYTES) return { error: 'That file is larger than 2 MB, so it was not read.' };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { error: 'That file is not valid JSON.' }; }
  if (!isRecord(data) || data['schema'] !== RECIPE_RUN_SCHEMA) {
    return { error: `That file is not a SmartDevUtils recipe run (expected "schema": "${RECIPE_RUN_SCHEMA}").` };
  }
  const name = typeof data['name'] === 'string' ? data['name'].trim().slice(0, RECIPE_NAME_MAX) : '';
  const rawSteps = data['steps'];
  if (!name) return { error: 'The run has no recipe name.' };
  if (!Array.isArray(rawSteps) || rawSteps.length < 1 || rawSteps.length > RECIPE_MAX_STEPS) {
    return { error: `The run needs 1 to ${RECIPE_MAX_STEPS} steps.` };
  }
  const bySlug = new Map(tools.map(t => [t.slug, t]));
  const notes: string[] = [];
  const steps: RecipePlanStep[] = [];
  for (const [i, raw] of rawSteps.entries()) {
    if (!isRecord(raw) || typeof raw['slug'] !== 'string') return { error: `Step ${i + 1} is not a valid step.` };
    const tool = bySlug.get(raw['slug']);
    if (!tool) return { error: `Step ${i + 1} uses a tool this site does not have ("${raw['slug'].slice(0, 60)}").` };
    const mode = typeof raw['mode'] === 'string' && tool.modes?.some(m => m.id === raw['mode']) ? raw['mode'] : undefined;
    if (raw['mode'] !== undefined && !mode) notes.push(`Step ${i + 1}: the mode "${String(raw['mode']).slice(0, 40)}" was ignored.`);
    const options = readOptions(raw['options']);
    if (raw['options'] !== undefined && !options) notes.push(`Step ${i + 1}: its settings were not valid and were ignored.`);
    steps.push({ toolId: tool.id, slug: tool.slug, name: tool.name, ...(mode ? { mode } : {}), ...(options ? { options } : {}) });
  }
  const rawTrace = Array.isArray(data['trace']) ? data['trace'] : [];
  const trace: (RecipeTraceStep | null)[] = [];
  for (let i = 0; i < steps.length; i++) {
    const t = readTraceStep(rawTrace[i] ?? null);
    if (t === 'invalid') { notes.push(`Step ${i + 1}: its recorded data was not valid and was dropped.`); trace.push(null); }
    else trace.push(t);
  }
  if (!trace[0]) notes.push('The file has no input for step 1; add one before re-running.');
  const basedOn = typeof data['basedOn'] === 'string' && /^[a-z0-9-]{1,80}$/.test(data['basedOn']) ? data['basedOn'] : undefined;
  return { run: { name, ...(basedOn ? { basedOn } : {}), steps, trace, updatedAt: now }, notes };
}

/** The stored run, if it is well-formed (sessionStorage is written by this site but may be stale or edited). */
export function readStoredRun(raw: string | null, tools: readonly RunTool[]): RecipeRun | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!isRecord(data) || !Array.isArray(data['steps'])) return null;
    const file = parseRunFile(JSON.stringify({ ...data, schema: RECIPE_RUN_SCHEMA, steps: (data['steps'] as unknown[]).map(s => isRecord(s) ? { slug: s['slug'], mode: s['mode'], options: s['options'] } : s) }), tools);
    if ('error' in file) return null;
    const stopped = isRecord(data['stopped']) && Number.isInteger(data['stopped']['index']) && typeof data['stopped']['reason'] === 'string'
      ? { index: data['stopped']['index'] as number, reason: data['stopped']['reason'] as string } : undefined;
    return { ...file.run, ...(stopped ? { stopped } : {}), updatedAt: typeof data['updatedAt'] === 'number' ? data['updatedAt'] : 0 };
  } catch {
    return null;
  }
}
