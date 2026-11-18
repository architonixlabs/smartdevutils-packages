// The one place the site talks to js-yaml. js-yaml 5 changed its defaults; these wrappers keep the results the
// tools gave with js-yaml 4, so a change in behaviour is a deliberate edit here rather than a side effect.
import {
  CORE_SCHEMA, YAMLException, binaryTag, dump, load, loadAll, mergeTag, omapTag, pairsTag, setTag, timestampTag,
  type DumpOptions, type LoadOptions, type Schema,
} from 'js-yaml';

export { YAMLException };
export type { DumpOptions, LoadOptions, Schema };

/**
 * js-yaml 4's default schema: YAML 1.2 core plus merge keys (`<<: *anchor`), timestamps, `!!binary`, `!!omap`,
 * `!!pairs` and `!!set`. Compose files rely on merge keys; without them shared settings would be dropped silently.
 */
export const YAML_DEFAULT_SCHEMA: Schema = CORE_SCHEMA.withTags(mergeTag, timestampTag, binaryTag, omapTag, pairsTag, setTag);

/** YAML 1.2 core only: dates stay strings, no merge keys. */
export const YAML_CORE_SCHEMA: Schema = CORE_SCHEMA;

/** YAML 1.2 core plus merge keys: dates stay strings. */
export const YAML_CORE_MERGE_SCHEMA: Schema = CORE_SCHEMA.withTags(mergeTag);

/** js-yaml 4 read `!!set {a, b}` as `{ a: null, b: null }`; 5 returns a Set, which JSON cannot show. */
function setsToObjects(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Set) return Object.fromEntries([...value].map(k => [String(k), null]));
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value); // anchors can share objects; visit each once
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = setsToObjects(value[i], seen);
  } else if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
    const rec = value as Record<string, unknown>;
    for (const k of Object.keys(rec)) rec[k] = setsToObjects(rec[k], seen);
  }
  return value;
}

const fixSets = (text: string, value: unknown) => (text.includes('!!set') ? setsToObjects(value) : value);

/**
 * Reads one YAML document (js-yaml 4 behaviour by default). Empty input gives `undefined` and a comment-only input
 * gives `null`, as js-yaml 4 did; js-yaml 5 throws on both. Several documents still throw.
 */
export function loadYaml(text: string, options: LoadOptions = {}): unknown {
  const opts = { schema: YAML_DEFAULT_SCHEMA, ...options };
  const docs = loadAll(text, opts);
  if (docs.length === 0) return text.trim() === '' ? undefined : null;
  if (docs.length > 1) return load(text, opts); // throws "expected a single document…" with its position
  return fixSets(text, docs[0]);
}

/** Reads every document of a multi-document YAML stream (js-yaml 4 behaviour by default). */
export function loadAllYaml(text: string, options: LoadOptions = {}): unknown[] {
  return loadAll(text, { schema: YAML_DEFAULT_SCHEMA, ...options }).map(d => fixSets(text, d));
}

/** Writes YAML. `quoteStyle: 'double'` replaces js-yaml 4's `quotingType: '"'`. */
export function dumpYaml(value: unknown, options: DumpOptions = {}): string {
  return dump(value, options);
}
