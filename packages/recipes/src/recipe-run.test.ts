import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG as TOOLS_REGISTRY } from '@smartdevutils/core/tools/catalog';
import { RECIPE_RUN_SCHEMA, RecipeRun } from './model';
import {
  RUN_IMPORT_MAX_BYTES, RUN_VALUE_MAX, buildRunFile, describeStep, jsonChanges, lineDiff, parseRunFile, profileValue,
  readStoredRun, runFileName,
} from './recipe-run';

const tools = TOOLS_REGISTRY;
const base64Tool = tools.find(t => t.id === 'base64-encoder-decoder')!;
const jsonTool = tools.find(t => t.id === 'json-formatter')!;

const run: RecipeRun = {
  name: 'Decode and pretty-print',
  basedOn: 'decode-base64-json-param',
  steps: [
    { toolId: base64Tool.id, slug: base64Tool.slug, name: base64Tool.name, mode: 'decode' },
    { toolId: jsonTool.id, slug: jsonTool.slug, name: jsonTool.name, options: { indent: 2 } },
  ],
  trace: [
    { input: 'eyJ1c2VyIjoiYWRhIn0=', output: '{"user":"ada"}' },
    { input: '{"user":"ada"}', output: '{\n  "user": "ada"\n}' },
  ],
  updatedAt: 1,
};

describe('profileValue', () => {
  it('recognises the kinds a recipe passes along', () => {
    expect(profileValue('').kind).toBe('empty');
    expect(profileValue('{"a":1,"b":2}').label).toBe('JSON object, 2 keys');
    expect(profileValue('[1,2,3]').label).toBe('JSON array, 3 items');
    expect(profileValue('eyJ1c2VyIjoiYWRhIn0=').kind).toBe('base64');
    expect(profileValue('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln').kind).toBe('jwt');
    expect(profileValue('name%3DAda%26x%3D1').kind).toBe('url-encoded');
    expect(profileValue('deadbeefcafe').kind).toBe('hex');
    expect(profileValue('<p>hi</p>').kind).toBe('markup');
    expect(profileValue('a,b\n1,2\n3,4').label).toBe('CSV, 2 rows x 2 columns');
    expect(profileValue('42').kind).toBe('number');
    expect(profileValue('hello world').kind).toBe('text');
  });

  it('plain words are not mistaken for Base64', () => {
    expect(profileValue('hello').kind).toBe('text');
    expect(profileValue('Password').kind).toBe('text');
  });

  it('counts UTF-8 bytes', () => {
    expect(profileValue('é').bytes).toBe(2);
  });
});

describe('jsonChanges', () => {
  it('lists added, removed and changed values by path', () => {
    const r = jsonChanges('{"a":1,"b":{"c":[1,2]},"d":true}', '{"a":2,"b":{"c":[1]},"e":"x"}')!;
    expect(r.changes).toEqual([
      { path: '$.a', kind: 'changed', before: '1', after: '2' },
      { path: '$.b.c[1]', kind: 'removed', before: '2' },
      { path: '$.d', kind: 'removed', before: 'true' },
      { path: '$.e', kind: 'added', after: '"x"' },
    ]);
  });

  it('key order and formatting alone are not changes', () => {
    expect(jsonChanges('{"a":1,"b":2}', '{\n  "b": 2,\n  "a": 1\n}')!.changes).toEqual([]);
  });

  it('quotes keys that are not identifiers, and caps the list', () => {
    expect(jsonChanges('{}', '{"a-b":1}')!.changes[0].path).toBe('$["a-b"]');
    const big = JSON.stringify(Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`k${i}`, i])));
    const r = jsonChanges('{}', big, 100)!;
    expect(r.changes.length).toBe(100);
    expect(r.more).toBe(50);
  });

  it('is null when a side is not JSON', () => {
    expect(jsonChanges('nope', '{}')).toBeNull();
  });
});

describe('lineDiff', () => {
  it('marks added and removed lines', () => {
    expect(lineDiff('a\nb\nc', 'a\nc\nd')).toEqual([
      { op: 'same', text: 'a' }, { op: 'del', text: 'b' }, { op: 'same', text: 'c' }, { op: 'add', text: 'd' },
    ]);
  });

  it('gives up on values too large to compare', () => {
    const big = Array.from({ length: 1000 }, (_, i) => String(i)).join('\n');
    expect(lineDiff(big, big + '\nx')).toBeNull();
  });

});

describe('describeStep', () => {
  it('says when a step changed nothing', () => {
    expect(describeStep('x', 'x').unchanged).toBe(true);
  });

  it('says when JSON was only reformatted', () => {
    const d = describeStep('{"a":1}', '{\n  "a": 1\n}');
    expect(d.headline).toMatch(/^Same JSON values, reformatted/);
    expect(d.lines).toBeNull();
  });

  it('names the change of kind', () => {
    expect(describeStep('eyJ1c2VyIjoiYWRhIn0=', '{"user":"ada"}').headline)
      .toBe('Base64 (14 bytes decoded) became JSON object, 1 key; 20 -> 14 characters.');
  });

  it('gives a line diff for multi-line text', () => {
    expect(describeStep('b\na', 'a\nb').lines).not.toBeNull();
  });
});

describe('run file', () => {
  it('round-trips steps, modes, settings and data', () => {
    const file = buildRunFile(run, new Date('2026-11-18T00:00:00Z'));
    expect(file.schema).toBe(RECIPE_RUN_SCHEMA);
    const back = parseRunFile(JSON.stringify(file), tools, 5);
    expect('run' in back && back.run).toEqual({ ...run, updatedAt: 5 });
    expect('run' in back && back.notes).toEqual([]);
  });

  it('names the file after the recipe and date', () => {
    expect(runFileName('Decode and pretty-print', new Date(2026, 10, 18))).toBe('decode-and-pretty-print-run-20261118.json');
  });

  it('rejects files that are not runs', () => {
    expect(parseRunFile('not json', tools)).toEqual({ error: 'That file is not valid JSON.' });
    expect('error' in parseRunFile('{"schema":"sdu-recipes/1"}', tools)).toBe(true);
    expect('error' in parseRunFile(JSON.stringify({ schema: RECIPE_RUN_SCHEMA, name: 'x', steps: [{ slug: 'no-such-tool' }] }), tools)).toBe(true);
    expect('error' in parseRunFile(JSON.stringify({ schema: RECIPE_RUN_SCHEMA, name: '', steps: [{ slug: jsonTool.slug }] }), tools)).toBe(true);
    expect(parseRunFile('x'.repeat(RUN_IMPORT_MAX_BYTES + 1), tools)).toEqual({ error: 'That file is larger than 2 MB, so it was not read.' });
  });

  it('takes names from the registry and drops unknown modes, bad settings and bad data', () => {
    const r = parseRunFile(JSON.stringify({
      schema: RECIPE_RUN_SCHEMA, name: 'x',
      steps: [{ slug: base64Tool.slug, name: '<img onerror=alert(1)>', mode: 'nope', options: [1] }, { slug: jsonTool.slug }],
      trace: [{ input: 1, output: 'y' }, { input: 'a', output: 'b', evil: true }],
    }), tools);
    if (!('run' in r)) throw new Error('expected a run');
    expect(r.run.steps[0]).toEqual({ toolId: base64Tool.id, slug: base64Tool.slug, name: base64Tool.name });
    expect(r.run.trace).toEqual([null, { input: 'a', output: 'b' }]);
    expect(r.notes.length).toBe(4);
  });

  it('caps very long values', () => {
    const r = parseRunFile(JSON.stringify({
      schema: RECIPE_RUN_SCHEMA, name: 'x', steps: [{ slug: jsonTool.slug }],
      trace: [{ input: 'a'.repeat(RUN_VALUE_MAX + 5), output: '' }],
    }), tools);
    if (!('run' in r)) throw new Error('expected a run');
    expect(r.run.trace[0]!.input.length).toBe(RUN_VALUE_MAX);
    expect(r.run.trace[0]!.truncated).toBe(true);
  });

  it('reads a stored run, keeping where a replay stopped', () => {
    const stored = readStoredRun(JSON.stringify({ ...run, stopped: { index: 1, reason: 'error' } }), tools)!;
    expect(stored.stopped).toEqual({ index: 1, reason: 'error' });
    expect(stored.steps[0].mode).toBe('decode');
    expect(readStoredRun('{bad', tools)).toBeNull();
    expect(readStoredRun(null, tools)).toBeNull();
  });
});
